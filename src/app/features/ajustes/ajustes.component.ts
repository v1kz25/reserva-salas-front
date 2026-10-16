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

import { aProblemDetail } from '../../core/http/problem-detail';
import { ProblemDetail } from '../../core/models/problem-detail.model';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { agruparZonas, zonasDisponibles } from './zonas-horarias';

/** Mensaje del campo si el servidor rechaza la zona (`400`) sin indicar el motivo. */
const MENSAJE_ZONA_NO_VALIDA = 'La zona horaria no es válida.';

/**
 * AjustesComponent — ajustes de la aplicación para el administrador (`/admin/ajustes`):
 * muestra la zona horaria actual y permite cambiarla con un selector.
 */
@Component({
  selector: 'app-ajustes',
  imports: [ReactiveFormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AjustesComponent {
  /** Selector de zona, que recibe el foco si el servidor la rechaza. */
  private readonly selectorRef = viewChild<ElementRef<HTMLSelectElement>>('selectorRef');

  /** Indica si se está cargando la zona actual. */
  protected readonly cargando = signal(true);

  /** Mensaje de error al cargar la zona actual, si lo hay. */
  protected readonly errorCarga = signal<string | undefined>(undefined);

  /** Indica si se está guardando la zona. */
  protected readonly guardando = signal(false);

  /** Aviso de éxito tras guardar. */
  protected readonly exito = signal<string | undefined>(undefined);

  /** Error general al guardar que no corresponde al campo. */
  protected readonly errorGeneral = signal<ProblemDetail | undefined>(undefined);

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly configuracion = inject(ConfiguracionService);

  /** Zonas IANA que admite el navegador (o lista de respaldo). */
  private readonly todas = zonasDisponibles();

  /** Zona horaria actual del servidor. */
  protected readonly zonaActual = this.configuracion.zonaHoraria;

  /** Zonas del selector: las comunes destacadas y el resto. */
  protected readonly grupos = computed(() => agruparZonas(this.todas, this.zonaActual()));

  /** Formulario con la zona elegida. */
  protected readonly form = this.fb.group({
    zonaHoraria: this.fb.control('', Validators.required),
  });

  constructor() {
    this.configuracion
      .obtenerZonaHoraria()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (zona) => {
          this.form.reset({ zonaHoraria: zona.zonaHoraria });
          this.cargando.set(false);
        },
        error: (err: unknown) => {
          const problema = aProblemDetail(err);
          this.errorCarga.set(problema.detail ?? problema.title);
          this.cargando.set(false);
        },
      });
  }

  /** Indica si hay que mostrar los errores del selector (tocado o modificado e inválido). */
  mostrarError(): boolean {
    const control = this.form.controls.zonaHoraria;
    return control.invalid && (control.touched || control.dirty);
  }

  /**
   * Guarda la zona elegida. Si va bien, muestra un aviso; si el servidor la rechaza
   * (`400`), muestra el motivo junto al selector.
   */
  guardar(): void {
    if (this.guardando()) {
      return;
    }
    this.exito.set(undefined);
    this.errorGeneral.set(undefined);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarSelector();
      return;
    }
    this.guardando.set(true);
    this.configuracion
      .cambiarZonaHoraria(this.form.getRawValue().zonaHoraria)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (zona) => {
          this.guardando.set(false);
          this.form.reset({ zonaHoraria: zona.zonaHoraria });
          this.exito.set(`Zona horaria guardada: ${zona.zonaHoraria}.`);
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.mostrarErrorServidor(aProblemDetail(err));
        },
      });
  }

  private mostrarErrorServidor(problema: ProblemDetail): void {
    if (problema.status !== 400) {
      this.errorGeneral.set(problema);
      return;
    }
    const mensaje =
      problema.errores?.find((error) => error.campo === 'zonaHoraria')?.mensaje ??
      problema.detail ??
      MENSAJE_ZONA_NO_VALIDA;
    const control = this.form.controls.zonaHoraria;
    control.setErrors({ ...control.errors, servidor: mensaje });
    control.markAsTouched();
    this.enfocarSelector();
  }

  /** Tras el render, lleva el foco al selector de zona. */
  private enfocarSelector(): void {
    afterNextRender(() => this.selectorRef()?.nativeElement.focus(), { injector: this.injector });
  }
}
