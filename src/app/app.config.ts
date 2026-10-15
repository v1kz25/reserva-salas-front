import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { erroresInterceptor } from './core/http/errores.interceptor';
import { AuthService } from './core/services/auth.service';

/**
 * Configuración global de la aplicación: router, cliente HTTP con protección CSRF
 * y el interceptor de errores, y comprobación de la sesión al arrancar.
 *
 * Angular solo añade `X-XSRF-TOKEN` en peticiones a URLs relativas (`/api/...`),
 * que en desarrollo llegan al backend a través del proxy.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      withInterceptors([erroresInterceptor]),
    ),
    provideAppInitializer(() => firstValueFrom(inject(AuthService).restaurarSesion())),
  ],
};
