import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { RUTA_LOGIN } from './core/http/rutas-error';
import { AuthService } from './core/services/auth.service';
import { SesionService } from './core/services/sesion.service';

/**
 * AppComponent — layout raíz con la cabecera de la aplicación (marca, enlaces de
 * administración si el usuario es `ADMIN`, usuario en sesión y botón «Salir») y el
 * contenedor de rutas.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /** Indica si se está cerrando la sesión. */
  protected readonly saliendo = signal(false);

  /** Estado de la sesión, para mostrar el usuario en la cabecera. */
  protected readonly sesion = inject(SesionService);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Nombre visible de la aplicación. */
  readonly title = 'Reserva de salas';

  /**
   * Cierra la sesión (`POST /api/auth/logout`) y lleva a `/login`, también si el servidor
   * falla. Mientras hay un cierre en curso se ignoran nuevas pulsaciones.
   */
  salir(): void {
    if (this.saliendo()) {
      return;
    }
    this.saliendo.set(true);
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.router.navigate([RUTA_LOGIN]).finally(() => this.saliendo.set(false));
      });
  }
}
