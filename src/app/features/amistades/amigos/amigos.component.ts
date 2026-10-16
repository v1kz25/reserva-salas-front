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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  merge,
  of,
  switchMap,
  timer,
} from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { Amigo, SolicitudAmistad, UsuarioResumen } from '../../../core/models/amistad.model';
import { AmistadesService } from '../../../core/services/amistades.service';
import { DialogoConfirmacionComponent } from '../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component';
import { FechaLargaPipe } from '../../../shared/pipes/fecha-larga.pipe';
import { focoPerdido } from '../../../shared/utils/foco';
import {
  ESPERA_BUSQUEDA_MS,
  MAX_BUSQUEDA,
  MENSAJE_AMISTAD_NO_EXISTE,
  MENSAJE_RECARGA_FALLIDA,
  MENSAJE_SOLICITUD_NO_PENDIENTE,
  MIN_BUSQUEDA,
  avisoAmistadEliminada,
  avisoSolicitudAceptada,
  avisoSolicitudEnviada,
  avisoSolicitudRechazada,
  avisoSolicitudRetirada,
  mensajeSolicitudDuplicada,
  mensajeUsuarioNoDisponible,
} from '../amistades-mensajes';

/** Listas de la pantalla, que se cargan juntas. */
interface Listas {
  /** Solicitudes pendientes recibidas. */
  recibidas: SolicitudAmistad[];
  /** Solicitudes pendientes enviadas. */
  enviadas: SolicitudAmistad[];
  /** Amistades confirmadas. */
  amigos: Amigo[];
}

/** Resultado de una búsqueda de usuarios. */
interface Busqueda {
  /** Texto buscado (ya recortado). */
  termino: string;
  /** Usuarios encontrados. */
  usuarios: UsuarioResumen[];
}

/**
 * Relación del usuario en sesión con una persona encontrada en el buscador:
 *
 * - `disponible`: se le puede enviar una solicitud.
 * - `enviada`: ya hay una solicitud pendiente enviada por el usuario.
 * - `recibida`: esa persona ya ha enviado una solicitud al usuario.
 * - `amigo`: ya sois amigos.
 */
export type RelacionUsuario = 'disponible' | 'enviada' | 'recibida' | 'amigo';

/** Persona encontrada en el buscador, con su relación con el usuario en sesión. */
interface ResultadoBusqueda {
  /** Persona encontrada. */
  usuario: UsuarioResumen;
  /** Relación con el usuario en sesión. */
  relacion: RelacionUsuario;
}

/**
 * Id del botón «Solicitud enviada» de una persona del buscador.
 *
 * @param usuarioId Identificador de la persona.
 */
export function idSolicitudEnviada(usuarioId: number): string {
  return `solicitud-enviada-${usuarioId}`;
}

/** Sección de la pantalla, para llevar el foco a su título. */
type Seccion = 'recibidas' | 'enviadas' | 'amigos';

/**
 * AmigosComponent — pantalla «Amigos»: buscador de personas para enviarles solicitudes de
 * amistad, solicitudes recibidas (aceptar o rechazar), solicitudes enviadas (retirar) y lista
 * de amigos (eliminar, tras confirmarlo en un diálogo).
 *
 * Tras cada acción, las listas se recargan sin refrescar la página y se avisa en una región
 * `role="status"`. Mientras hay una acción en curso se ignoran las demás.
 */
@Component({
  selector: 'app-amigos',
  imports: [ReactiveFormsModule, DialogoConfirmacionComponent, FechaLargaPipe],
  templateUrl: './amigos.component.html',
  styleUrl: './amigos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmigosComponent {
  /** Título de «Solicitudes recibidas», que recibe el foco si se pierde al quitar una fila. */
  private readonly tituloRecibidas = viewChild<ElementRef<HTMLHeadingElement>>('tituloRecibidas');

  /** Título de «Solicitudes enviadas», que recibe el foco si se pierde al quitar una fila. */
  private readonly tituloEnviadas = viewChild<ElementRef<HTMLHeadingElement>>('tituloEnviadas');

  /** Título de «Amigos», que recibe el foco si se pierde al quitar una fila. */
  private readonly tituloAmigos = viewChild<ElementRef<HTMLHeadingElement>>('tituloAmigos');

  /** Campo de búsqueda, que recibe el foco al reintentar una búsqueda fallida. */
  private readonly campoBusqueda = viewChild.required<ElementRef<HTMLInputElement>>('campoBusqueda');

  /** Título de la página, que recibe el foco si no se puede llevar a una sección. */
  private readonly tituloPagina = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloPagina');

  /** Solicitudes pendientes recibidas. */
  protected readonly recibidas = signal<SolicitudAmistad[]>([]);

  /** Solicitudes pendientes enviadas. */
  protected readonly enviadas = signal<SolicitudAmistad[]>([]);

  /** Amistades confirmadas. */
  protected readonly amigos = signal<Amigo[]>([]);

  /** Indica si se están cargando las listas por primera vez. */
  protected readonly cargando = signal(true);

  /** Mensaje de error al cargar las listas, si lo hay. */
  protected readonly error = signal<string | undefined>(undefined);

  /** Aviso si falla la recarga silenciosa de las listas (se conservan las mostradas). */
  protected readonly errorRecarga = signal<string | undefined>(undefined);

  /** Última búsqueda completada; `undefined` si el texto tiene menos de 2 caracteres. */
  protected readonly busqueda = signal<Busqueda | undefined>(undefined);

  /** Indica si hay una búsqueda en curso (incluida la espera de 300 ms). */
  protected readonly buscando = signal(false);

  /** Mensaje de error de la búsqueda, si lo hay. */
  protected readonly errorBusqueda = signal<string | undefined>(undefined);

  /** Clave de la acción en curso (p. ej. `aceptar-5`), si la hay. */
  protected readonly accionEnCurso = signal<string | undefined>(undefined);

  /** Mensaje de éxito de la última acción, si lo hay. */
  protected readonly aviso = signal<string | undefined>(undefined);

  /** Mensaje de error de la última acción, si lo hay. */
  protected readonly errorAccion = signal<string | undefined>(undefined);

  /** Amigo pendiente de confirmar la eliminación de la amistad (diálogo abierto), si lo hay. */
  protected readonly amigoAEliminar = signal<Amigo | undefined>(undefined);

  private readonly amistades = inject(AmistadesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Resultados de la búsqueda con la relación de cada persona con el usuario en sesión. */
  protected readonly resultados = computed<ResultadoBusqueda[]>(() => {
    const busqueda = this.busqueda();
    if (!busqueda) {
      return [];
    }
    const amigos = new Set(this.amigos().map((amigo) => amigo.usuarioId));
    const enviadas = new Set(this.enviadas().map((solicitud) => solicitud.usuario.id));
    const recibidas = new Set(this.recibidas().map((solicitud) => solicitud.usuario.id));
    return busqueda.usuarios.map((usuario) => ({
      usuario,
      relacion: amigos.has(usuario.id)
        ? 'amigo'
        : enviadas.has(usuario.id)
          ? 'enviada'
          : recibidas.has(usuario.id)
            ? 'recibida'
            : 'disponible',
    }));
  });

  /** Campo de búsqueda por nombre. */
  protected readonly termino = new FormControl('', { nonNullable: true });

  /** Número mínimo de caracteres para buscar, para la plantilla. */
  protected readonly minBusqueda = MIN_BUSQUEDA;

  /** Id del botón «Solicitud enviada» de una persona, para la plantilla. */
  protected readonly idSolicitudEnviada = idSolicitudEnviada;

  /** Número máximo de caracteres de la búsqueda, para la plantilla. */
  protected readonly maxBusqueda = MAX_BUSQUEDA;

  /** Peticiones de recarga de las listas sin mostrar el estado de carga (tras una acción). */
  private readonly recarga = new Subject<void>();

  /** Peticiones de repetir la búsqueda actual tras un error. */
  private readonly reintento = new Subject<void>();

  /** Indica si la última búsqueda falló, para permitir repetirla con el mismo texto. */
  private busquedaFallida = false;

  constructor() {
    this.cargarListas();
    this.escucharBusqueda();
  }

  /**
   * Envía una solicitud de amistad a una persona del buscador. Si ya sois amigos o ya hay una
   * solicitud pendiente (`409`), o la persona ya no está disponible (`404`), lo indica y
   * recarga las listas.
   *
   * @param usuario Persona a la que se envía la solicitud.
   */
  enviarSolicitud(usuario: UsuarioResumen): void {
    if (!this.empezarAccion(`enviar-${usuario.id}`)) {
      return;
    }
    this.ejecutar(this.amistades.enviarSolicitud(usuario.id), {
      exito: (solicitud) => {
        this.enviadas.update((enviadas) => [solicitud, ...enviadas.filter((s) => s.id !== solicitud.id)]);
        this.aviso.set(avisoSolicitudEnviada(usuario.nombre));
      },
      errores: {
        409: mensajeSolicitudDuplicada(usuario.nombre),
        404: mensajeUsuarioNoDisponible(usuario.nombre),
      },
      idFoco: idSolicitudEnviada(usuario.id),
    });
  }

  /**
   * Acepta una solicitud recibida. Si ya no está pendiente (`404`), lo indica y recarga.
   *
   * @param solicitud Solicitud que se acepta.
   */
  aceptar(solicitud: SolicitudAmistad): void {
    if (!this.empezarAccion(`aceptar-${solicitud.id}`)) {
      return;
    }
    this.ejecutar(this.amistades.aceptarSolicitud(solicitud.id), {
      exito: () => {
        this.quitarRecibida(solicitud.id);
        this.aviso.set(avisoSolicitudAceptada(solicitud.usuario.nombre));
      },
      errores: { 404: MENSAJE_SOLICITUD_NO_PENDIENTE },
      alNoEncontrar: () => this.quitarRecibida(solicitud.id),
      seccion: 'recibidas',
    });
  }

  /**
   * Rechaza una solicitud recibida. Si ya no está pendiente (`404`), lo indica y recarga.
   *
   * @param solicitud Solicitud que se rechaza.
   */
  rechazar(solicitud: SolicitudAmistad): void {
    if (!this.empezarAccion(`rechazar-${solicitud.id}`)) {
      return;
    }
    this.ejecutar(this.amistades.rechazarSolicitud(solicitud.id), {
      exito: () => {
        this.quitarRecibida(solicitud.id);
        this.aviso.set(avisoSolicitudRechazada(solicitud.usuario.nombre));
      },
      errores: { 404: MENSAJE_SOLICITUD_NO_PENDIENTE },
      alNoEncontrar: () => this.quitarRecibida(solicitud.id),
      seccion: 'recibidas',
    });
  }

  /**
   * Retira una solicitud enviada. Si ya no está pendiente (`404`), lo indica y recarga.
   *
   * @param solicitud Solicitud que se retira.
   */
  retirar(solicitud: SolicitudAmistad): void {
    if (!this.empezarAccion(`retirar-${solicitud.id}`)) {
      return;
    }
    this.ejecutar(this.amistades.retirarSolicitud(solicitud.id), {
      exito: () => {
        this.quitarEnviada(solicitud.id);
        this.aviso.set(avisoSolicitudRetirada(solicitud.usuario.nombre));
      },
      errores: { 404: MENSAJE_SOLICITUD_NO_PENDIENTE },
      alNoEncontrar: () => this.quitarEnviada(solicitud.id),
      seccion: 'enviadas',
    });
  }

  /**
   * Abre el diálogo de confirmación para eliminar una amistad.
   *
   * @param amigo Amigo que se quiere eliminar.
   */
  pedirEliminacion(amigo: Amigo): void {
    if (this.accionEnCurso()) {
      return;
    }
    this.aviso.set(undefined);
    this.errorAccion.set(undefined);
    this.amigoAEliminar.set(amigo);
  }

  /**
   * Cierra el diálogo de confirmación sin eliminar la amistad.
   */
  cerrarDialogo(): void {
    this.amigoAEliminar.set(undefined);
  }

  /**
   * Elimina la amistad confirmada en el diálogo. Si ya no erais amigos (`404`), lo indica y
   * recarga.
   */
  confirmarEliminacion(): void {
    const amigo = this.amigoAEliminar();
    if (!amigo || !this.empezarAccion(`eliminar-${amigo.usuarioId}`)) {
      return;
    }
    this.ejecutar(this.amistades.eliminarAmistad(amigo.usuarioId), {
      exito: () => {
        this.quitarAmigo(amigo.usuarioId);
        this.aviso.set(avisoAmistadEliminada(amigo.nombre));
      },
      errores: { 404: MENSAJE_AMISTAD_NO_EXISTE },
      alNoEncontrar: () => this.quitarAmigo(amigo.usuarioId),
      alTerminar: () => this.cerrarDialogo(),
      seccion: 'amigos',
    });
  }

  /**
   * Repite la búsqueda que ha fallado, con el texto actual, y devuelve el foco al campo.
   */
  reintentarBusqueda(): void {
    this.campoBusqueda().nativeElement.focus();
    this.reintento.next();
  }

  /**
   * Indica si una acción concreta está en curso, para marcar su botón.
   *
   * @param clave Clave de la acción (p. ej. `aceptar-5`).
   */
  enCurso(clave: string): boolean {
    return this.accionEnCurso() === clave;
  }

  /** Carga las tres listas al abrir la pantalla y las recarga en silencio tras cada acción. */
  private cargarListas(): void {
    merge(of(false), this.recarga.pipe(map(() => true)))
      .pipe(
        switchMap((silenciosa) => {
          this.errorRecarga.set(undefined);
          if (!silenciosa) {
            this.cargando.set(true);
            this.error.set(undefined);
          }
          return forkJoin({
            recibidas: this.amistades.listarRecibidas(),
            enviadas: this.amistades.listarEnviadas(),
            amigos: this.amistades.listarAmigos(),
          }).pipe(
            catchError((err: unknown) => {
              if (silenciosa) {
                this.errorRecarga.set(MENSAJE_RECARGA_FALLIDA);
                return of(undefined);
              }
              const problema = aProblemDetail(err);
              this.error.set(problema.detail ?? problema.title);
              return of(undefined);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((listas?: Listas) => {
        if (listas) {
          this.recibidas.set(listas.recibidas);
          this.enviadas.set(listas.enviadas);
          this.amigos.set(listas.amigos);
        }
        this.cargando.set(false);
      });
  }

  /**
   * Busca personas mientras se escribe: solo busca el último texto tras 300 ms sin
   * pulsaciones (cada pulsación reinicia la espera y cancela la búsqueda anterior), no lo
   * repite si no ha cambiado (salvo tras un error, o con «Reintentar») y, con menos de 2
   * caracteres, no busca y limpia los resultados al momento.
   */
  private escucharBusqueda(): void {
    const textos = this.termino.valueChanges.pipe(
      map((valor) => valor.trim()),
      // Tras un error se deja pasar el mismo texto, para poder repetir la búsqueda.
      distinctUntilChanged((anterior, actual) => anterior === actual && !this.busquedaFallida),
    );
    merge(textos, this.reintento.pipe(map(() => this.termino.value.trim())))
      .pipe(
        switchMap((termino) => {
          this.busquedaFallida = false;
          this.errorBusqueda.set(undefined);
          if (termino.length < MIN_BUSQUEDA) {
            // Sin espera ni petición: se cancela la búsqueda en curso y se limpian los resultados.
            this.buscando.set(false);
            return of(undefined);
          }
          this.buscando.set(true);
          // Cada pulsación cancela la espera anterior (`switchMap`): solo se busca el último texto.
          return timer(ESPERA_BUSQUEDA_MS).pipe(
            switchMap(() => this.amistades.buscarUsuarios(termino)),
            map((usuarios): Busqueda => ({ termino, usuarios })),
            catchError((err: unknown) => {
              const problema = aProblemDetail(err);
              this.busquedaFallida = true;
              this.errorBusqueda.set(problema.detail ?? problema.title);
              return of(undefined);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((busqueda) => {
        this.busqueda.set(busqueda);
        this.buscando.set(false);
      });
  }

  /**
   * Marca una acción como en curso y limpia los mensajes anteriores.
   *
   * @returns `false` si ya había otra acción en curso.
   */
  private empezarAccion(clave: string): boolean {
    if (this.accionEnCurso()) {
      return false;
    }
    this.accionEnCurso.set(clave);
    this.aviso.set(undefined);
    this.errorAccion.set(undefined);
    return true;
  }

  /**
   * Ejecuta una acción, muestra su aviso o su error, recarga las listas y recupera el foco
   * si se ha perdido.
   */
  private ejecutar<T>(
    peticion: Observable<T>,
    opciones: {
      exito: (respuesta: T) => void;
      errores: Partial<Record<number, string>>;
      alNoEncontrar?: () => void;
      alTerminar?: () => void;
      seccion?: Seccion;
      idFoco?: string;
    },
  ): void {
    peticion
      .pipe(
        finalize(() => this.accionEnCurso.set(undefined)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (respuesta) => {
          opciones.alTerminar?.();
          opciones.exito(respuesta);
          this.recarga.next();
          this.recuperarFoco(opciones.seccion, opciones.idFoco);
        },
        error: (err: unknown) => {
          opciones.alTerminar?.();
          const problema = aProblemDetail(err);
          const mensaje = opciones.errores[problema.status];
          if (mensaje) {
            if (problema.status === 404) {
              opciones.alNoEncontrar?.();
            }
            this.errorAccion.set(mensaje);
            this.recarga.next();
          } else {
            this.errorAccion.set(problema.detail ?? problema.title);
          }
          this.recuperarFoco(opciones.seccion, opciones.idFoco);
        },
      });
  }

  private quitarRecibida(id: number): void {
    this.recibidas.update((recibidas) => recibidas.filter((solicitud) => solicitud.id !== id));
  }

  private quitarEnviada(id: number): void {
    this.enviadas.update((enviadas) => enviadas.filter((solicitud) => solicitud.id !== id));
  }

  private quitarAmigo(usuarioId: number): void {
    this.amigos.update((amigos) => amigos.filter((amigo) => amigo.usuarioId !== usuarioId));
  }

  /**
   * Si el foco se ha perdido (fila quitada, botón sustituido o diálogo cerrado), lo lleva al
   * elemento indicado (por ejemplo, el botón «Solicitud enviada») si existe; si no, al título
   * de la sección o, en último caso, al de la página.
   */
  private recuperarFoco(seccion?: Seccion, idFoco?: string): void {
    afterNextRender(
      () => {
        const documento = this.tituloPagina().nativeElement.ownerDocument;
        if (!focoPerdido(documento)) {
          return;
        }
        const titulos = {
          recibidas: this.tituloRecibidas(),
          enviadas: this.tituloEnviadas(),
          amigos: this.tituloAmigos(),
        };
        const destino =
          (idFoco ? documento.getElementById(idFoco) : null) ??
          (seccion ? titulos[seccion] : undefined)?.nativeElement ??
          this.tituloPagina().nativeElement;
        destino.focus();
      },
      { injector: this.injector },
    );
  }
}
