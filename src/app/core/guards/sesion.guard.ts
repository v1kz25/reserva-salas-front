import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map, of } from 'rxjs';

import { PARAM_RETURN_URL, RUTA_ERROR, RUTA_INICIO, RUTA_LOGIN, rutaInternaSegura } from '../http/rutas-error';
import { AuthService } from '../services/auth.service';
import { EstadoSesion, SesionService } from '../services/sesion.service';

/**
 * Guard de las rutas que exigen sesión. Si no hay sesión, redirige a
 * `/login?returnUrl=<url pedida>`. Si aún no se sabe (la comprobación inicial falló
 * por red o 5xx), vuelve a preguntar al servidor y, si sigue sin responder, lleva a
 * `/error/no-disponible?returnUrl=<url pedida>` para poder reintentar.
 */
export const sesionGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const returnUrl = rutaInternaSegura(state.url);
  const queryParams = returnUrl ? { [PARAM_RETURN_URL]: returnUrl } : {};

  return resolverEstado().pipe(
    map((estado): boolean | UrlTree => {
      switch (estado) {
        case 'autenticado':
          return true;
        case 'anonimo':
          return router.createUrlTree([RUTA_LOGIN], { queryParams });
        default:
          return router.createUrlTree([RUTA_ERROR['no-disponible']], { queryParams });
      }
    }),
  );
};

/**
 * Guard de `/login`: si ya hay sesión, lleva a `/reservas`. Si no se puede comprobar
 * la sesión, muestra igualmente el formulario.
 */
export const loginGuard: CanActivateFn = () => {
  const router = inject(Router);
  return resolverEstado().pipe(
    map((estado) => (estado === 'autenticado' ? router.createUrlTree([RUTA_INICIO]) : true)),
  );
};

/**
 * Estado de la sesión; si es `desconocido`, lo pregunta al servidor. Debe llamarse en
 * un contexto de inyección.
 */
function resolverEstado(): Observable<EstadoSesion> {
  const sesion = inject(SesionService);
  const auth = inject(AuthService);
  const estado = sesion.estado();
  return estado === 'desconocido' ? auth.restaurarSesion() : of(estado);
}
