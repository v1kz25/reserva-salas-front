import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { ErrorCampo, ProblemDetail } from '../../../core/models/problem-detail.model';
import { ReservaRequest } from '../../../core/models/reserva.model';
import { Sala } from '../../../core/models/sala.model';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { ReservasService } from '../../../core/services/reservas.service';
import { SalasService } from '../../../core/services/salas.service';
import { AHORA } from '../../../core/tokens/ahora.token';
import {
  diaSiguienteIso,
  esZonaValida,
  fechaIsoEnZona,
  fechaLegible,
  zonaNavegador,
} from '../../../shared/utils/fecha';
import { aPartirDeMananaValidator, horaFinPosteriorValidator } from './reserva-form.validators';

/** Campos del formulario que pueden recibir errores del servidor. */
type CampoReserva = keyof ReservaRequest;

const CAMPOS: readonly CampoReserva[] = ['salaId', 'fecha', 'horaInicio', 'horaFin', 'motivo'];

/**
 * ReservaFormComponent — formulario de alta de una reserva con validación en cliente
 * y presentación de los errores del backend. El responsable es el usuario de la sesión.
 *
 * «Mañana» se calcula en la zona horaria del servidor: al entrar se pide siempre
 * `GET /api/config/zona-horaria`. Mientras llega se usa la última zona conocida
 * (`ConfiguracionService`) o, si no hay ninguna, la del navegador; si la petición falla,
 * se sigue con esa, sin bloquear el formulario. «Mañana» se recalcula cada minuto, para
 * que avance si la pestaña sigue abierta pasada la medianoche.
 */
@Component({
  selector: 'app-reserva-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reserva-form.component.html',
  styleUrl: './reserva-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservaFormComponent {
  /** Salas disponibles en el selector. */
  protected readonly salas = signal<Sala[]>([]);

  /** Mensaje de error al cargar las salas, si lo hay. */
  protected readonly errorSalas = signal<string | undefined>(undefined);

  /** Indica si se está enviando la reserva. */
  protected readonly enviando = signal(false);

  /** Error general devuelto por el servidor (409, 404, errores sin campo…). */
  protected readonly errorGeneral = signal<ProblemDetail | undefined>(undefined);

  /** Errores del servidor que no corresponden a ningún campo del formulario. */
  protected readonly erroresSinCampo = signal<ErrorCampo[]>([]);

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reservasService = inject(ReservasService);
  private readonly salasService = inject(SalasService);
  private readonly configuracion = inject(ConfiguracionService);
  private readonly ahora = inject(AHORA);

  /** Reloj del formulario: el momento actual según `AHORA`, actualizado cada minuto. */
  private readonly reloj = signal(this.ahora());

  /** Zona horaria con la que se calcula «mañana»: la del servidor o, si no se conoce, la del navegador. */
  protected readonly zonaHoraria = computed(() => {
    const zona = this.configuracion.zonaHoraria();
    return esZonaValida(zona) ? zona : zonaNavegador();
  });

  /** Fecha mínima seleccionable (mañana en la zona del servidor, en formato `yyyy-MM-dd`). */
  protected readonly manana = computed(() => diaSiguienteIso(fechaIsoEnZona(this.reloj(), this.zonaHoraria())));

  /** Fecha mínima en formato `dd/MM/yyyy`, para el texto de ayuda. */
  protected readonly mananaLegible = computed(() => fechaLegible(this.manana()));

  /** Formulario de la reserva. */
  protected readonly form = this.fb.group(
    {
      salaId: this.fb.control<number | undefined>(undefined, Validators.required),
      fecha: this.fb.control('', [Validators.required, aPartirDeMananaValidator(this.ahora, () => this.zonaHoraria())]),
      horaInicio: this.fb.control('', Validators.required),
      horaFin: this.fb.control('', Validators.required),
      motivo: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    },
    { validators: [horaFinPosteriorValidator] },
  );

  constructor() {
    this.configuracion
      .obtenerZonaHoraria(true)
      .pipe(takeUntilDestroyed())
      .subscribe({ error: () => undefined });
    interval(60_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.reloj.set(this.ahora()));
    // `manana` solo cambia (y solo entonces se revalida la fecha) cuando cambia el día o la zona.
    effect(() => {
      this.manana();
      untracked(() => this.form.controls.fecha.updateValueAndValidity());
    });
    this.salasService
      .listar()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (salas) => this.salas.set(salas),
        error: (err: unknown) => this.errorSalas.set(aProblemDetail(err).detail),
      });
  }

  /**
   * Indica si hay que mostrar los errores de un campo (tocado o modificado e inválido).
   *
   * @param campo Nombre del control.
   */
  mostrarError(campo: CampoReserva): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  /**
   * Indica si hay que mostrar un error del grupo (validaciones entre campos).
   *
   * @param error Clave del error del grupo.
   * @param campos Campos implicados; basta con que uno esté tocado.
   */
  mostrarErrorGrupo(error: string, ...campos: CampoReserva[]): boolean {
    return (
      this.form.hasError(error) &&
      campos.some((campo) => this.form.controls[campo].touched || this.form.controls[campo].dirty)
    );
  }

  /**
   * Valida y envía la reserva. Si va bien, vuelve al listado; si no, muestra los errores.
   */
  guardar(): void {
    this.errorGeneral.set(undefined);
    this.erroresSinCampo.set([]);
    this.form.controls.fecha.updateValueAndValidity();
    const peticion = this.construirPeticion();
    if (this.form.invalid || !peticion) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.reservasService
      .crear(peticion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          void this.router.navigate(['/reservas']);
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          this.mostrarErroresServidor(aProblemDetail(err));
        },
      });
  }

  private construirPeticion(): ReservaRequest | undefined {
    const valor = this.form.getRawValue();
    if (typeof valor.salaId !== 'number') {
      return undefined;
    }
    return {
      salaId: valor.salaId,
      fecha: valor.fecha,
      horaInicio: valor.horaInicio.slice(0, 5),
      horaFin: valor.horaFin.slice(0, 5),
      motivo: valor.motivo.trim(),
    };
  }

  private mostrarErroresServidor(problema: ProblemDetail): void {
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

  private esCampo(campo: string): campo is CampoReserva {
    return (CAMPOS as readonly string[]).includes(campo);
  }
}
