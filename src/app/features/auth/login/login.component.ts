import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { PARAM_RETURN_URL, RUTA_INICIO, rutaInternaSegura } from '../../../core/http/rutas-error';
import { AuthService } from '../../../core/services/auth.service';
import { AHORA } from '../../../core/tokens/ahora.token';

/** Mensaje si las credenciales no son válidas: no indica cuál de los dos campos falla. */
export const MENSAJE_CREDENCIALES_INVALIDAS = 'El email o la contraseña no son correctos.';

/** Mensaje si el servidor rechaza los datos por formato (`400`). */
export const MENSAJE_DATOS_INVALIDOS = 'Revisa el email y la contraseña.';

/** Mensaje si el login falla por el token CSRF (`403`) incluso tras renovarlo. */
export const MENSAJE_LOGIN_FALLIDO = 'No se ha podido iniciar sesión. Recarga la página e inténtalo de nuevo.';

/** Mensaje si hay demasiados intentos (`429`) y no se sabe cuánto esperar (sin `Retry-After` válido). */
export const MENSAJE_DEMASIADOS_INTENTOS = 'Has hecho demasiados intentos. Vuelve a intentarlo más tarde.';

/** Aviso que se anuncia cuando termina la espera tras un `429`. */
export const MENSAJE_FIN_ESPERA = 'Ya puedes volver a intentarlo.';

/**
 * Mensaje para un `429` con el tiempo de espera redondeado hacia arriba a minutos
 * («en menos de un minuto» si son menos de 60 s).
 *
 * @param segundos Segundos de espera indicados en `Retry-After` (mayor que 0).
 */
export function mensajeEspera(segundos: number): string {
  if (segundos < 60) {
    return 'Has hecho demasiados intentos. Vuelve a intentarlo en menos de un minuto.';
  }
  const minutos = Math.ceil(segundos / 60);
  return `Has hecho demasiados intentos. Vuelve a intentarlo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`;
}

/** Espera máxima (24 h) que se acepta de `Retry-After`; un valor mayor se considera no válido. */
export const MAX_SEGUNDOS_RETRY_AFTER = 86_400;

/**
 * Segundos de espera de la cabecera `Retry-After` de un error, si es un entero entre 1 y 86400 (24 h).
 * Cualquier otro valor (ausente, fecha HTTP, negativo, decimal, `0`, más de 24 h…) devuelve `undefined`.
 *
 * @param err Error recibido del login.
 */
export function segundosRetryAfter(err: unknown): number | undefined {
  if (!(err instanceof HttpErrorResponse)) {
    return undefined;
  }
  const valor = err.headers.get('Retry-After')?.trim();
  if (!valor || !/^\d+$/.test(valor)) {
    return undefined;
  }
  const segundos = Number(valor);
  return segundos > 0 && segundos <= MAX_SEGUNDOS_RETRY_AFTER ? segundos : undefined;
}

/**
 * LoginComponent — formulario de inicio de sesión. Si va bien, vuelve a la URL de
 * origen (`returnUrl`) o al listado de reservas.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  /** Mensaje de error general, que recibe el foco cuando aparece (así se anuncia, sin `role="alert"`). */
  private readonly errorRef = viewChild<ElementRef<HTMLElement>>('errorRef');

  /** Botón «Entrar», que recibe el foco al terminar la espera si lo tenía el mensaje de error. */
  private readonly botonRef = viewChild.required<ElementRef<HTMLButtonElement>>('botonRef');

  /** Formulario completo, para llevar el foco al primer campo con error. */
  private readonly formRef = viewChild.required<ElementRef<HTMLFormElement>>('formRef');

  /** Indica si se está enviando el login. */
  protected readonly enviando = signal(false);

  /** Mensaje de error general (credenciales no válidas…), si lo hay. */
  protected readonly errorGeneral = signal<string | undefined>(undefined);

  /** Aviso de la región `role="status"` (fin de la espera tras un `429`). */
  protected readonly avisoEstado = signal('');

  /** Momento (ms) hasta el que el login está bloqueado tras un `429`, si lo está. */
  private readonly bloqueadoHasta = signal<number | undefined>(undefined);

  /**
   * Momento actual (ms) según `AHORA`, actualizado cada segundo durante la espera. Se usa a propósito
   * el reloj de pared y no el número de ticks del intervalo: si la pestaña queda en segundo plano y el
   * navegador ralentiza los temporizadores, la cuenta atrás sigue correspondiendo al tiempo real.
   */
  private readonly momento = signal(0);

  /** Segundos que faltan para poder volver a intentarlo (0 si no hay bloqueo). */
  protected readonly segundosRestantes = computed(() => {
    const hasta = this.bloqueadoHasta();
    return hasta === undefined ? 0 : Math.max(0, Math.ceil((hasta - this.momento()) / 1000));
  });

  /** Indica si el botón «Entrar» está bloqueado por demasiados intentos. */
  protected readonly bloqueado = computed(() => this.segundosRestantes() > 0);

  /** Tiempo restante en formato `m:ss`, para la cuenta atrás visible. */
  protected readonly cuentaAtras = computed(() => {
    const segundos = this.segundosRestantes();
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  });

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly ahora = inject(AHORA);
  private readonly document = inject(DOCUMENT);

  /** Formulario de credenciales. */
  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email, Validators.maxLength(254)]),
    password: this.fb.control('', [Validators.required, Validators.maxLength(128)]),
  });

  /** Intervalo de la cuenta atrás en curso (se cancela al terminar o al destruir el componente). */
  private cuentaAtrasSub?: Subscription;

  /**
   * Indica si hay que mostrar los errores de un campo (tocado o modificado e inválido).
   *
   * @param campo Nombre del control.
   */
  mostrarError(campo: 'email' | 'password'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  /**
   * Valida y envía las credenciales. Si hay errores, lleva el foco al primero.
   */
  entrar(): void {
    if (this.enviando() || this.bloqueado()) {
      return;
    }
    this.errorGeneral.set(undefined);
    this.avisoEstado.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerCampoInvalido();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.enviando.set(true);
    this.auth
      .login({ email: email.trim(), password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(this.destino()).finally(() => this.enviando.set(false));
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          const problema = aProblemDetail(err);
          if (problema.status === 401) {
            this.form.controls.password.reset();
            this.mostrarErrorGeneral(MENSAJE_CREDENCIALES_INVALIDAS);
          } else if (problema.status === 429) {
            this.form.controls.password.reset();
            this.gestionarDemasiadosIntentos(segundosRetryAfter(err));
          } else if (problema.status === 403) {
            this.mostrarErrorGeneral(MENSAJE_LOGIN_FALLIDO);
          } else if (problema.status === 400) {
            this.mostrarErrorGeneral(MENSAJE_DATOS_INVALIDOS);
          } else {
            this.mostrarErrorGeneral(problema.detail ?? problema.title);
          }
        },
      });
  }

  /** URL a la que volver tras el login: `returnUrl` si es una ruta interna válida o `/reservas`. */
  private destino(): string {
    return rutaInternaSegura(this.route.snapshot.queryParamMap.get(PARAM_RETURN_URL)) ?? RUTA_INICIO;
  }

  /** Muestra el mensaje del `429` y, si se sabe cuánto esperar, bloquea el botón con una cuenta atrás. */
  private gestionarDemasiadosIntentos(segundos: number | undefined): void {
    if (segundos === undefined) {
      this.mostrarErrorGeneral(MENSAJE_DEMASIADOS_INTENTOS);
      return;
    }
    this.mostrarErrorGeneral(mensajeEspera(segundos));
    const inicio = this.ahora().getTime();
    this.momento.set(inicio);
    this.bloqueadoHasta.set(inicio + segundos * 1000);
    this.cuentaAtrasSub?.unsubscribe();
    this.cuentaAtrasSub = interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.momento.set(this.ahora().getTime());
        if (!this.bloqueado()) {
          this.terminarEspera();
        }
      });
  }

  /**
   * Desbloquea el botón, quita el mensaje del `429` (ya no es cierto) y anuncia el fin de la espera.
   * Si el foco estaba en el mensaje, pasa al botón «Entrar» para que no caiga al `body`.
   */
  private terminarEspera(): void {
    this.cuentaAtrasSub?.unsubscribe();
    this.cuentaAtrasSub = undefined;
    const focoEnError = this.document.activeElement === this.errorRef()?.nativeElement;
    this.bloqueadoHasta.set(undefined);
    this.errorGeneral.set(undefined);
    this.avisoEstado.set(MENSAJE_FIN_ESPERA);
    if (focoEnError) {
      afterNextRender(() => this.botonRef().nativeElement.focus(), { injector: this.injector });
    }
  }

  private mostrarErrorGeneral(mensaje: string): void {
    this.errorGeneral.set(mensaje);
    afterNextRender(() => this.errorRef()?.nativeElement.focus(), { injector: this.injector });
  }

  private enfocarPrimerCampoInvalido(): void {
    afterNextRender(
      () => this.formRef().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }
}
