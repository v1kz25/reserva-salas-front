import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { ErrorCampo, ProblemDetail } from '../../../core/models/problem-detail.model';
import { ReservaRequest } from '../../../core/models/reserva.model';
import { Sala } from '../../../core/models/sala.model';
import { ReservasService } from '../../../core/services/reservas.service';
import { SalasService } from '../../../core/services/salas.service';
import { AHORA } from '../../../core/tokens/ahora.token';
import { diaSiguiente, fechaIso } from '../../../shared/utils/fecha';
import { aPartirDeMananaValidator, horaFinPosteriorValidator } from './reserva-form.validators';

/** Campos del formulario que pueden recibir errores del servidor. */
type CampoReserva = keyof ReservaRequest;

const CAMPOS: readonly CampoReserva[] = ['salaId', 'fecha', 'horaInicio', 'horaFin', 'responsable', 'motivo'];

/**
 * ReservaFormComponent — formulario de alta de una reserva con validación en cliente
 * y presentación de los errores del backend.
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
  private readonly ahora = inject(AHORA);

  /** Fecha mínima seleccionable (mañana, en formato `yyyy-MM-dd`). */
  protected readonly manana = fechaIso(diaSiguiente(this.ahora()));

  /** Formulario de la reserva. */
  protected readonly form = this.fb.group(
    {
      salaId: this.fb.control<number | undefined>(undefined, Validators.required),
      fecha: this.fb.control('', [Validators.required, aPartirDeMananaValidator(this.ahora)]),
      horaInicio: this.fb.control('', Validators.required),
      horaFin: this.fb.control('', Validators.required),
      responsable: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
      motivo: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    },
    { validators: [horaFinPosteriorValidator] },
  );

  constructor() {
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
      responsable: valor.responsable.trim(),
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
