import { DOCUMENT, DatePipe } from '@angular/common';
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
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, finalize, map, merge, of, startWith, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { FiltroReservas, Reserva } from '../../../core/models/reserva.model';
import { Sala } from '../../../core/models/sala.model';
import { ReservasService } from '../../../core/services/reservas.service';
import { SalasService } from '../../../core/services/salas.service';
import { DialogoConfirmacionComponent } from '../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component';
import { HoraPipe } from '../../../shared/pipes/hora.pipe';
import { focoPerdido } from '../../../shared/utils/foco';
import {
  AVISO_RESERVA_CANCELADA,
  MENSAJE_RESERVA_YA_CANCELADA,
  leerAviso,
  limpiarAvisoDelHistorial,
} from '../reserva-cancelacion';
import { rangoFechasValidator } from './reserva-list.validators';

/**
 * ReservaListComponent — listado de reservas con filtros por sala y rango de fechas.
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

  /** Salas disponibles para el filtro y para resolver nombres. */
  protected readonly salas = signal<Sala[]>([]);

  /** Reservas que cumplen los filtros actuales. */
  protected readonly reservas = signal<Reserva[]>([]);

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

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reservasService = inject(ReservasService);
  private readonly salasService = inject(SalasService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Peticiones de recarga del listado sin mostrar el estado de carga (tras cancelar). */
  private readonly recarga = new Subject<void>();

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

    merge(
      this.filtros.valueChanges.pipe(
        startWith(this.filtros.getRawValue()),
        map(() => false),
      ),
      this.recarga.pipe(map(() => true)),
    )
      .pipe(
        switchMap((silenciosa) => {
          if (this.filtros.invalid) {
            this.cargando.set(false);
            return EMPTY;
          }
          if (!silenciosa) {
            this.cargando.set(true);
            this.error.set(undefined);
          }
          return this.reservasService.listar(this.filtroActual()).pipe(
            catchError((err: unknown) => {
              const problema = aProblemDetail(err);
              this.error.set(problema.detail ?? problema.title);
              return of<Reserva[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((reservas) => {
        this.reservas.set(reservas);
        this.cargando.set(false);
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
   * recarga; si la reserva ya no existía (`404`), lo indica y también recarga el listado.
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
          this.recarga.next();
          this.recuperarFoco();
        },
        error: (err: unknown) => {
          const problema = aProblemDetail(err);
          this.cerrarDialogo();
          if (problema.status === 404) {
            this.quitarDelListado(reserva.id);
            this.errorCancelacion.set(MENSAJE_RESERVA_YA_CANCELADA);
            this.recarga.next();
          } else {
            this.errorCancelacion.set(problema.detail ?? problema.title);
          }
          this.recuperarFoco();
        },
      });
  }

  private quitarDelListado(id: number): void {
    this.reservas.update((reservas) => reservas.filter((reserva) => reserva.id !== id));
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
