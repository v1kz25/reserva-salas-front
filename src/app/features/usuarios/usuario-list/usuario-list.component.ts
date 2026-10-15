import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
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
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, finalize, map, merge, of, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { UsuarioAdmin } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { UsuariosService } from '../../../core/services/usuarios.service';
import { DialogoConfirmacionComponent } from '../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component';
import { leerAviso, limpiarAvisoDelHistorial } from '../../../shared/utils/aviso-navegacion';
import { focoPerdido } from '../../../shared/utils/foco';
import {
  MENSAJE_CAMBIO_PROPIO_RECHAZADO,
  MENSAJE_NO_DESACTIVARSE,
  MENSAJE_RECARGA_FALLIDA,
  MENSAJE_USUARIO_YA_NO_EXISTE,
  NOMBRE_ROL,
  RUTA_USUARIOS_ADMIN,
  avisoUsuarioActivado,
  formatearFechaAlta,
} from '../usuario-mensajes';

/** Usuario del listado con los textos ya preparados para la tabla. */
interface FilaUsuario {
  /** Usuario tal y como lo devuelve la API. */
  usuario: UsuarioAdmin;
  /** Texto del rol. */
  rol: string;
  /** Fecha de alta legible. */
  fechaAlta: string;
  /** Indica si es el usuario en sesión. */
  propio: boolean;
}

/**
 * UsuarioListComponent — listado de usuarios para administradores, con acceso a crear y
 * editar y con activación o desactivación tras confirmarla en un diálogo. El administrador
 * en sesión no puede desactivarse a sí mismo.
 */
@Component({
  selector: 'app-usuario-list',
  imports: [RouterLink, DialogoConfirmacionComponent],
  templateUrl: './usuario-list.component.html',
  styleUrl: './usuario-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioListComponent {
  /** Título de la página, que recibe el foco si el elemento enfocado desaparece. */
  private readonly tituloRef = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Usuarios del listado. */
  protected readonly usuarios = signal<UsuarioAdmin[]>([]);

  /** Indica si se están cargando los usuarios. */
  protected readonly cargando = signal(true);

  /** Mensaje de error al cargar los usuarios, si lo hay. */
  protected readonly error = signal<string | undefined>(undefined);

  /** Usuario pendiente de confirmar su activación o desactivación (diálogo abierto), si lo hay. */
  protected readonly usuarioACambiar = signal<UsuarioAdmin | undefined>(undefined);

  /** Indica si se está enviando la activación o desactivación. */
  protected readonly cambiando = signal(false);

  /** Mensaje de éxito (alta, modificación, activación o desactivación), si lo hay. */
  protected readonly aviso = signal<string | undefined>(undefined);

  /** Mensaje de error al activar o desactivar un usuario, si lo hay. */
  protected readonly errorCambio = signal<string | undefined>(undefined);

  /** Aviso si falla la recarga silenciosa del listado (se conservan los usuarios mostrados). */
  protected readonly errorRecarga = signal<string | undefined>(undefined);

  /** Filas de la tabla, con los textos preparados y la marca del usuario en sesión. */
  protected readonly filas = computed<FilaUsuario[]>(() => {
    const idPropio = this.sesion.usuario()?.id;
    return this.usuarios().map((usuario) => ({
      usuario,
      rol: NOMBRE_ROL[usuario.rol],
      fechaAlta: formatearFechaAlta(usuario.fechaCreacion),
      propio: usuario.id === idPropio,
    }));
  });

  /** Título del diálogo según la acción pendiente. */
  protected readonly tituloDialogo = computed(() =>
    this.usuarioACambiar()?.activo === false ? 'Activar usuario' : 'Desactivar usuario',
  );

  /** Texto del botón de confirmar del diálogo según la acción pendiente. */
  protected readonly textoConfirmarDialogo = computed(() =>
    this.usuarioACambiar()?.activo === false ? 'Sí, activarlo' : 'Sí, desactivarlo',
  );

  private readonly usuariosService = inject(UsuariosService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Ruta del alta de usuarios, para la plantilla. */
  protected readonly rutaNuevo = `${RUTA_USUARIOS_ADMIN}/nuevo`;

  /** Ruta del listado de usuarios, para la plantilla. */
  protected readonly rutaUsuarios = RUTA_USUARIOS_ADMIN;

  /** Explicación de por qué el administrador no puede desactivarse, para la plantilla. */
  protected readonly mensajeNoDesactivarse = MENSAJE_NO_DESACTIVARSE;

  /** Peticiones de recarga del listado sin mostrar el estado de carga (tras un cambio). */
  private readonly recarga = new Subject<void>();

  constructor() {
    this.aviso.set(leerAviso(this.router.getCurrentNavigation()?.extras.state));
    if (this.aviso()) {
      // Se limpia tras el primer render, cuando el router ya ha actualizado la entrada del historial.
      afterNextRender(() => {
        const historial = this.document.defaultView?.history;
        if (historial) {
          limpiarAvisoDelHistorial(historial);
        }
      });
    }

    merge(of(false), this.recarga.pipe(map(() => true)))
      .pipe(
        switchMap((silenciosa) => {
          this.errorRecarga.set(undefined);
          if (!silenciosa) {
            this.cargando.set(true);
            this.error.set(undefined);
          }
          return this.usuariosService.listar().pipe(
            catchError((err: unknown) => {
              const problema = aProblemDetail(err);
              if (silenciosa) {
                // Se conserva el listado actual y solo se avisa de que puede no estar al día.
                this.errorRecarga.set(MENSAJE_RECARGA_FALLIDA);
                return of(this.usuarios());
              }
              this.error.set(problema.detail ?? problema.title);
              return of<UsuarioAdmin[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((usuarios) => {
        this.usuarios.set(usuarios);
        this.cargando.set(false);
      });
  }

  /**
   * Abre el diálogo de confirmación para activar o desactivar un usuario. No hace nada si
   * es el usuario en sesión (no puede desactivarse a sí mismo) o si ya hay un cambio en curso.
   *
   * @param usuario Usuario que se quiere activar o desactivar.
   */
  pedirCambioEstado(usuario: UsuarioAdmin): void {
    if (this.cambiando() || this.esPropio(usuario)) {
      return;
    }
    this.aviso.set(undefined);
    this.errorCambio.set(undefined);
    this.usuarioACambiar.set(usuario);
  }

  /**
   * Cierra el diálogo de confirmación sin hacer cambios.
   */
  cerrarDialogo(): void {
    this.usuarioACambiar.set(undefined);
  }

  /**
   * Envía la activación o desactivación confirmada (`PUT /api/usuarios/{id}` con el resto de
   * datos sin cambios). Si va bien, actualiza la fila y recarga el listado; si el servidor
   * lo rechaza (`409`, desactivarse a sí mismo) o el usuario ya no existe (`404`), lo indica
   * y recarga el listado. Mientras hay un cambio en curso se ignoran nuevas confirmaciones.
   */
  confirmarCambioEstado(): void {
    const usuario = this.usuarioACambiar();
    if (!usuario || this.cambiando()) {
      return;
    }
    this.cambiando.set(true);
    this.usuariosService
      .modificar(usuario.id, { nombre: usuario.nombre, rol: usuario.rol, activo: !usuario.activo })
      .pipe(
        finalize(() => this.cambiando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (modificado) => {
          this.cerrarDialogo();
          this.usuarios.update((usuarios) => usuarios.map((u) => (u.id === modificado.id ? modificado : u)));
          this.aviso.set(avisoUsuarioActivado(modificado.nombre, modificado.activo));
          this.recarga.next();
          this.recuperarFoco();
        },
        error: (err: unknown) => {
          const problema = aProblemDetail(err);
          this.cerrarDialogo();
          if (problema.status === 409) {
            this.errorCambio.set(problema.detail ?? MENSAJE_CAMBIO_PROPIO_RECHAZADO);
            this.recarga.next();
          } else if (problema.status === 404) {
            this.usuarios.update((usuarios) => usuarios.filter((u) => u.id !== usuario.id));
            this.errorCambio.set(MENSAJE_USUARIO_YA_NO_EXISTE);
            this.recarga.next();
          } else {
            this.errorCambio.set(problema.detail ?? problema.title);
          }
          this.recuperarFoco();
        },
      });
  }

  private esPropio(usuario: UsuarioAdmin): boolean {
    return usuario.id === this.sesion.usuario()?.id;
  }

  /** Si el foco se ha perdido (fila eliminada o diálogo cerrado), lo lleva al título. */
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
