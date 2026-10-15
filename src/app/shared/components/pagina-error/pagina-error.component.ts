import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  viewChild,
} from '@angular/core';

/**
 * PaginaErrorComponent — maqueta común de las páginas de error: título, contenido
 * proyectado y acciones. Al mostrarse, mueve el foco al título para que los
 * lectores de pantalla anuncien la página.
 *
 * Uso:
 * ```html
 * <app-pagina-error titulo="Servicio no disponible">
 *   <p>Mensaje…</p>
 *   <div acciones><button type="button">Reintentar</button></div>
 * </app-pagina-error>
 * ```
 */
@Component({
  selector: 'app-pagina-error',
  templateUrl: './pagina-error.component.html',
  styleUrl: './pagina-error.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginaErrorComponent {
  /** Título visible de la página (`h1`). */
  readonly titulo = input.required<string>();

  /** Referencia al título, que recibe el foco al entrar. */
  private readonly tituloRef = viewChild.required<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Identificador del título, usado por `aria-labelledby`. */
  protected readonly idTitulo = 'titulo-pagina-error';

  constructor() {
    afterNextRender(() => this.tituloRef().nativeElement.focus());
  }
}
