import { DatePipe } from '@angular/common';
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
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, finalize, map, of, startWith, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { FiltroReservas, PaginaReservas, Reserva } from '../../../core/models/reserva.model';
import { Sala } from '../../../core/models/sala.model';
import { ReservasService } from '../../../core/services/reservas.service';
import { SalasService } from '../../../core/services/salas.service';
import { SesionService } from '../../../core/services/sesion.service';
import { DialogoConfirmacionComponent } from '../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component';
import { HoraPipe } from '../../../shared/pipes/hora.pipe';
import { focoPerdido } from '../../../shared/utils/foco';
import {
  AVISO_RESERVA_CANCELADA,
  MENSAJE_CANCELACION_SIN_PERMISO,
  MENSAJE_RESERVA_YA_CANCELADA,
  leerAviso,
  limpiarAvisoDelHistorial,
} from '../reserva-cancelacion';
import { EstadoListado, estadoAQueryParams, leerEstadoDeUrl, mismoEstado } from './reserva-list.url';
import { rangoFechasValidator } from './reserva-list.validators';

/**
 * ReservaListComponent — listado paginado de reservas con filtros por sala y rango de fechas.
 * Los filtros y la página se guardan en la query de la URL (`page` en base 1), así que recargar
 * o volver atrás conserva el listado. El botón «Cancelar» solo aparece en las reservas del
 * usuario o si es administrador.
 */
@Component({
  selector: 'app-reserva-list',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, HoraPipe, DialogoConfirmacionComponent],
  templateUrl: './reserva-list.component.html',
  styleUrl: './reserva-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservaListComponent {
  /** Título de la página, que recibe el foco si el elemento enfocado desaparece al cancelar. */
  private readonly tituloRef = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Título de la tabla, que recibe el foco tras cambiar de página. */
  private readonly captionRef = viewChild<ElementRef<HTMLTableCaptionElement>>('captionRef');

  /** Salas disponibles para el filtro y para resolver nombres. */
  protected readonly salas = signal<Sala[]>([]);

  /** Reservas de la página actual que cumplen los filtros. */
  protected readonly reservas = signal<Reserva[]>([]);

  /** Página actual, empezando en 0. */
  protected readonly paginaActual = signal(0);

  /** Número total de páginas según la última respuesta. */
  protected readonly totalPaginas = signal(0);

  /** Número total de reservas que cumplen los filtros según la última respuesta. */
  protected readonly totalReservas = signal(0);

  /** Indica si se están cargando las reservas. */
  protected readonly cargando = signal(true);

  /** Mensaje de error al cargar las reservas, si lo hay. */
  protected readonly error = signal<string | undefined>(undefined);

  /** Mensaje de error al cargar las salas, si lo hay. */
  protected readonly errorSalas = signal<string | undefined>(undefined);

  /** Indica si la petición de salas ya ha terminado (con datos o con error). */
  protected readonly salasResueltas = signal(false);

  /** Reserva pendiente de confirmar su cancelación (diálogo abierto), si la hay. */
  protected readonly reservaACancelar = signal<Reserva | undefined>(undefined);

  /** Indica si se está enviando la cancelación. */
  protected readonly cancelando = signal(false);

  /** Mensaje de éxito tras cancelar una reserva, si lo hay. */
  protected readonly avisoCancelacion = signal<string | undefined>(undefined);

  /** Mensaje de error al cancelar una reserva, si lo hay. */
  protected readonly errorCancelacion = signal<string | undefined>(undefined);

  /** Nombre de cada sala indexado por su id. */
  protected readonly nombresSala = computed(
    () => new Map(this.salas().map((sala) => [sala.id, sala.nombre])),
  );

  /** Indica si se está en la primera página («Primera» y «Anterior» no aplican). */
  protected readonly esPrimeraPagina = computed(() => this.paginaActual() <= 0);

  /** Indica si se está en la última página («Siguiente» y «Última» no aplican). */
  protected readonly esUltimaPagina = computed(() => this.paginaActual() >= this.totalPaginas() - 1);

  /** Índices (base 0) de todas las páginas, para el selector de página. */
  protected readonly indicesPagina = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, indice) => indice),
  );

  /** Texto de estado de la paginación; vacío mientras carga, si hay error o si no hay reservas. */
  protected readonly textoPaginacion = computed(() => {
    const total = this.totalReservas();
    if (this.cargando() || this.error() || total === 0) {
      return '';
    }
    const reservas = total === 1 ? 'reserva' : 'reservas';
    return `Página ${this.paginaActual() + 1} de ${this.totalPaginas()} (${total} ${reservas})`;
  });

  /** Sesión actual, para decidir qué reservas puede cancelar el usuario. */
  protected readonly sesion = inject(SesionService);

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reservasService = inject(ReservasService);
  private readonly salasService = inject(SalasService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Peticiones de carga del listado; `true` si es silenciosa (sin estado de carga, tras cancelar). */
  private readonly cargas = new Subject<boolean>();

  /** Si se debe llevar el foco al título de la tabla cuando termine la carga (cambio de página). */
  private enfocarTablaTrasCargar = false;

  /**
   * Formulario de filtros (sala y rango de fechas). `salaId` es `null` para «Todas las salas»,
   * porque Angular no selecciona una opción con `[ngValue]="undefined"`.
   */
  protected readonly filtros = this.fb.group(
    {
      salaId: this.fb.control<number | null>(null),
      fechaDesde: this.fb.control(''),
      fechaHasta: this.fb.control(''),
    },
    { validators: [rangoFechasValidator] },
  );

  constructor() {
    this.avisoCancelacion.set(leerAviso(this.router.getCurrentNavigation()?.extras.state));
    if (this.avisoCancelacion()) {
      // Se limpia tras el primer render, cuando el router ya ha actualizado la entrada del historial.
      afterNextRender(() => {
        const historial = this.document.defaultView?.history;
        if (historial) {
          limpiarAvisoDelHistorial(historial);
        }
      });
    }

    this.salasService
      .listar()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (salas) => {
          this.salas.set(salas);
          this.salasResueltas.set(true);
        },
        error: (err: unknown) => {
          this.errorSalas.set(aProblemDetail(err).detail);
          this.salasResueltas.set(true);
        },
      });

    const inicial = leerEstadoDeUrl(this.route.snapshot.queryParamMap);
    this.aplicarEstado(inicial);

    this.cargas
      .pipe(
        startWith(false),
        switchMap((silenciosa) => {
          if (this.filtros.invalid) {
            this.cargando.set(false);
            return EMPTY;
          }
          if (!silenciosa) {
            this.cargando.set(true);
            this.error.set(undefined);
          }
          return this.reservasService.listar(this.filtroActual(), this.paginaActual()).pipe(
            catchError((err: unknown) => {
              const problema = aProblemDetail(err);
              this.error.set(problema.detail ?? problema.title);
              return of(undefined);
            }),
            map((pagina) => ({ pagina, silenciosa })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ pagina, silenciosa }) => this.mostrarPagina(pagina, silenciosa));

    this.filtros.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.enfocarTablaTrasCargar = false;
      this.paginaActual.set(0);
      if (this.filtros.valid) {
        this.sincronizarUrl(true);
      }
      this.cargas.next(false);
    });

    // Navegación externa (atrás/adelante o un enlace con otra query): se aplica y se recarga.
    // Las navegaciones propias llegan con el mismo estado y se ignoran.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const estado = leerEstadoDeUrl(params);
      if (mismoEstado(estado, this.estadoActual())) {
        return;
      }
      this.aplicarEstado(estado);
      this.cargas.next(false);
    });
  }

  /**
   * Devuelve el nombre de la sala. Mientras no han llegado las salas devuelve «—»;
   * si la sala no se conoce, una etiqueta con su id.
   *
   * @param salaId Identificador de la sala.
   */
  nombreSala(salaId: number): string {
    if (!this.salasResueltas()) {
      return '—';
    }
    return this.nombresSala().get(salaId) ?? `Sala ${salaId}`;
  }

  /**
   * Limpia los filtros y vuelve a mostrar todas las reservas.
   */
  limpiarFiltros(): void {
    this.filtros.reset();
  }

  /**
   * Va a una página del listado manteniendo los filtros, la guarda en la URL (con entrada
   * nueva en el historial) y, al terminar la carga, lleva el foco al título de la tabla.
   * Las páginas fuera de rango y la página actual se ignoran.
   *
   * @param pagina Página destino, empezando en 0.
   */
  irAPagina(pagina: number): void {
    if (!Number.isInteger(pagina) || pagina < 0 || pagina >= this.totalPaginas() || pagina === this.paginaActual()) {
      return;
    }
    this.paginaActual.set(pagina);
    this.sincronizarUrl(false);
    this.enfocarTablaTrasCargar = true;
    this.cargas.next(false);
  }

  /**
   * Abre el diálogo de confirmación para cancelar una reserva.
   *
   * @param reserva Reserva que se quiere cancelar.
   */
  pedirCancelacion(reserva: Reserva): void {
    if (this.cancelando()) {
      return;
    }
    this.avisoCancelacion.set(undefined);
    this.errorCancelacion.set(undefined);
    this.reservaACancelar.set(reserva);
  }

  /**
   * Cierra el diálogo de confirmación sin cancelar la reserva.
   */
  cerrarDialogo(): void {
    this.reservaACancelar.set(undefined);
  }

  /**
   * Envía la cancelación de la reserva confirmada. Si va bien, la quita del listado y lo
   * recarga; si la reserva ya no existía (`404`), lo indica y también recarga el listado;
   * si el servidor no lo permite (`403`), lo indica.
   * Mientras hay una cancelación en curso se ignoran nuevas confirmaciones.
   */
  confirmarCancelacion(): void {
    const reserva = this.reservaACancelar();
    if (!reserva || this.cancelando()) {
      return;
    }
    this.cancelando.set(true);
    this.reservasService
      .cancelar(reserva.id)
      .pipe(
        finalize(() => this.cancelando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.cerrarDialogo();
          this.quitarDelListado(reserva.id);
          this.avisoCancelacion.set(AVISO_RESERVA_CANCELADA);
          this.cargas.next(true);
          this.recuperarFoco();
        },
        error: (err: unknown) => {
          const problema = aProblemDetail(err);
          this.cerrarDialogo();
          if (problema.status === 404) {
            this.quitarDelListado(reserva.id);
            this.errorCancelacion.set(MENSAJE_RESERVA_YA_CANCELADA);
            this.cargas.next(true);
          } else if (problema.status === 403) {
            this.errorCancelacion.set(MENSAJE_CANCELACION_SIN_PERMISO);
          } else {
            this.errorCancelacion.set(problema.detail ?? problema.title);
          }
          this.recuperarFoco();
        },
      });
  }

  private quitarDelListado(id: number): void {
    const antes = this.reservas().length;
    this.reservas.update((reservas) => reservas.filter((reserva) => reserva.id !== id));
    if (this.reservas().length < antes) {
      this.totalReservas.update((total) => Math.max(0, total - 1));
    }
  }

  /**
   * Pinta la página recibida. Si llega vacía y no es la primera (se ha cancelado la última
   * reserva de la página o la URL apunta a una página que ya no existe), retrocede hasta la
   * última página con datos, con la misma modalidad (silenciosa o no) que la carga original.
   */
  private mostrarPagina(pagina: PaginaReservas | undefined, silenciosa: boolean): void {
    if (pagina && pagina.content.length === 0 && pagina.number > 0) {
      this.paginaActual.set(Math.min(pagina.number - 1, Math.max(0, pagina.totalPages - 1)));
      this.sincronizarUrl(true);
      this.cargas.next(silenciosa);
      return;
    }
    this.reservas.set(pagina?.content ?? []);
    this.totalReservas.set(pagina?.totalElements ?? 0);
    this.totalPaginas.set(pagina?.totalPages ?? 0);
    this.paginaActual.set(pagina?.number ?? this.paginaActual());
    this.cargando.set(false);
    if (this.enfocarTablaTrasCargar) {
      this.enfocarTablaTrasCargar = false;
      this.enfocarTabla();
    }
  }

  /** Lleva el foco al título de la tabla o, si no hay tabla (error), al título de la página. */
  private enfocarTabla(): void {
    afterNextRender(
      () => {
        (this.captionRef() ?? this.tituloRef()).nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Guarda los filtros y la página en la query de la URL.
   *
   * @param reemplazar Si reemplaza la entrada actual del historial en lugar de añadir una.
   */
  private sincronizarUrl(reemplazar: boolean): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: estadoAQueryParams(this.estadoActual()),
      queryParamsHandling: 'merge',
      replaceUrl: reemplazar,
    });
  }

  /** Pone los filtros y la página de un estado sin disparar una carga. */
  private aplicarEstado(estado: EstadoListado): void {
    this.filtros.setValue(
      {
        salaId: estado.salaId ?? null,
        fechaDesde: estado.fechaDesde ?? '',
        fechaHasta: estado.fechaHasta ?? '',
      },
      { emitEvent: false },
    );
    this.paginaActual.set(estado.pagina);
  }

  private estadoActual(): EstadoListado {
    return { ...this.filtroActual(), pagina: this.paginaActual() };
  }

  /** Si el foco se ha perdido (fila cancelada o diálogo cerrado), lo lleva al título. */
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

  private filtroActual(): FiltroReservas {
    const { salaId, fechaDesde, fechaHasta } = this.filtros.getRawValue();
    return {
      salaId: salaId ?? undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
    };
  }
}
