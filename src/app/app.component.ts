import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { RUTA_LOGIN } from './core/http/rutas-error';
import { AmistadesService } from './core/services/amistades.service';
import { AuthService } from './core/services/auth.service';
import { SesionService } from './core/services/sesion.service';
import { textoPendientes } from './features/amistades/amistades-mensajes';

/**
 * AppComponent — layout raíz con la cabecera de la aplicación (marca, enlace «Amigos» con
 * el número de solicitudes recibidas pendientes, enlaces de administración si el usuario es
 * `ADMIN`, usuario en sesión y botón «Salir») y el contenedor de rutas.
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

  private readonly amistades = inject(AmistadesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Nombre visible de la aplicación. */
  readonly title = 'Reserva de salas';

  /**
   * Número de solicitudes de amistad recibidas pendientes. Se pide al iniciar la sesión
   * y se actualiza al entrar en `/amigos` y al aceptar o rechazar una solicitud.
   */
  protected readonly pendientes = this.amistades.pendientes;

  /** Texto accesible del indicador de solicitudes pendientes. */
  protected readonly textoPendientes = computed(() => textoPendientes(this.pendientes()));

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
