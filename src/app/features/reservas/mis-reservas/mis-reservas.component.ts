import { DatePipe } from '@angular/common';
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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Params, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, forkJoin, map, merge, of, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { InvitacionRecibida } from '../../../core/models/invitacion.model';
import { PaginaReservas, RolMisReservas } from '../../../core/models/reserva.model';
import { Sala } from '../../../core/models/sala.model';
import { ReservasService } from '../../../core/services/reservas.service';
import { SalasService } from '../../../core/services/salas.service';
import { HoraPipe } from '../../../shared/pipes/hora.pipe';
import { InvitacionesPendientesComponent } from '../../invitaciones/invitaciones-pendientes/invitaciones-pendientes.component';

/** Aviso si falla la recarga silenciosa de «Mis reservas». */
const MENSAJE_RECARGA_MIS_RESERVAS_FALLIDA =
  'No se han podido actualizar tus reservas: puede que no estén al día. Recarga la página para verlas.';

/** Pestaña de «Mis reservas». */
export type VistaMisReservas = 'organizadas' | 'invitado' | 'pendientes';

/** Pestañas en el orden en que se muestran, con su texto visible y su `rol` en la API. */
const PESTANAS: readonly { id: VistaMisReservas; texto: string; rol: RolMisReservas }[] = [
  { id: 'organizadas', texto: 'Organizadas', rol: 'ORGANIZADA' },
  { id: 'invitado', texto: 'Invitado', rol: 'INVITADO' },
  { id: 'pendientes', texto: 'Pendientes por responder', rol: 'PENDIENTE' },
];

/** Estado de «Mis reservas» que se guarda en la query de la URL. */
interface EstadoMisReservas {
  /** Pestaña activa. */
  vista: VistaMisReservas;
  /** Página actual, empezando en 0 (en la URL va en base 1). */
  pagina: number;
}

/**
 * Lee la pestaña y la página de la query (`vista` y `page`, en base 1). Los valores no válidos
 * se ignoran.
 *
 * @param params Parámetros de la query.
 */
export function leerEstadoMisReservas(params: ParamMap): EstadoMisReservas {
  const vista = PESTANAS.find((pestana) => pestana.id === params.get('vista'))?.id ?? 'organizadas';
  const page = Number(params.get('page'));
  return { vista, pagina: Number.isSafeInteger(page) && page >= 1 ? page - 1 : 0 };
}

/**
 * MisReservasComponent — pantalla «Mis reservas», con tres pestañas (una navegación con
 * `aria-current`; la pestaña y la página van en la URL):
 *
 * - «Organizadas» (`rol=ORGANIZADA`): las reservas que organiza el usuario.
 * - «Invitado» (`rol=INVITADO`): aquellas a las que está invitado y ha aceptado.
 * - «Pendientes por responder» (`rol=PENDIENTE`): sus invitaciones sin responder, con «Aceptar»
 *   y «Rechazar» (la invitación es `miInvitacion` de cada reserva).
 *
 * Cada pestaña pide al servidor solo su página (`GET /api/reservas?mis=true&rol=…&page&size`).
 * Los contadores de las pestañas salen del `totalElements`: el de la pestaña visible, de su
 * propia página; el de las otras dos, de una petición con `size=1` al abrir la pantalla y tras
 * cada respuesta a una invitación. Tras responder se recargan en silencio solo la página visible
 * y esos contadores.
 */
@Component({
  selector: 'app-mis-reservas',
  imports: [RouterLink, DatePipe, HoraPipe, InvitacionesPendientesComponent],
  templateUrl: './mis-reservas.component.html',
  styleUrl: './mis-reservas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisReservasComponent {
  /** Título de la tabla, que recibe el foco tras cambiar de página. */
  private readonly captionRef = viewChild<ElementRef<HTMLTableCaptionElement>>('captionRef');

  /** Lista de «Pendientes por responder», cuyo título recibe el foco tras cambiar de página. */
  private readonly pendientesRef = viewChild(InvitacionesPendientesComponent);

  /** Salas conocidas, para mostrar su nombre en lugar del id. */
  protected readonly salas = signal<Sala[]>([]);

  /** Página mostrada de la pestaña activa, una vez cargada. */
  protected readonly pagina = signal<PaginaReservas | undefined>(undefined);

  /** Número de reservas de cada pestaña, según el último recuento conocido. */
  protected readonly totales = signal<Partial<Record<VistaMisReservas, number>>>({});

  /** Indica si se está cargando la página (no en las recargas silenciosas). */
  protected readonly cargando = signal(true);

  /** Mensaje de error al cargar la página, si lo hay. */
  protected readonly error = signal<string | undefined>(undefined);

  /** Aviso si falla la recarga silenciosa (se conservan los datos mostrados). */
  protected readonly errorRecarga = signal<string | undefined>(undefined);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reservasService = inject(ReservasService);
  private readonly salasService = inject(SalasService);

  /** Pestañas, para la plantilla. */
  protected readonly pestanas = PESTANAS;

  /** Estado (pestaña y página) leído de la URL. */
  protected readonly estado = toSignal(this.route.queryParamMap.pipe(map(leerEstadoMisReservas)), {
    initialValue: leerEstadoMisReservas(this.route.snapshot.queryParamMap),
  });

  /** Pestaña activa. */
  protected readonly vista = computed(() => this.estado().vista);

  /** Nombre de cada sala indexado por su id. */
  protected readonly nombresSala = computed(() => new Map(this.salas().map((sala) => [sala.id, sala.nombre])));

  /** Reservas de la página mostrada. */
  protected readonly reservasPagina = computed(() => this.pagina()?.content ?? []);

  /** Invitaciones pendientes de la página mostrada (pestaña «Pendientes por responder»). */
  protected readonly invitacionesPagina = computed<InvitacionRecibida[]>(() =>
    this.reservasPagina().flatMap((reserva) =>
      reserva.miInvitacion ? [{ id: reserva.miInvitacion.id, reserva }] : [],
    ),
  );

  /** Página actual, empezando en 0, según la última respuesta. */
  protected readonly paginaActual = computed(() => this.pagina()?.number ?? 0);

  /** Número de páginas de la pestaña activa, según la última respuesta. */
  protected readonly totalPaginas = computed(() => this.pagina()?.totalPages ?? 0);

  /** Texto de estado de la paginación; vacío mientras carga, si hay error o si no hay reservas. */
  protected readonly textoPaginacion = computed(() => {
    const total = this.pagina()?.totalElements ?? 0;
    if (this.cargando() || this.error() || total === 0) {
      return '';
    }
    const reservas = total === 1 ? 'reserva' : 'reservas';
    return `Página ${this.paginaActual() + 1} de ${this.totalPaginas()} (${total} ${reservas})`;
  });

  /** Peticiones de recarga silenciosa (tras responder a una invitación). */
  private readonly recargas = new Subject<void>();

  /** Si se debe llevar el foco al título de la tabla cuando termine la carga (cambio de página). */
  private enfocarTablaTrasCargar = false;

  constructor() {
    this.salasService
      .listar()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (salas) => this.salas.set(salas), error: () => undefined });
    this.cargarPaginas();
    this.contarOtras(this.vista());
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
   * Parámetros de la query del enlace a una pestaña (la primera pestaña y la primera página no
   * se escriben).
   *
   * @param vista Pestaña destino.
   */
  queryParamsDe(vista: VistaMisReservas): Params {
    return { vista: vista === 'organizadas' ? null : vista };
  }

  /**
   * Va a una página de la pestaña activa: la guarda en la URL, lo que la pide al servidor, y al
   * terminar la carga lleva el foco al título de la tabla (o de la lista de pendientes). Las páginas fuera de rango y la
   * actual se ignoran.
   *
   * @param pagina Página destino, empezando en 0.
   */
  irAPagina(pagina: number): void {
    if (!Number.isInteger(pagina) || pagina < 0 || pagina >= this.totalPaginas() || pagina === this.paginaActual()) {
      return;
    }
    this.enfocarTablaTrasCargar = true;
    this.navegarAPagina(pagina, false);
  }

  /**
   * Recarga en silencio la página visible y los contadores de las otras pestañas (tras
   * responder a una invitación, que la mueve de pestaña o la quita).
   */
  recargarSinAviso(): void {
    this.recargas.next();
    this.contarOtras(this.vista());
  }

  /** Pide la página de la URL cada vez que cambia y la vuelve a pedir en silencio cuando se pide. */
  private cargarPaginas(): void {
    const cambiosDeUrl = this.route.queryParamMap.pipe(
      map((params) => ({ estado: leerEstadoMisReservas(params), silenciosa: false })),
    );
    const recargas = this.recargas.pipe(map(() => ({ estado: this.estado(), silenciosa: true })));
    merge(cambiosDeUrl, recargas)
      .pipe(
        switchMap(({ estado, silenciosa }) => {
          this.errorRecarga.set(undefined);
          if (!silenciosa) {
            this.cargando.set(true);
            this.error.set(undefined);
            this.pagina.set(undefined);
          }
          const rol = PESTANAS.find((pestana) => pestana.id === estado.vista)?.rol ?? 'ORGANIZADA';
          return this.reservasService.listarMias(rol, estado.pagina).pipe(
            map((pagina) => ({ pagina, vista: estado.vista })),
            catchError((err: unknown) => {
              if (silenciosa) {
                this.errorRecarga.set(MENSAJE_RECARGA_MIS_RESERVAS_FALLIDA);
              } else {
                const problema = aProblemDetail(err);
                this.error.set(problema.detail ?? problema.title);
                this.cargando.set(false);
              }
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ pagina, vista }) => this.mostrarPagina(pagina, vista));
  }

  /**
   * Pinta la página recibida y actualiza el contador de su pestaña. Si llega vacía y no es la
   * primera (la URL apunta a una página que ya no existe, o se ha respondido a la última
   * invitación de la página), va a la última página con datos.
   */
  private mostrarPagina(pagina: PaginaReservas, vista: VistaMisReservas): void {
    this.totales.update((totales) => ({ ...totales, [vista]: pagina.totalElements }));
    if (pagina.content.length === 0 && pagina.number > 0) {
      this.navegarAPagina(Math.min(pagina.number - 1, Math.max(0, pagina.totalPages - 1)), true);
      return;
    }
    this.pagina.set(pagina);
    this.cargando.set(false);
    if (this.enfocarTablaTrasCargar) {
      this.enfocarTablaTrasCargar = false;
      afterNextRender(
        () => {
          const caption = this.captionRef()?.nativeElement;
          if (caption) {
            caption.focus();
          } else {
            this.pendientesRef()?.enfocarTitulo();
          }
        },
        { injector: this.injector },
      );
    }
  }

  /**
   * Cuenta las reservas de las pestañas que no se ven (`size=1`). Si un recuento falla, se
   * conserva el anterior.
   *
   * @param visible Pestaña visible, cuyo contador sale de su propia página.
   */
  private contarOtras(visible: VistaMisReservas): void {
    const otras = PESTANAS.filter((pestana) => pestana.id !== visible);
    forkJoin(
      otras.map((pestana) =>
        this.reservasService.contarMias(pestana.rol).pipe(
          map((total) => ({ vista: pestana.id, total })),
          catchError(() => of(undefined)),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((recuentos) => {
        this.totales.update((totales) => {
          const nuevos = { ...totales };
          for (const recuento of recuentos) {
            if (recuento) {
              nuevos[recuento.vista] = recuento.total;
            }
          }
          return nuevos;
        });
      });
  }

  /**
   * Guarda la página en la URL, manteniendo la pestaña.
   *
   * @param pagina Página destino, empezando en 0.
   * @param reemplazar Si reemplaza la entrada actual del historial en lugar de añadir una.
   */
  private navegarAPagina(pagina: number, reemplazar: boolean): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: pagina > 0 ? pagina + 1 : null },
      queryParamsHandling: 'merge',
      replaceUrl: reemplazar,
    });
  }
}
