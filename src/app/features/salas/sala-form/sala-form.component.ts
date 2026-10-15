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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, map, switchMap, tap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { ErrorCampo, ProblemDetail } from '../../../core/models/problem-detail.model';
import { Sala, SalaRequest } from '../../../core/models/sala.model';
import { SalasService } from '../../../core/services/salas.service';
import { CLAVE_AVISO } from '../../../shared/utils/aviso-navegacion';
import { focoPerdido } from '../../../shared/utils/foco';
import { MENSAJE_NOMBRE_REPETIDO, RUTA_SALAS_ADMIN, avisoSalaCreada, avisoSalaModificada } from '../sala-mensajes';
import { enteroValidator, textoNoEnBlancoValidator } from './sala-form.validators';

/** Campos del formulario que pueden recibir errores del servidor. */
type CampoSala = keyof SalaRequest;

const CAMPOS: readonly CampoSala[] = ['nombre', 'capacidad', 'planta'];

/** Longitud máxima del nombre de una sala (contrato). */
const MAX_NOMBRE = 100;

/**
 * SalaFormComponent — formulario de alta (`/admin/salas/nueva`) y de edición
 * (`/admin/salas/:id`) de una sala, con validación en cliente y presentación de los
 * errores del backend. El nombre repetido (`409`) se muestra en el campo nombre.
 */
@Component({
  selector: 'app-sala-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sala-form.component.html',
  styleUrl: './sala-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalaFormComponent {
  /** Título de la página, que recibe el foco si el formulario desaparece (sala no encontrada). */
  private readonly tituloRef = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Formulario, para llevar el foco al primer campo con error. */
  private readonly formRef = viewChild<ElementRef<HTMLFormElement>>('formRef');

  /** Error general, que recibe el foco si no hay ningún campo con error. */
  private readonly errorRef = viewChild<ElementRef<HTMLElement>>('errorRef');

  /** Id de la sala que se edita; `undefined` al crear una sala nueva. */
  protected readonly salaId = signal<number | undefined>(undefined);

  /** Indica si se está cargando la sala que se edita. */
  protected readonly cargando = signal(false);

  /** Indica si la sala que se edita no existe (id no válido o `404`). */
  protected readonly noEncontrada = signal(false);

  /** Mensaje de error al cargar la sala, si lo hay. */
  protected readonly errorCarga = signal<string | undefined>(undefined);

  /** Indica si se está enviando la sala. */
  protected readonly enviando = signal(false);

  /** Error general devuelto por el servidor (errores sin campo, estados no previstos…). */
  protected readonly errorGeneral = signal<ProblemDetail | undefined>(undefined);

  /** Errores del servidor que no corresponden a ningún campo del formulario. */
  protected readonly erroresSinCampo = signal<ErrorCampo[]>([]);

  /** Indica si el formulario edita una sala existente. */
  protected readonly modoEdicion = computed(() => this.salaId() !== undefined);

  /** Título de la página según el modo. */
  protected readonly titulo = computed(() => (this.modoEdicion() ? 'Editar sala' : 'Nueva sala'));

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly salasService = inject(SalasService);

  /** Ruta del listado de salas, para la plantilla. */
  protected readonly rutaSalas = RUTA_SALAS_ADMIN;

  /** Longitud máxima del nombre, para el atributo `maxlength`. */
  protected readonly maxNombre = MAX_NOMBRE;

  /**
   * Formulario de la sala. Capacidad y planta son `null` mientras el campo numérico está
   * vacío (es el valor que da Angular a un `<input type="number">` sin número).
   */
  protected readonly form = this.fb.group({
    nombre: this.fb.control('', [Validators.required, textoNoEnBlancoValidator, Validators.maxLength(MAX_NOMBRE)]),
    capacidad: this.fb.control<number | null>(null, [Validators.required, enteroValidator, Validators.min(1)]),
    planta: this.fb.control<number | null>(null, [Validators.required, enteroValidator]),
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) => this.cargar(id)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Indica si hay que mostrar los errores de un campo (tocado o modificado e inválido).
   *
   * @param campo Nombre del control.
   */
  mostrarError(campo: CampoSala): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  /**
   * Valida y envía la sala (alta o modificación). Si va bien, vuelve al listado con un
   * aviso; si no, muestra los errores en los campos o en un mensaje general.
   */
  guardar(): void {
    if (this.enviando()) {
      return;
    }
    this.errorGeneral.set(undefined);
    this.erroresSinCampo.set([]);
    const peticion = this.construirPeticion();
    if (this.form.invalid || !peticion) {
      this.form.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    const id = this.salaId();
    const envio = id === undefined ? this.salasService.crear(peticion) : this.salasService.modificar(id, peticion);
    const aviso = id === undefined ? avisoSalaCreada : avisoSalaModificada;
    this.enviando.set(true);
    envio.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sala) => {
        this.enviando.set(false);
        void this.router.navigate([RUTA_SALAS_ADMIN], { state: { [CLAVE_AVISO]: aviso(sala.nombre) } });
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.mostrarErroresServidor(aProblemDetail(err));
        if (!this.noEncontrada()) {
          this.enfocarPrimerError();
        }
      },
    });
  }

  /**
   * Prepara el formulario según la ruta: vacío para una sala nueva, o con los datos de la
   * sala para editarla. Si el id no es válido o la sala no existe, lo indica.
   *
   * @param idRuta Parámetro `id` de la ruta; `null` en `/admin/salas/nueva`.
   */
  private cargar(idRuta: string | null): Observable<Sala> {
    this.reiniciar();
    if (idRuta === null) {
      return EMPTY;
    }
    const id = /^\d+$/.test(idRuta) ? Number(idRuta) : Number.NaN;
    this.salaId.set(id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.marcarNoEncontrada();
      return EMPTY;
    }
    this.cargando.set(true);
    return this.salasService.obtener(id).pipe(
      tap((sala) => {
        this.form.reset({ nombre: sala.nombre, capacidad: sala.capacidad, planta: sala.planta });
        this.cargando.set(false);
      }),
      catchError((err: unknown) => {
        const problema = aProblemDetail(err);
        if (problema.status === 404) {
          this.marcarNoEncontrada();
        } else {
          this.errorCarga.set(problema.detail ?? problema.title);
          this.cargando.set(false);
        }
        return EMPTY;
      }),
    );
  }

  private reiniciar(): void {
    this.salaId.set(undefined);
    this.cargando.set(false);
    this.noEncontrada.set(false);
    this.errorCarga.set(undefined);
    this.enviando.set(false);
    this.errorGeneral.set(undefined);
    this.erroresSinCampo.set([]);
    this.form.reset();
  }

  private construirPeticion(): SalaRequest | undefined {
    const { nombre, capacidad, planta } = this.form.getRawValue();
    if (capacidad === null || planta === null) {
      return undefined;
    }
    return { nombre: nombre.trim(), capacidad, planta };
  }

  private mostrarErroresServidor(problema: ProblemDetail): void {
    if (problema.status === 409) {
      const nombre = this.form.controls.nombre;
      nombre.setErrors({ ...nombre.errors, nombreRepetido: MENSAJE_NOMBRE_REPETIDO });
      nombre.markAsTouched();
      return;
    }
    if (problema.status === 404 && this.modoEdicion()) {
      this.marcarNoEncontrada();
      this.recuperarFoco();
      return;
    }
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

  private esCampo(campo: string): campo is CampoSala {
    return (CAMPOS as readonly string[]).includes(campo);
  }

  private marcarNoEncontrada(): void {
    this.noEncontrada.set(true);
    this.cargando.set(false);
  }

  /**
   * Tras el render, lleva el foco al primer campo con error o, si no hay ninguno, al
   * mensaje de error general.
   */
  private enfocarPrimerError(): void {
    afterNextRender(
      () => {
        const campo = this.formRef()?.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
        (campo ?? this.errorRef()?.nativeElement)?.focus();
      },
      { injector: this.injector },
    );
  }

  /** Si el foco se ha perdido (el formulario ha desaparecido), lo lleva al título. */
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
