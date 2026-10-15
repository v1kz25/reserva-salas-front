import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';

/** Contador para generar ids únicos de título y descripción por instancia. */
let siguienteId = 0;

/**
 * DialogoConfirmacionComponent — diálogo modal de confirmación basado en `<dialog>` nativo.
 *
 * - Lo abre y lo cierra el padre con el input `abierto`.
 * - Al abrirse, el foco va al botón de volver (la opción no destructiva); al cerrarse,
 *   vuelve al elemento que tenía el foco antes, si sigue en la página.
 * - `Esc` equivale a pulsar «volver», salvo mientras se procesa la confirmación.
 * - Mientras `procesando` es `true`, los botones se marcan con `aria-disabled` (no se
 *   deshabilitan para no perder el foco) e ignoran los clics, para no repetir la acción.
 *
 * Uso:
 * ```html
 * <app-dialogo-confirmacion titulo="Cancelar reserva" [abierto]="abierto()"
 *     (confirmado)="confirmar()" (cancelado)="cerrar()">
 *   <p>¿Seguro que…?</p>
 * </app-dialogo-confirmacion>
 * ```
 */
@Component({
  selector: 'app-dialogo-confirmacion',
  templateUrl: './dialogo-confirmacion.component.html',
  styleUrl: './dialogo-confirmacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoConfirmacionComponent {
  /** Elemento `<dialog>` nativo. */
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  /** Botón de volver, que recibe el foco al abrir. */
  private readonly botonVolver = viewChild<ElementRef<HTMLButtonElement>>('botonVolver');

  /** Título del diálogo (`h2`). */
  readonly titulo = input.required<string>();

  /** Indica si el diálogo está abierto. */
  readonly abierto = input(false);

  /** Texto del botón que confirma la acción. */
  readonly textoConfirmar = input('Confirmar');

  /** Texto del botón de confirmar mientras se procesa la acción. */
  readonly textoProcesando = input('Procesando…');

  /** Texto del botón que cierra el diálogo sin hacer nada. */
  readonly textoVolver = input('Volver');

  /** Indica si la acción confirmada está en curso. */
  readonly procesando = input(false);

  /** Emite cuando el usuario confirma la acción. */
  readonly confirmado = output<void>();

  /** Emite cuando el usuario cierra el diálogo sin confirmar (botón de volver o `Esc`). */
  readonly cancelado = output<void>();

  private readonly document = inject(DOCUMENT);

  /** Identificador del título, usado por `aria-labelledby`. */
  protected readonly idTitulo = `dialogo-confirmacion-titulo-${siguienteId}`;

  /** Identificador del contenido, usado por `aria-describedby`. */
  protected readonly idDescripcion = `dialogo-confirmacion-descripcion-${siguienteId++}`;

  /** Elemento que tenía el foco al abrir el diálogo. */
  private origenFoco?: HTMLElement;

  constructor() {
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;
      const abierto = this.abierto();
      if (!dialogo) {
        return;
      }
      untracked(() => {
        if (abierto) {
          this.abrir(dialogo);
        } else {
          this.cerrar(dialogo);
        }
      });
    });
  }

  /**
   * Confirma la acción, salvo que ya se esté procesando.
   */
  confirmar(): void {
    if (!this.procesando()) {
      this.confirmado.emit();
    }
  }

  /**
   * Cierra el diálogo sin confirmar, salvo que se esté procesando la acción.
   */
  volver(): void {
    if (!this.procesando()) {
      this.cancelado.emit();
    }
  }

  /**
   * Gestiona `Esc` (evento `cancel` del `<dialog>`): el cierre lo decide el padre con `abierto`.
   *
   * @param evento Evento `cancel` nativo.
   */
  alPulsarEsc(evento: Event): void {
    evento.preventDefault();
    this.volver();
  }

  /**
   * Si el navegador cierra el diálogo por su cuenta (por ejemplo, `Esc` repetido),
   * se avisa al padre para que su estado no quede abierto, salvo mientras se procesa
   * la acción: en ese caso el padre lo cerrará al terminar.
   */
  alCerrar(): void {
    if (this.abierto() && !this.procesando()) {
      this.cancelado.emit();
    }
  }

  private abrir(dialogo: HTMLDialogElement): void {
    if (dialogo.open) {
      return;
    }
    const activo = this.document.activeElement;
    this.origenFoco = activo instanceof HTMLElement ? activo : undefined;
    dialogo.showModal();
    this.botonVolver()?.nativeElement.focus();
  }

  private cerrar(dialogo: HTMLDialogElement): void {
    if (dialogo.open) {
      dialogo.close();
    }
    // El foco se restaura siempre, aunque el navegador ya hubiera cerrado el diálogo
    // por su cuenta (por ejemplo, con `Esc` repetido mientras se procesaba la acción).
    if (this.origenFoco?.isConnected) {
      this.origenFoco.focus();
    }
    this.origenFoco = undefined;
  }
}
