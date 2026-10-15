import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map } from 'rxjs';

import { RUTA_INICIO } from '../http/rutas-error';
import { SesionService } from '../services/sesion.service';
import { redirigirSinSesion, resolverEstado } from './sesion.guard';

/**
 * Guard de las rutas de administración. Un usuario autenticado que no es `ADMIN` va a
 * `/reservas`.
 *
 * Si no hay sesión, redirige igual que `sesionGuard` (a `/login` o a `/error/no-disponible`,
 * con `returnUrl`), para que también proteja la ruta si se usa solo. Se recomienda
 * `[sesionGuard, adminGuard]`: ambos comparten la misma comprobación de la sesión con el servidor.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const sesion = inject(SesionService);

  return resolverEstado().pipe(
    map((estado): boolean | UrlTree => {
      if (estado !== 'autenticado') {
        return redirigirSinSesion(router, estado, state.url);
      }
      return sesion.esAdmin() ? true : router.createUrlTree([RUTA_INICIO]);
    }),
  );
};
