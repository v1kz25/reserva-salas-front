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
import { Router, RouterLink } from '@angular/router';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { ErrorCampo, ProblemDetail } from '../../../core/models/problem-detail.model';
import { Rol, UsuarioNuevoRequest } from '../../../core/models/usuario.model';
import { UsuariosService } from '../../../core/services/usuarios.service';
import { CLAVE_AVISO } from '../../../shared/utils/aviso-navegacion';
import { textoNoEnBlancoValidator } from '../../salas/sala-form/sala-form.validators';
import {
  MENSAJE_EMAIL_REPETIDO,
  MENSAJE_PASSWORD_LARGA,
  NOMBRE_ROL,
  RUTA_USUARIOS_ADMIN,
  avisoUsuarioCreado,
} from '../usuario-mensajes';
import {
  MAX_EMAIL,
  MAX_NOMBRE_USUARIO,
  MAX_PASSWORD,
  MIN_PASSWORD,
  passwordBytesValidator,
} from '../usuario-validators';

/** Campos del formulario que pueden recibir errores del servidor. */
type CampoAlta = keyof UsuarioNuevoRequest;

const CAMPOS: readonly CampoAlta[] = ['email', 'nombre', 'password', 'rol'];

/**
 * UsuarioAltaComponent — formulario de alta de un usuario (`/admin/usuarios/nuevo`): email,
 * nombre, contraseña inicial y rol. El email repetido (`409`) se muestra en el campo email.
 */
@Component({
  selector: 'app-usuario-alta',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './usuario-alta.component.html',
  styleUrl: './usuario-alta.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioAltaComponent {
  /** Formulario, para llevar el foco al primer campo con error. */
  private readonly formRef = viewChild.required<ElementRef<HTMLFormElement>>('formRef');

  /** Error general, que recibe el foco si no hay ningún campo con error. */
  private readonly errorRef = viewChild<ElementRef<HTMLElement>>('errorRef');

  /** Indica si se está enviando el usuario. */
  protected readonly enviando = signal(false);

  /** Error general devuelto por el servidor (errores sin campo, estados no previstos…). */
  protected readonly errorGeneral = signal<ProblemDetail | undefined>(undefined);

  /** Errores del servidor que no corresponden a ningún campo del formulario. */
  protected readonly erroresSinCampo = signal<ErrorCampo[]>([]);

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly usuariosService = inject(UsuariosService);

  /** Ruta del listado de usuarios, para la plantilla. */
  protected readonly rutaUsuarios = RUTA_USUARIOS_ADMIN;

  /** Roles disponibles con su texto, para el selector. */
  protected readonly roles = Object.entries(NOMBRE_ROL) as [Rol, string][];

  /** Límites del contrato, para la plantilla. */
  protected readonly limites = {
    email: MAX_EMAIL,
    nombre: MAX_NOMBRE_USUARIO,
    passwordMin: MIN_PASSWORD,
    passwordMax: MAX_PASSWORD,
  } as const;

  /** Mensaje si la contraseña supera el límite, para la plantilla. */
  protected readonly mensajePasswordLarga = MENSAJE_PASSWORD_LARGA;

  /** Formulario del usuario nuevo. */
  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email, Validators.maxLength(MAX_EMAIL)]),
    nombre: this.fb.control('', [
      Validators.required,
      textoNoEnBlancoValidator,
      Validators.maxLength(MAX_NOMBRE_USUARIO),
    ]),
    password: this.fb.control('', [
      Validators.required,
      Validators.minLength(MIN_PASSWORD),
      Validators.maxLength(MAX_PASSWORD),
      passwordBytesValidator,
    ]),
    rol: this.fb.control<Rol>('USER', [Validators.required]),
  });

  /**
   * Indica si hay que mostrar los errores de un campo (tocado o modificado e inválido).
   *
   * @param campo Nombre del control.
   */
  mostrarError(campo: CampoAlta): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  /**
   * Valida y envía el usuario nuevo. Si va bien, vuelve al listado con un aviso; si no,
   * muestra los errores en los campos o en un mensaje general y lleva el foco al primero.
   */
  guardar(): void {
    if (this.enviando()) {
      return;
    }
    this.errorGeneral.set(undefined);
    this.erroresSinCampo.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    const { email, nombre, password, rol } = this.form.getRawValue();
    const peticion: UsuarioNuevoRequest = { email: email.trim(), nombre: nombre.trim(), password, rol };
    this.enviando.set(true);
    this.usuariosService
      .crear(peticion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (usuario) => {
          this.enviando.set(false);
          void this.router.navigate([RUTA_USUARIOS_ADMIN], {
            state: { [CLAVE_AVISO]: avisoUsuarioCreado(usuario.nombre) },
          });
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          this.mostrarErroresServidor(aProblemDetail(err));
          this.enfocarPrimerError();
        },
      });
  }

  private mostrarErroresServidor(problema: ProblemDetail): void {
    if (problema.status === 409) {
      const email = this.form.controls.email;
      email.setErrors({ ...email.errors, emailRepetido: MENSAJE_EMAIL_REPETIDO });
      email.markAsTouched();
      return;
    }
    const errores = problema.errores ?? [];
    const sinCampo: ErrorCampo[] = [];
    for (const error of errores) {
      if (this.esCampo(error.campo)) {
        const control = this.form.controls[error.campo];
        control.setErrors({ ...control.errors, servidor: error.mensaje });
        control.markAsTouched();
      } else {
        sinCampo.push(error);
      }
    }
    this.erroresSinCampo.set(sinCampo);
    if (errores.length === 0 || sinCampo.length > 0) {
      this.errorGeneral.set(problema);
    }
  }

  private esCampo(campo: string): campo is CampoAlta {
    return (CAMPOS as readonly string[]).includes(campo);
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
