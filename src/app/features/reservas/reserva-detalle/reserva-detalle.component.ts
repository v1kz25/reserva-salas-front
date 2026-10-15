import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, defaultIfEmpty, map, of, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { Reserva } from '../../../core/models/reserva.model';
import { Sala } from '../../../core/models/sala.model';
import { ReservasService } from '../../../core/services/reservas.service';
import { SalasService } from '../../../core/services/salas.service';
import { SesionService } from '../../../core/services/sesion.service';
import { DialogoConfirmacionComponent } from '../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component';
import { HoraPipe } from '../../../shared/pipes/hora.pipe';
import { focoPerdido } from '../../../shared/utils/foco';
import { AVISO_RESERVA_CANCELADA, CLAVE_AVISO, MENSAJE_CANCELACION_SIN_PERMISO } from '../reserva-cancelacion';

/**
 * ReservaDetalleComponent — muestra los datos de una reserva y permite cancelarla
 * tras confirmarlo en un diálogo, si es del usuario o si es administrador.
 */
@Component({
  selector: 'app-reserva-detalle',
  imports: [RouterLink, DatePipe, HoraPipe, DialogoConfirmacionComponent],
  templateUrl: './reserva-detalle.component.html',
  styleUrl: './reserva-detalle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservaDetalleComponent {
  /** Título de la página, que recibe el foco si el elemento enfocado desaparece al cancelar. */
  private readonly tituloRef = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Reserva mostrada, una vez cargada. */
  protected readonly reserva = signal<Reserva | undefined>(undefined);

  /** Nombre de la sala de la reserva, si se ha podido resolver. */
  protected readonly nombreSala = signal<string | undefined>(undefined);

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

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        switchMap((id) => this.cargar(id)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Abre el diálogo de confirmación de la cancelación.
   */
  pedirCancelacion(): void {
    this.errorCancelacion.set(undefined);
    this.dialogoAbierto.set(true);
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
      switchMap((reserva) => this.nombreDeSala(reserva.salaId).pipe(map((nombre) => ({ reserva, nombre })))),
      map(({ reserva, nombre }) => {
        this.reserva.set(reserva);
        this.nombreSala.set(nombre);
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
   * Nombre de la sala, o «Sala N» si no se encuentra o no se pueden cargar las salas
   * (también si el interceptor corta la petición sin emitir).
   */
  private nombreDeSala(salaId: number): Observable<string> {
    const porDefecto = `Sala ${salaId}`;
    return this.salasService.listar().pipe(
      map((salas: Sala[]) => salas.find((sala) => sala.id === salaId)?.nombre ?? porDefecto),
      catchError(() => of(porDefecto)),
      defaultIfEmpty(porDefecto),
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
    this.nombreSala.set(undefined);
    this.noEncontrada.set(false);
    this.error.set(undefined);
    this.errorCancelacion.set(undefined);
    this.dialogoAbierto.set(false);
    this.cancelando.set(false);
    this.cargando.set(true);
  }

  /** Si el foco se ha perdido (botón desaparecido o diálogo cerrado), lo lleva al título. */
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

  private marcarNoEncontrada(): void {
    this.reserva.set(undefined);
    this.noEncontrada.set(true);
    this.cargando.set(false);
  }
}
