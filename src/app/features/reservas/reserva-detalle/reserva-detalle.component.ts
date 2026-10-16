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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, defaultIfEmpty, map, merge, of, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { Reserva } from '../../../core/models/reserva.model';
import { Sala } from '../../../core/models/sala.model';
import { ReservasService } from '../../../core/services/reservas.service';
import { SalasService } from '../../../core/services/salas.service';
import { SesionService } from '../../../core/services/sesion.service';
import { DialogoConfirmacionComponent } from '../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component';
import { HoraPipe } from '../../../shared/pipes/hora.pipe';
import { focoPerdido } from '../../../shared/utils/foco';
import { ReservaAsistentesComponent, ResultadoAsistentes } from '../reserva-asistentes/reserva-asistentes.component';
import {
  AVISO_RESERVA_CANCELADA,
  CLAVE_AVISO,
  MENSAJE_CANCELACION_SIN_PERMISO,
  MENSAJE_RECARGA_RESERVA_FALLIDA,
} from '../reserva-cancelacion';

/** Id del título de la sección «Asistentes», que recibe el foco si se pierde tras una acción. */
const ID_TITULO_ASISTENTES = 'titulo-asistentes';

/**
 * ReservaDetalleComponent — muestra los datos de una reserva y permite cancelarla
 * tras confirmarlo en un diálogo, si es del usuario o si es administrador.
 *
 * Si el usuario no participa (`detalle: OCUPADA`) solo muestra sala, fecha y franja, con el
 * estado «Ocupada». Con `detalle: COMPLETO` añade la sección «Asistentes» (invitaciones y
 * plazas), desde la que el organizador invita y retira invitaciones y el invitado responde.
 * Tras cada acción la reserva se recarga sin mostrar el estado de carga.
 */
@Component({
  selector: 'app-reserva-detalle',
  imports: [RouterLink, DatePipe, HoraPipe, DialogoConfirmacionComponent, ReservaAsistentesComponent],
  templateUrl: './reserva-detalle.component.html',
  styleUrl: './reserva-detalle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservaDetalleComponent {
  /** Título de la página, que recibe el foco si el elemento enfocado desaparece al cancelar. */
  private readonly tituloRef = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Sección «Asistentes», para saber si tiene una acción en curso. */
  private readonly asistentes = viewChild(ReservaAsistentesComponent);

  /** Reserva mostrada, una vez cargada. */
  protected readonly reserva = signal<Reserva | undefined>(undefined);

  /** Sala de la reserva, si se ha podido cargar. */
  protected readonly sala = signal<Sala | undefined>(undefined);

  /** Mensaje de éxito de la última acción sobre los asistentes, si lo hay. */
  protected readonly aviso = signal<string | undefined>(undefined);

  /** Mensaje de error de la última acción sobre los asistentes, si lo hay. */
  protected readonly errorAccion = signal<string | undefined>(undefined);

  /** Aviso si falla la recarga silenciosa (se conserva la reserva mostrada). */
  protected readonly errorRecarga = signal<string | undefined>(undefined);

  /** Indica si se está cargando la reserva. */
  protected readonly cargando = signal(true);

  /** Indica si la reserva no existe (id no válido o `404`). */
  protected readonly noEncontrada = signal(false);

  /** Mensaje de error al cargar la reserva, si lo hay. */
  protected readonly error = signal<string | undefined>(undefined);

  /** Indica si el diálogo de confirmación está abierto. */
  protected readonly dialogoAbierto = signal(false);

  /** Indica si se está enviando la cancelación. */
  protected readonly cancelando = signal(false);

  /** Mensaje de error al cancelar la reserva, si lo hay. */
  protected readonly errorCancelacion = signal<string | undefined>(undefined);

  /** Sesión actual, para decidir si el usuario puede cancelar la reserva. */
  protected readonly sesion = inject(SesionService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reservasService = inject(ReservasService);
  private readonly salasService = inject(SalasService);
  private readonly injector = inject(Injector);

  /** Nombre de la sala de la reserva, o «Sala N» si no se ha podido resolver. */
  protected readonly nombreSala = computed(() => {
    const reserva = this.reserva();
    return this.sala()?.nombre ?? (reserva ? `Sala ${reserva.salaId}` : undefined);
  });

  /** Peticiones de recarga silenciosa de la reserva mostrada (tras una acción sobre los asistentes). */
  private readonly recargas = new Subject<void>();

  constructor() {
    const cambiosDeRuta = this.route.paramMap.pipe(map((params) => ({ id: Number(params.get('id')), silenciosa: false })));
    const recargas = this.recargas.pipe(
      map(() => ({ id: this.reserva()?.id ?? Number.NaN, silenciosa: true })),
    );
    merge(cambiosDeRuta, recargas)
      .pipe(
        switchMap(({ id, silenciosa }) => (silenciosa ? this.recargar(id) : this.cargar(id))),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Abre el diálogo de confirmación de la cancelación, salvo que haya otra acción en curso.
   */
  pedirCancelacion(): void {
    if (this.asistentes()?.ocupado()) {
      return;
    }
    this.errorCancelacion.set(undefined);
    this.dialogoAbierto.set(true);
  }

  /**
   * Muestra el resultado de una acción sobre los asistentes y, si hace falta, recarga la
   * reserva sin mostrar el estado de carga.
   *
   * @param resultado Resultado de la acción.
   */
  alActuarSobreAsistentes(resultado: ResultadoAsistentes): void {
    this.aviso.set(resultado.aviso);
    this.errorAccion.set(resultado.error);
    this.errorCancelacion.set(undefined);
    if (resultado.recargar) {
      this.recargas.next();
    } else {
      this.recuperarFoco();
    }
  }

  /**
   * Cierra el diálogo de confirmación sin cancelar la reserva.
   */
  cerrarDialogo(): void {
    this.dialogoAbierto.set(false);
  }

  /**
   * Envía la cancelación. Si va bien, vuelve al listado con un aviso; si la reserva ya no
   * existía (`404`) o el servidor no lo permite (`403`), lo indica. Mientras hay una
   * cancelación en curso se ignoran nuevas confirmaciones.
   */
  confirmarCancelacion(): void {
    const reserva = this.reserva();
    if (!reserva || this.cancelando()) {
      return;
    }
    this.cancelando.set(true);
    this.reservasService
      .cancelar(reserva.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.volverAlListado(),
        error: (err: unknown) => {
          this.cancelando.set(false);
          this.cerrarDialogo();
          const problema = aProblemDetail(err);
          if (problema.status === 404) {
            this.marcarNoEncontrada();
            this.recuperarFoco();
          } else if (problema.status === 403) {
            this.errorCancelacion.set(MENSAJE_CANCELACION_SIN_PERMISO);
          } else {
            this.errorCancelacion.set(problema.detail ?? problema.title);
          }
        },
      });
  }

  /**
   * Carga la reserva y, después, el nombre de su sala, y los muestra a la vez (sin
   * parpadeo). Si el id no es válido o la reserva no existe, lo indica sin pedir las salas.
   *
   * @param id Identificador recibido en la ruta.
   */
  private cargar(id: number): Observable<unknown> {
    this.reiniciar();
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.marcarNoEncontrada();
      return EMPTY;
    }
    return this.reservasService.obtener(id).pipe(
      switchMap((reserva) => this.salaDe(reserva.salaId).pipe(map((sala) => ({ reserva, sala })))),
      map(({ reserva, sala }) => {
        this.reserva.set(reserva);
        this.sala.set(sala);
        this.cargando.set(false);
        return reserva;
      }),
      catchError((err: unknown) => {
        const problema = aProblemDetail(err);
        if (problema.status === 404) {
          this.marcarNoEncontrada();
        } else {
          this.error.set(problema.detail ?? problema.title);
          this.cargando.set(false);
        }
        return EMPTY;
      }),
    );
  }

  /**
   * Recarga la reserva mostrada sin estado de carga y conservando la sala. Si ya no existe
   * (`404`), lo indica; si falla por otro motivo, avisa y conserva la reserva mostrada. Al
   * terminar, recupera el foco si se ha perdido (por ejemplo, al quitar una invitación).
   *
   * @param id Identificador de la reserva mostrada.
   */
  private recargar(id: number): Observable<unknown> {
    this.errorRecarga.set(undefined);
    if (!Number.isSafeInteger(id)) {
      return EMPTY;
    }
    return this.reservasService.obtener(id).pipe(
      map((reserva) => {
        this.reserva.set(reserva);
        this.recuperarFoco();
        return reserva;
      }),
      catchError((err: unknown) => {
        const problema = aProblemDetail(err);
        if (problema.status === 404) {
          this.aviso.set(undefined);
          this.errorAccion.set(undefined);
          this.marcarNoEncontrada();
        } else {
          this.errorRecarga.set(MENSAJE_RECARGA_RESERVA_FALLIDA);
        }
        this.recuperarFoco();
        return EMPTY;
      }),
    );
  }

  /**
   * Sala de la reserva, o `undefined` si no se encuentra o no se pueden cargar las salas
   * (también si el interceptor corta la petición sin emitir).
   */
  private salaDe(salaId: number): Observable<Sala | undefined> {
    return this.salasService.listar().pipe(
      map((salas: Sala[]) => salas.find((sala) => sala.id === salaId)),
      catchError(() => of(undefined)),
      defaultIfEmpty(undefined),
    );
  }

  /**
   * Vuelve al listado con el aviso de cancelación. `cancelando` sigue a `true` mientras se
   * navega, para que no se pueda lanzar un segundo `DELETE`; solo se libera si la navegación
   * no se completa.
   */
  private volverAlListado(): void {
    this.cerrarDialogo();
    this.router.navigate(['/reservas'], { state: { [CLAVE_AVISO]: AVISO_RESERVA_CANCELADA } }).then(
      (navegado) => {
        if (!navegado) {
          this.cancelando.set(false);
        }
      },
      () => this.cancelando.set(false),
    );
  }

  private reiniciar(): void {
    this.reserva.set(undefined);
    this.sala.set(undefined);
    this.aviso.set(undefined);
    this.errorAccion.set(undefined);
    this.errorRecarga.set(undefined);
    this.noEncontrada.set(false);
    this.error.set(undefined);
    this.errorCancelacion.set(undefined);
    this.dialogoAbierto.set(false);
    this.cancelando.set(false);
    this.cargando.set(true);
  }

  /**
   * Si el foco se ha perdido (botón desaparecido o diálogo cerrado), lo lleva al título de
   * «Asistentes» si sigue en la página o, si no, al de la página.
   */
  private recuperarFoco(): void {
    afterNextRender(
      () => {
        const titulo = this.tituloRef().nativeElement;
        const documento = titulo.ownerDocument;
        if (focoPerdido(documento)) {
          (documento.getElementById(ID_TITULO_ASISTENTES) ?? titulo).focus();
        }
      },
      { injector: this.injector },
    );
  }

  private marcarNoEncontrada(): void {
    this.reserva.set(undefined);
    this.noEncontrada.set(true);
    this.cargando.set(false);
  }
}
