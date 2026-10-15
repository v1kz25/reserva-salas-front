import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, finalize, map, merge, of, switchMap } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { Sala } from '../../../core/models/sala.model';
import { SalasService } from '../../../core/services/salas.service';
import { DialogoConfirmacionComponent } from '../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component';
import { leerAviso, limpiarAvisoDelHistorial } from '../../../shared/utils/aviso-navegacion';
import { focoPerdido } from '../../../shared/utils/foco';
import {
  MENSAJE_RECARGA_FALLIDA,
  MENSAJE_SALA_YA_ELIMINADA,
  RUTA_SALAS_ADMIN,
  avisoSalaEliminada,
  mensajeSalaConReservas,
} from '../sala-mensajes';

/**
 * SalaListComponent — listado de salas para administradores, con acceso a crear y editar
 * y con eliminación tras confirmarla en un diálogo.
 */
@Component({
  selector: 'app-sala-list',
  imports: [RouterLink, DialogoConfirmacionComponent],
  templateUrl: './sala-list.component.html',
  styleUrl: './sala-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalaListComponent {
  /** Título de la página, que recibe el foco si el elemento enfocado desaparece al eliminar. */
  private readonly tituloRef = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Salas del listado. */
  protected readonly salas = signal<Sala[]>([]);

  /** Indica si se están cargando las salas. */
  protected readonly cargando = signal(true);

  /** Mensaje de error al cargar las salas, si lo hay. */
  protected readonly error = signal<string | undefined>(undefined);

  /** Sala pendiente de confirmar su eliminación (diálogo abierto), si la hay. */
  protected readonly salaAEliminar = signal<Sala | undefined>(undefined);

  /** Indica si se está enviando la eliminación. */
  protected readonly eliminando = signal(false);

  /** Mensaje de éxito (alta, modificación o eliminación), si lo hay. */
  protected readonly aviso = signal<string | undefined>(undefined);

  /** Mensaje de error al eliminar una sala, si lo hay. */
  protected readonly errorEliminacion = signal<string | undefined>(undefined);

  /** Aviso si falla la recarga silenciosa del listado (se conservan las salas mostradas). */
  protected readonly errorRecarga = signal<string | undefined>(undefined);

  private readonly salasService = inject(SalasService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Ruta del alta de salas, para la plantilla. */
  protected readonly rutaNueva = `${RUTA_SALAS_ADMIN}/nueva`;

  /** Ruta del listado de salas, para la plantilla. */
  protected readonly rutaSalas = RUTA_SALAS_ADMIN;

  /** Peticiones de recarga del listado sin mostrar el estado de carga (tras eliminar). */
  private readonly recarga = new Subject<void>();

  constructor() {
    this.aviso.set(leerAviso(this.router.getCurrentNavigation()?.extras.state));
    if (this.aviso()) {
      // Se limpia tras el primer render, cuando el router ya ha actualizado la entrada del historial.
      afterNextRender(() => {
        const historial = this.document.defaultView?.history;
        if (historial) {
          limpiarAvisoDelHistorial(historial);
        }
      });
    }

    merge(of(false), this.recarga.pipe(map(() => true)))
      .pipe(
        switchMap((silenciosa) => {
          this.errorRecarga.set(undefined);
          if (!silenciosa) {
            this.cargando.set(true);
            this.error.set(undefined);
          }
          return this.salasService.listar().pipe(
            catchError((err: unknown) => {
              const problema = aProblemDetail(err);
              if (silenciosa) {
                // Se conserva el listado actual y solo se avisa de que puede no estar al día.
                this.errorRecarga.set(MENSAJE_RECARGA_FALLIDA);
                return of(this.salas());
              }
              this.error.set(problema.detail ?? problema.title);
              return of<Sala[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((salas) => {
        this.salas.set(salas);
        this.cargando.set(false);
      });
  }

  /**
   * Abre el diálogo de confirmación para eliminar una sala.
   *
   * @param sala Sala que se quiere eliminar.
   */
  pedirEliminacion(sala: Sala): void {
    if (this.eliminando()) {
      return;
    }
    this.aviso.set(undefined);
    this.errorEliminacion.set(undefined);
    this.salaAEliminar.set(sala);
  }

  /**
   * Cierra el diálogo de confirmación sin eliminar la sala.
   */
  cerrarDialogo(): void {
    this.salaAEliminar.set(undefined);
  }

  /**
   * Envía la eliminación de la sala confirmada. Si va bien, la quita del listado y lo recarga;
   * si tiene reservas futuras (`409`), lo indica y recarga el listado; si ya no existía
   * (`404`), lo indica, la quita y recarga el listado. Mientras hay una eliminación en curso
   * se ignoran nuevas confirmaciones.
   */
  confirmarEliminacion(): void {
    const sala = this.salaAEliminar();
    if (!sala || this.eliminando()) {
      return;
    }
    this.eliminando.set(true);
    this.salasService
      .eliminar(sala.id)
      .pipe(
        finalize(() => this.eliminando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.cerrarDialogo();
          this.quitarDelListado(sala.id);
          this.aviso.set(avisoSalaEliminada(sala.nombre));
          this.recarga.next();
          this.recuperarFoco();
        },
        error: (err: unknown) => {
          const problema = aProblemDetail(err);
          this.cerrarDialogo();
          if (problema.status === 409) {
            this.errorEliminacion.set(mensajeSalaConReservas(sala.nombre));
            this.recarga.next();
          } else if (problema.status === 404) {
            this.quitarDelListado(sala.id);
            this.errorEliminacion.set(MENSAJE_SALA_YA_ELIMINADA);
            this.recarga.next();
          } else {
            this.errorEliminacion.set(problema.detail ?? problema.title);
          }
          this.recuperarFoco();
        },
      });
  }

  private quitarDelListado(id: number): void {
    this.salas.update((salas) => salas.filter((sala) => sala.id !== id));
  }

  /** Si el foco se ha perdido (fila eliminada o diálogo cerrado), lo lleva al título. */
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
