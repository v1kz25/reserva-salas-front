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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, map, switchMap, tap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { ErrorCampo, ProblemDetail } from '../../../core/models/problem-detail.model';
import { Rol, UsuarioAdmin, UsuarioCambioRequest } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { UsuariosService } from '../../../core/services/usuarios.service';
import { CLAVE_AVISO } from '../../../shared/utils/aviso-navegacion';
import { focoPerdido } from '../../../shared/utils/foco';
import { textoNoEnBlancoValidator } from '../../salas/sala-form/sala-form.validators';
import { CambioPasswordComponent } from '../cambio-password/cambio-password.component';
import {
  MENSAJE_CAMBIO_PROPIO_RECHAZADO,
  MENSAJE_NO_DESACTIVARSE,
  MENSAJE_NO_QUITARSE_ADMIN,
  NOMBRE_ROL,
  RUTA_USUARIOS_ADMIN,
  avisoUsuarioModificado,
  formatearFechaAlta,
} from '../usuario-mensajes';
import { MAX_NOMBRE_USUARIO } from '../usuario-validators';

/** Campos del formulario que pueden recibir errores del servidor. */
type CampoEdicion = keyof UsuarioCambioRequest;

const CAMPOS: readonly CampoEdicion[] = ['nombre', 'rol', 'activo'];

/**
 * UsuarioEdicionComponent — edición de un usuario (`/admin/usuarios/:id`): nombre, rol y
 * estado, y en una sección aparte el cambio de contraseña.
 *
 * Si el usuario es el administrador en sesión, el rol y el estado no se pueden cambiar
 * (el servidor respondería `409`): los controles se deshabilitan y se explica el motivo.
 */
@Component({
  selector: 'app-usuario-edicion',
  imports: [ReactiveFormsModule, RouterLink, CambioPasswordComponent],
  templateUrl: './usuario-edicion.component.html',
  styleUrl: './usuario-edicion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioEdicionComponent {
  /** Título de la página, que recibe el foco si el formulario desaparece (usuario no encontrado). */
  private readonly tituloRef = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Formulario, para llevar el foco al primer campo con error. */
  private readonly formRef = viewChild<ElementRef<HTMLFormElement>>('formRef');

  /** Error general, que recibe el foco si no hay ningún campo con error. */
  private readonly errorRef = viewChild<ElementRef<HTMLElement>>('errorRef');

  /** Usuario que se edita, tal y como se cargó. */
  protected readonly usuario = signal<UsuarioAdmin | undefined>(undefined);

  /** Indica si se está cargando el usuario. */
  protected readonly cargando = signal(true);

  /** Indica si el usuario no existe (id no válido o `404`). */
  protected readonly noEncontrado = signal(false);

  /** Mensaje de error al cargar el usuario, si lo hay. */
  protected readonly errorCarga = signal<string | undefined>(undefined);

  /** Indica si se están enviando los cambios. */
  protected readonly enviando = signal(false);

  /** Error general devuelto por el servidor (`409`, errores sin campo, estados no previstos…). */
  protected readonly errorGeneral = signal<ProblemDetail | undefined>(undefined);

  /** Errores del servidor que no corresponden a ningún campo del formulario. */
  protected readonly erroresSinCampo = signal<ErrorCampo[]>([]);

  /** Indica si el usuario que se edita es el administrador en sesión. */
  protected readonly propio = computed(() => {
    const usuario = this.usuario();
    return usuario !== undefined && usuario.id === this.sesion.usuario()?.id;
  });

  /** Fecha de alta legible del usuario que se edita. */
  protected readonly fechaAlta = computed(() => {
    const usuario = this.usuario();
    return usuario ? formatearFechaAlta(usuario.fechaCreacion) : '';
  });

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly usuariosService = inject(UsuariosService);
  private readonly sesion = inject(SesionService);

  /** Ruta del listado de usuarios, para la plantilla. */
  protected readonly rutaUsuarios = RUTA_USUARIOS_ADMIN;

  /** Roles disponibles con su texto, para el selector. */
  protected readonly roles = Object.entries(NOMBRE_ROL) as [Rol, string][];

  /** Longitud máxima del nombre, para el atributo `maxlength`. */
  protected readonly maxNombre = MAX_NOMBRE_USUARIO;

  /** Explicaciones de los controles bloqueados para el propio administrador. */
  protected readonly mensajesPropio = { rol: MENSAJE_NO_QUITARSE_ADMIN, activo: MENSAJE_NO_DESACTIVARSE } as const;

  /** Formulario con los datos modificables del usuario. */
  protected readonly form = this.fb.group({
    nombre: this.fb.control('', [
      Validators.required,
      textoNoEnBlancoValidator,
      Validators.maxLength(MAX_NOMBRE_USUARIO),
    ]),
    rol: this.fb.control<Rol>('USER', [Validators.required]),
    activo: this.fb.control(true),
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) => this.cargar(id)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Indica si hay que mostrar los errores de un campo (tocado o modificado e inválido).
   *
   * @param campo Nombre del control.
   */
  mostrarError(campo: CampoEdicion): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  /**
   * Valida y envía los cambios. Si va bien, vuelve al listado con un aviso (y, si es el
   * propio administrador, actualiza su nombre en la cabecera); si no, muestra los errores
   * en los campos o en un mensaje general.
   */
  guardar(): void {
    const usuario = this.usuario();
    if (this.enviando() || !usuario) {
      return;
    }
    this.errorGeneral.set(undefined);
    this.erroresSinCampo.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    // `getRawValue` incluye el rol y el estado aunque estén deshabilitados (propio administrador).
    const { nombre, rol, activo } = this.form.getRawValue();
    this.enviando.set(true);
    this.usuariosService
      .modificar(usuario.id, { nombre: nombre.trim(), rol, activo })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (modificado) => {
          this.enviando.set(false);
          this.sesion.actualizarDatos(modificado);
          void this.router.navigate([RUTA_USUARIOS_ADMIN], {
            state: { [CLAVE_AVISO]: avisoUsuarioModificado(modificado.nombre) },
          });
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          this.mostrarErroresServidor(aProblemDetail(err));
        },
      });
  }

  /**
   * Marca el usuario como no encontrado (por ejemplo, si el cambio de contraseña responde `404`).
   */
  marcarNoEncontrado(): void {
    this.noEncontrado.set(true);
    this.cargando.set(false);
    this.recuperarFoco();
  }

  /**
   * Carga el usuario de la ruta y rellena el formulario. Si el id no es válido o el usuario
   * no existe, lo indica.
   *
   * @param idRuta Parámetro `id` de la ruta.
   */
  private cargar(idRuta: string | null): Observable<UsuarioAdmin> {
    this.reiniciar();
    const id = idRuta !== null && /^\d+$/.test(idRuta) ? Number(idRuta) : Number.NaN;
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.noEncontrado.set(true);
      this.cargando.set(false);
      return EMPTY;
    }
    return this.usuariosService.obtener(id).pipe(
      tap((usuario) => {
        this.usuario.set(usuario);
        this.form.reset({ nombre: usuario.nombre, rol: usuario.rol, activo: usuario.activo });
        if (this.propio()) {
          this.form.controls.rol.disable();
          this.form.controls.activo.disable();
        }
        this.cargando.set(false);
      }),
      catchError((err: unknown) => {
        const problema = aProblemDetail(err);
        if (problema.status === 404) {
          this.noEncontrado.set(true);
        } else {
          this.errorCarga.set(problema.detail ?? problema.title);
        }
        this.cargando.set(false);
        return EMPTY;
      }),
    );
  }

  private reiniciar(): void {
    this.usuario.set(undefined);
    this.cargando.set(true);
    this.noEncontrado.set(false);
    this.errorCarga.set(undefined);
    this.enviando.set(false);
    this.errorGeneral.set(undefined);
    this.erroresSinCampo.set([]);
    this.form.enable();
    this.form.reset();
  }

  private mostrarErroresServidor(problema: ProblemDetail): void {
    if (problema.status === 404) {
      this.marcarNoEncontrado();
      return;
    }
    if (problema.status === 409) {
      this.errorGeneral.set({ ...problema, detail: problema.detail ?? MENSAJE_CAMBIO_PROPIO_RECHAZADO });
      this.enfocarError();
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
    this.enfocarPrimerError();
  }

  private esCampo(campo: string): campo is CampoEdicion {
    return (CAMPOS as readonly string[]).includes(campo);
  }

  /**
   * Tras el render, lleva el foco al primer campo con error o, si no hay ninguno, al
   * mensaje de error general.
   */
  private enfocarPrimerError(): void {
    afterNextRender(
      () => {
        const campo = this.formRef()?.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
        (campo ?? this.errorRef()?.nativeElement)?.focus();
      },
      { injector: this.injector },
    );
  }

  /** Tras el render, lleva el foco al mensaje de error general. */
  private enfocarError(): void {
    afterNextRender(() => this.errorRef()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Si el foco se ha perdido (el formulario ha desaparecido), lo lleva al título. */
  private recuperarFoco(): void {
    afterNextRender(
      () => {
        const titulo = this.tituloRef().nativeElement;
        if (focoPerdido(titulo.ownerDocument)) {
          titulo.focus();
        }
      },
      { injector: this.injector },
    );
  }
}
