import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { PARAM_RETURN_URL, RUTA_INICIO, rutaInternaSegura } from '../../../core/http/rutas-error';
import { AuthService } from '../../../core/services/auth.service';

/** Mensaje si las credenciales no son válidas: no indica cuál de los dos campos falla. */
export const MENSAJE_CREDENCIALES_INVALIDAS = 'El email o la contraseña no son correctos.';

/** Mensaje si el servidor rechaza los datos por formato (`400`). */
export const MENSAJE_DATOS_INVALIDOS = 'Revisa el email y la contraseña.';

/** Mensaje si el login falla por el token CSRF (`403`) incluso tras renovarlo. */
export const MENSAJE_LOGIN_FALLIDO = 'No se ha podido iniciar sesión. Recarga la página e inténtalo de nuevo.';

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

  /** Formulario completo, para llevar el foco al primer campo con error. */
  private readonly formRef = viewChild.required<ElementRef<HTMLFormElement>>('formRef');

  /** Indica si se está enviando el login. */
  protected readonly enviando = signal(false);

  /** Mensaje de error general (credenciales no válidas…), si lo hay. */
  protected readonly errorGeneral = signal<string | undefined>(undefined);

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Formulario de credenciales. */
  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email, Validators.maxLength(254)]),
    password: this.fb.control('', [Validators.required, Validators.maxLength(128)]),
  });

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
    if (this.enviando()) {
      return;
    }
    this.errorGeneral.set(undefined);
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
