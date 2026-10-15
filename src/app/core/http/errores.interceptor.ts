import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { EMPTY, Observable, catchError, from, switchMap, throwError } from 'rxjs';

import { SesionService } from '../services/sesion.service';
import { esErrorPropio } from './errores-propios';
import { clasificarErrorGrave } from './problem-detail';
import { PARAM_RETURN_URL, RUTA_ERROR, RUTA_LOGIN, esRutaDeError, esRutaLogin, rutaInternaSegura } from './rutas-error';
import { UltimoErrorService } from './ultimo-error.service';

/**
 * Interceptor HTTP que gestiona de forma centralizada la sesión caducada y los errores graves:
 *
 * - 401 → limpia el usuario y lleva a `/login?returnUrl=…`, salvo si la sesión ha cambiado
 *   desde que salió la petición (entonces solo se propaga el error)
 * - status 0, 502, 503, 504 o 5xx sin `ProblemDetail` válido → `/error/no-disponible?returnUrl=…`
 * - 5xx con `ProblemDetail` → `/error/inesperado`
 * - 403 → `/error/sin-permiso`
 *
 * Quien hace la petición puede gestionar él mismo algunos estados indicándolo en el
 * contexto con `conErroresPropios(...)` (por ejemplo, el `401` del login o el `403` de
 * cancelar una reserva): esos errores se propagan sin cambios.
 *
 * Cuando redirige, la petición termina sin valor ni error (`EMPTY`) una vez completada
 * la navegación, para que el componente que la hizo no muestre además su propio mensaje.
 * Si la navegación no se completa (resuelve `false` o falla), se propaga el error HTTP
 * original para que el componente no se quede en estado de carga. El resto de errores
 * (`400`, `404`, `409`…) se propagan sin cambios.
 */
export const erroresInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const ultimoError = inject(UltimoErrorService);
  const sesion = inject(SesionService);
  const generacion = sesion.generacion();

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || esErrorPropio(req, error.status)) {
        return throwError(() => error);
      }
      const origen = urlActual(router);
      if (error.status === 401) {
        if (sesion.generacion() !== generacion) {
          // La petición salió con otra sesión (p. ej. antes de un login nuevo): no se cierra la actual.
          return throwError(() => error);
        }
        sesion.limpiar();
        if (esRutaLogin(origen)) {
          return EMPTY;
        }
        const returnUrl = rutaInternaSegura(origen);
        const extras = returnUrl ? { queryParams: { [PARAM_RETURN_URL]: returnUrl } } : {};
        return navegarOFallar(router, RUTA_LOGIN, extras, error);
      }
      const tipo = clasificarErrorGrave(error);
      if (!tipo) {
        return throwError(() => error);
      }
      if (esRutaDeError(origen)) {
        // Ya se está mostrando (o se va a mostrar) una página de error: no se encadenan redirecciones.
        return EMPTY;
      }
      if (tipo === 'inesperado') {
        // `clasificarErrorGrave` solo devuelve «inesperado» si el cuerpo es un `ProblemDetail`.
        ultimoError.problema.set(error.error);
      }
      const returnUrl = tipo === 'no-disponible' ? rutaInternaSegura(origen) : undefined;
      const extras = returnUrl ? { queryParams: { [PARAM_RETURN_URL]: returnUrl } } : {};
      return navegarOFallar(router, RUTA_ERROR[tipo], extras, error, () => ultimoError.problema.set(undefined));
    }),
  );
};

/** URL de la navegación en curso o, si no la hay, la URL actual del router. */
function urlActual(router: Router): string {
  const navegacion = router.getCurrentNavigation();
  return router.serializeUrl(navegacion?.finalUrl ?? navegacion?.extractedUrl ?? router.parseUrl(router.url));
}

/**
 * Navega a `ruta` y termina sin valor si lo consigue; si no, ejecuta `alFallar` y
 * propaga el error HTTP original.
 */
function navegarOFallar(
  router: Router,
  ruta: string,
  extras: NavigationExtras,
  error: HttpErrorResponse,
  alFallar?: () => void,
): Observable<never> {
  return from(router.navigate([ruta], extras)).pipe(
    catchError(() => [false]),
    switchMap((navegado) => {
      if (navegado) {
        return EMPTY;
      }
      alFallar?.();
      return throwError(() => error);
    }),
  );
}
