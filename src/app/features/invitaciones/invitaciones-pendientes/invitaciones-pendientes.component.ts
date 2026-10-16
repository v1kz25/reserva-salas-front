import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, finalize, map, merge, of, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { InvitacionRecibida } from '../../../core/models/invitacion.model';
import { Sala } from '../../../core/models/sala.model';
import { InvitacionesService } from '../../../core/services/invitaciones.service';
import { HoraPipe } from '../../../shared/pipes/hora.pipe';
import { focoPerdido } from '../../../shared/utils/foco';
import {
  AVISO_INVITACION_ACEPTADA,
  AVISO_INVITACION_RECHAZADA,
  MENSAJE_INVITACION_NO_EXISTE,
  MENSAJE_RECARGA_INVITACIONES_FALLIDA,
  mensajeRespuestaNoPosible,
} from '../invitaciones-mensajes';

/**
 * InvitacionesPendientesComponent — sección «Pendientes de responder» con las invitaciones a
 * reservas que el usuario aún no ha respondido, cada una con «Aceptar» y «Rechazar».
 *
 * - Marca como «Nueva» (con texto, no solo con color) las que el usuario no había visto antes.
 *   Quedan guardadas como vistas en cuanto se muestran, pero la marca se mantiene mientras
 *   sigan en esta pantalla.
 * - Tras cada respuesta, quita la invitación, avisa en una región `role="status"`, recarga la
 *   lista sin refrescar la página y emite `respondida` para que la pantalla actualice lo suyo.
 * - Mientras hay una respuesta en curso se ignoran las demás.
 * - Con `ocultarSiVacia`, no muestra nada si no hay invitaciones (ni mientras carga).
 * - Sin `datos`, carga ella misma todas las pendientes (`GET /api/invitaciones/pendientes`). Con
 *   `datos` (por ejemplo, una página de «Mis reservas» con `rol=PENDIENTE`), muestra esas y es
 *   la pantalla quien las carga y las recarga al recibir `respondida`.
 */
@Component({
  selector: 'app-invitaciones-pendientes',
  imports: [RouterLink, DatePipe, HoraPipe],
  templateUrl: './invitaciones-pendientes.component.html',
  styleUrl: './invitaciones-pendientes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitacionesPendientesComponent implements OnInit {
  /** Título de la sección, que recibe el foco si se pierde al quitar una invitación. */
  private readonly tituloRef = viewChild<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Salas conocidas, para mostrar su nombre en lugar del id. */
  readonly salas = input<Sala[]>([]);

  /** Si es `true`, la sección no se muestra cuando no hay invitaciones pendientes. */
  readonly ocultarSiVacia = input(false);

  /**
   * Invitaciones que muestra, si las carga la pantalla. Sin este input, el componente pide
   * todas las pendientes por su cuenta.
   */
  readonly datos = input<InvitacionRecibida[]>();

  /** Emite tras aceptar o rechazar una invitación (o si ya no se podía responder). */
  readonly respondida = output<void>();

  /** Invitaciones pendientes mostradas. */
  protected readonly invitaciones = signal<InvitacionRecibida[]>([]);

  /** Indica si se está cargando la lista por primera vez. */
  protected readonly cargando = signal(true);

  /** Mensaje de error al cargar la lista, si lo hay. */
  protected readonly error = signal<string | undefined>(undefined);

  /** Aviso si falla la recarga silenciosa (se conserva la lista mostrada). */
  protected readonly errorRecarga = signal<string | undefined>(undefined);

  /** Clave de la acción en curso (p. ej. `aceptar-5`), si la hay. */
  protected readonly accionEnCurso = signal<string | undefined>(undefined);

  /** Mensaje de éxito de la última respuesta, si lo hay. */
  protected readonly aviso = signal<string | undefined>(undefined);

  /** Mensaje de error de la última respuesta, si lo hay. */
  protected readonly errorAccion = signal<string | undefined>(undefined);

  /** Ids de las invitaciones que eran nuevas al mostrarse en esta pantalla. */
  protected readonly nuevas = signal<ReadonlySet<number>>(new Set());

  private readonly servicio = inject(InvitacionesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Nombre de cada sala indexado por su id. */
  protected readonly nombresSala = computed(() => new Map(this.salas().map((sala) => [sala.id, sala.nombre])));

  /** Indica si la sección se muestra. */
  protected readonly visible = computed(
    () =>
      !this.ocultarSiVacia() ||
      this.invitaciones().length > 0 ||
      this.errorAccion() !== undefined ||
      this.aviso() !== undefined,
  );

  /** Peticiones de recarga de la lista sin mostrar el estado de carga (tras una respuesta). */
  private readonly recarga = new Subject<void>();

  constructor() {
    effect(() => {
      const datos = this.datos();
      if (datos) {
        untracked(() => {
          this.invitaciones.set(datos);
          this.cargando.set(false);
          this.anotarNuevas(datos, false);
        });
      }
    });
  }

  ngOnInit(): void {
    if (this.datos() === undefined) {
      this.cargarLista();
    }
  }

  /**
   * Nombre de la sala, o «Sala N» si no se conoce.
   *
   * @param salaId Identificador de la sala.
   */
  nombreSala(salaId: number): string {
    return this.nombresSala().get(salaId) ?? `Sala ${salaId}`;
  }

  /**
   * Lleva el foco al título de la sección, si se muestra (por ejemplo, tras cambiar de página).
   */
  enfocarTitulo(): void {
    this.tituloRef()?.nativeElement.focus();
  }

  /**
   * Indica si una acción concreta está en curso, para marcar su botón.
   *
   * @param clave Clave de la acción (p. ej. `aceptar-5`).
   */
  enCurso(clave: string): boolean {
    return this.accionEnCurso() === clave;
  }

  /**
   * Acepta una invitación pendiente.
   *
   * @param invitacion Invitación que se acepta.
   */
  aceptar(invitacion: InvitacionRecibida): void {
    this.responder(`aceptar-${invitacion.id}`, invitacion, this.servicio.aceptar(invitacion.id), AVISO_INVITACION_ACEPTADA);
  }

  /**
   * Rechaza una invitación pendiente.
   *
   * @param invitacion Invitación que se rechaza.
   */
  rechazar(invitacion: InvitacionRecibida): void {
    this.responder(
      `rechazar-${invitacion.id}`,
      invitacion,
      this.servicio.rechazar(invitacion.id),
      AVISO_INVITACION_RECHAZADA,
    );
  }

  /** Carga la lista al crearse y la recarga en silencio tras cada respuesta. */
  private cargarLista(): void {
    merge(of(false), this.recarga.pipe(map(() => true)))
      .pipe(
        switchMap((silenciosa) => {
          this.errorRecarga.set(undefined);
          if (!silenciosa) {
            this.cargando.set(true);
            this.error.set(undefined);
          }
          return this.servicio.listarPendientes().pipe(
            catchError((err: unknown) => {
              if (silenciosa) {
                this.errorRecarga.set(MENSAJE_RECARGA_INVITACIONES_FALLIDA);
              } else {
                const problema = aProblemDetail(err);
                this.error.set(problema.detail ?? problema.title);
              }
              return of(undefined);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((invitaciones) => {
        if (invitaciones) {
          this.invitaciones.set(invitaciones);
          this.anotarNuevas(invitaciones);
        }
        this.cargando.set(false);
      });
  }

  /**
   * Añade a `nuevas` las invitaciones que el usuario aún no había visto y las guarda como
   * vistas (la marca se mantiene en esta pantalla hasta salir de ella). Solo se guardan si la
   * sección se muestra.
   *
   * @param invitaciones Invitaciones mostradas.
   * @param completa Si son todas las pendientes (se olvidan las vistas que ya no están).
   */
  private anotarNuevas(invitaciones: InvitacionRecibida[], completa = true): void {
    const nuevas = invitaciones.filter((i) => this.servicio.esNueva(i.id)).map((i) => i.id);
    if (nuevas.length > 0) {
      this.nuevas.update((actuales) => new Set([...actuales, ...nuevas]));
    }
    if (this.visible()) {
      this.servicio.marcarVistas(
        invitaciones.map((i) => i.id),
        completa,
      );
    }
  }

  /**
   * Envía una respuesta, muestra su aviso o su error, recarga la lista y recupera el foco si
   * se ha perdido. Si ya hay otra respuesta en curso, no hace nada.
   */
  private responder(clave: string, invitacion: InvitacionRecibida, peticion: Observable<void>, aviso: string): void {
    if (this.accionEnCurso()) {
      return;
    }
    this.accionEnCurso.set(clave);
    this.aviso.set(undefined);
    this.errorAccion.set(undefined);
    peticion
      .pipe(
        finalize(() => this.accionEnCurso.set(undefined)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.quitar(invitacion.id);
          this.aviso.set(aviso);
          this.recargarYAvisar();
        },
        error: (err: unknown) => {
          const problema = aProblemDetail(err);
          if (problema.status === 404 || problema.status === 409) {
            this.quitar(invitacion.id);
            this.errorAccion.set(
              problema.status === 404 ? MENSAJE_INVITACION_NO_EXISTE : mensajeRespuestaNoPosible(problema.detail),
            );
            this.recargarYAvisar();
          } else {
            this.errorAccion.set(problema.detail ?? problema.title);
            this.recuperarFoco();
          }
        },
      });
  }

  private recargarYAvisar(): void {
    if (this.datos() === undefined) {
      this.recarga.next();
    }
    this.respondida.emit();
    this.recuperarFoco();
  }

  private quitar(id: number): void {
    this.invitaciones.update((invitaciones) => invitaciones.filter((i) => i.id !== id));
  }

  /** Si el foco se ha perdido (fila quitada), lo lleva al título de la sección. */
  private recuperarFoco(): void {
    afterNextRender(
      () => {
        const titulo = this.tituloRef()?.nativeElement;
        if (titulo && focoPerdido(titulo.ownerDocument)) {
          titulo.focus();
        }
      },
      { injector: this.injector },
    );
  }
}
