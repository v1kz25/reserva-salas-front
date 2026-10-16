import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { RUTA_LOGIN } from './core/http/rutas-error';
import { AmistadesService } from './core/services/amistades.service';
import { AuthService } from './core/services/auth.service';
import { ConfiguracionService } from './core/services/configuracion.service';
import { InvitacionesService } from './core/services/invitaciones.service';
import { SesionService } from './core/services/sesion.service';
import { textoPendientes } from './features/amistades/amistades-mensajes';
import { textoInvitacionesPendientes } from './features/invitaciones/invitaciones-mensajes';

/**
 * AppComponent — layout raíz con la cabecera de la aplicación (marca, enlace «Mis reservas»
 * con el número de invitaciones pendientes, enlace «Amigos» con el número de solicitudes
 * recibidas pendientes, enlaces de administración si el usuario es
 * `ADMIN`, usuario en sesión y botón «Salir») y el contenedor de rutas. Al iniciar cada sesión
 * carga la zona horaria del servidor en `ConfiguracionService`.
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
  private readonly invitaciones = inject(InvitacionesService);
  private readonly configuracion = inject(ConfiguracionService);
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
   * Número de invitaciones a reservas pendientes de responder. Se pide al iniciar la sesión y
   * al volver a la pestaña, y se actualiza al listarlas y al aceptar o rechazar una.
   */
  protected readonly invitacionesPendientes = this.invitaciones.numeroPendientes;

  /** Texto accesible del indicador de invitaciones pendientes. */
  protected readonly textoInvitaciones = computed(() => textoInvitacionesPendientes(this.invitacionesPendientes()));

  constructor() {
    // Una vez por sesión (login o comprobación al arrancar) se pide la zona horaria del servidor,
    // para que cualquier pantalla (p. ej. el detalle, que decide si una reserva ya ha pasado) la
    // tenga sin pedirla. No bloquea nada: si falla, se sigue usando la del navegador.
    effect(() => {
      if (this.sesion.estado() !== 'autenticado') {
        return;
      }
      this.sesion.generacion();
      untracked(() =>
        this.configuracion
          .obtenerZonaHoraria(true)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ error: () => undefined }),
      );
    });
  }

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
