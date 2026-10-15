import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UltimoErrorService } from '../../../core/http/ultimo-error.service';
import { PaginaErrorComponent } from '../../../shared/components/pagina-error/pagina-error.component';

/**
 * InesperadoComponent — página para los errores 5xx con `ProblemDetail`. Muestra el
 * título y el detalle del último error si se conoce; si no (por ejemplo, al recargar),
 * un mensaje genérico. Al salir de la página limpia el error guardado, para que no
 * se muestre otra vez si se vuelve a ella más tarde por otro motivo.
 */
@Component({
  selector: 'app-inesperado',
  imports: [PaginaErrorComponent, RouterLink],
  templateUrl: './inesperado.component.html',
  styleUrl: './inesperado.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InesperadoComponent {
  private readonly ultimoError = inject(UltimoErrorService);

  /** Último error inesperado recibido del servidor, si lo hay. */
  protected readonly problema = this.ultimoError.problema.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.ultimoError.problema.set(undefined));
  }
}
