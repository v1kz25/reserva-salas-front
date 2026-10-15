import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { UsuariosService } from '../../../core/services/usuarios.service';
import {
  AVISO_PASSWORD_CAMBIADA,
  MENSAJE_PASSWORD_LARGA,
  MENSAJE_PASSWORD_NO_COINCIDE,
  MENSAJE_USUARIO_NO_EXISTE,
} from '../usuario-mensajes';
import { MAX_PASSWORD, MIN_PASSWORD, coincidenciaValidator, passwordBytesValidator } from '../usuario-validators';

/** Campos del formulario de cambio de contraseña. */
type CampoPassword = 'password' | 'confirmacion';

/**
 * CambioPasswordComponent — sección de la edición de un usuario para cambiarle la
 * contraseña (`PUT /api/usuarios/{id}/password`), con su propio botón y un campo que
 * confirma la contraseña nueva.
 *
 * Si el administrador cambia su propia contraseña y el servidor cierra su sesión, la
 * siguiente petición recibe un `401` y el interceptor de errores lo lleva a `/login`.
 */
@Component({
  selector: 'app-cambio-password',
  imports: [ReactiveFormsModule],
  templateUrl: './cambio-password.component.html',
  styleUrl: './cambio-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambioPasswordComponent {
  /** Formulario, para llevar el foco al primer campo con error. */
  private readonly formRef = viewChild.required<ElementRef<HTMLFormElement>>('formRef');

  /** Error general, que recibe el foco si no hay ningún campo con error. */
  private readonly errorRef = viewChild<ElementRef<HTMLElement>>('errorRef');

  /** Identificador del usuario al que se cambia la contraseña. */
  readonly usuarioId = input.required<number>();

  /** Indica si el usuario es el administrador en sesión. */
  readonly propio = input(false);

  /** Emite si el usuario ya no existe al cambiar la contraseña (`404`). */
  readonly noEncontrado = output<void>();

  /** Indica si se está enviando la contraseña. */
  protected readonly enviando = signal(false);

  /** Mensaje de éxito, si lo hay. */
  protected readonly aviso = signal<string | undefined>(undefined);

  /** Mensaje de error general devuelto por el servidor, si lo hay. */
  protected readonly errorGeneral = signal<string | undefined>(undefined);

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly usuariosService = inject(UsuariosService);

  /** Límites del contrato, para la plantilla. */
  protected readonly limites = { min: MIN_PASSWORD, max: MAX_PASSWORD } as const;

  /** Mensajes, para la plantilla. */
  protected readonly mensajes = { larga: MENSAJE_PASSWORD_LARGA, noCoincide: MENSAJE_PASSWORD_NO_COINCIDE } as const;

  /** Formulario con la contraseña nueva y su confirmación. */
  protected readonly form = this.fb.group(
    {
      password: this.fb.control('', [
        Validators.required,
        Validators.minLength(MIN_PASSWORD),
        Validators.maxLength(MAX_PASSWORD),
        passwordBytesValidator,
      ]),
      confirmacion: this.fb.control('', [Validators.required]),
    },
    { validators: coincidenciaValidator('password', 'confirmacion') },
  );

  /**
   * Indica si hay que mostrar los errores propios de un campo (tocado o modificado e inválido).
   *
   * @param campo Nombre del control.
   */
  mostrarError(campo: CampoPassword): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  /**
   * Indica si hay que mostrar que la confirmación no coincide con la contraseña.
   */
  mostrarNoCoincide(): boolean {
    const confirmacion = this.form.controls.confirmacion;
    return (confirmacion.touched || confirmacion.dirty) && this.form.hasError('noCoincide');
  }

  /**
   * Indica si el campo de confirmación tiene algún error visible (propio o de coincidencia).
   */
  confirmacionInvalida(): boolean {
    return this.mostrarError('confirmacion') || this.mostrarNoCoincide();
  }

  /**
   * Valida y envía la contraseña nueva. Si va bien, vacía los campos y muestra un aviso; si
   * no, muestra los errores y lleva el foco al primero.
   */
  cambiar(): void {
    if (this.enviando()) {
      return;
    }
    this.aviso.set(undefined);
    this.errorGeneral.set(undefined);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    this.enviando.set(true);
    this.usuariosService
      .cambiarPassword(this.usuarioId(), this.form.controls.password.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.form.reset();
          this.aviso.set(AVISO_PASSWORD_CAMBIADA);
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          const problema = aProblemDetail(err);
          if (problema.status === 404) {
            this.errorGeneral.set(MENSAJE_USUARIO_NO_EXISTE);
            this.noEncontrado.emit();
            return;
          }
          const errorPassword = problema.errores?.find((error) => error.campo === 'password');
          if (errorPassword) {
            const control = this.form.controls.password;
            control.setErrors({ ...control.errors, servidor: errorPassword.mensaje });
            control.markAsTouched();
          } else {
            this.errorGeneral.set(problema.detail ?? problema.title);
          }
          this.enfocarPrimerError();
        },
      });
  }

  /**
   * Tras el render, lleva el foco al primer campo con error o, si no hay ninguno, al
   * mensaje de error general.
   */
  private enfocarPrimerError(): void {
    afterNextRender(
      () => {
        const campo = this.formRef().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
        (campo ?? this.errorRef()?.nativeElement)?.focus();
      },
      { injector: this.injector },
    );
  }
}
