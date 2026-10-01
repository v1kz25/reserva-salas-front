import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { PARAM_RETURN_URL, RUTA_INICIO, rutaInternaSegura } from '../../../core/http/rutas-error';
import { PaginaErrorComponent } from '../../../shared/components/pagina-error/pagina-error.component';

/**
 * NoDisponibleComponent — página que se muestra cuando el servidor no responde
 * (sin conexión, gateway caído o 5xx sin `ProblemDetail`). «Reintentar» vuelve a la
 * URL de origen (`returnUrl`, solo rutas internas) o, si no la hay, a `/reservas`.
 */
@Component({
  selector: 'app-no-disponible',
  imports: [PaginaErrorComponent],
  templateUrl: './no-disponible.component.html',
  styleUrl: './no-disponible.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoDisponibleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** URL de origen recibida en el query param, sin validar. */
  private readonly returnUrl = toSignal(this.route.queryParamMap.pipe(map((params) => params.get(PARAM_RETURN_URL))));

  /** Ruta interna a la que vuelve «Reintentar». */
  protected readonly destino = computed(() => rutaInternaSegura(this.returnUrl()) ?? RUTA_INICIO);

  /**
   * Vuelve a la página de origen para repetir la carga.
   */
  reintentar(): void {
    void this.router.navigateByUrl(this.destino());
  }
}
