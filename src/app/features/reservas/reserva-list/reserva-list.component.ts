import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, of, startWith, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { FiltroReservas, Reserva } from '../../../core/models/reserva.model';
import { Sala } from '../../../core/models/sala.model';
import { ReservasService } from '../../../core/services/reservas.service';
import { SalasService } from '../../../core/services/salas.service';
import { HoraPipe } from '../../../shared/pipes/hora.pipe';
import { rangoFechasValidator } from './reserva-list.validators';

/**
 * ReservaListComponent — listado de reservas con filtros por sala y rango de fechas.
 */
@Component({
  selector: 'app-reserva-list',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, HoraPipe],
  templateUrl: './reserva-list.component.html',
  styleUrl: './reserva-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservaListComponent {
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

  /** Nombre de cada sala indexado por su id. */
  protected readonly nombresSala = computed(
    () => new Map(this.salas().map((sala) => [sala.id, sala.nombre])),
  );

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reservasService = inject(ReservasService);
  private readonly salasService = inject(SalasService);

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

    this.filtros.valueChanges
      .pipe(
        startWith(this.filtros.getRawValue()),
        switchMap(() => {
          if (this.filtros.invalid) {
            this.cargando.set(false);
            return EMPTY;
          }
          this.cargando.set(true);
          this.error.set(undefined);
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

  private filtroActual(): FiltroReservas {
    const { salaId, fechaDesde, fechaHasta } = this.filtros.getRawValue();
    return {
      salaId: salaId ?? undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
    };
  }
}
