import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, from, switchMap, throwError } from 'rxjs';

import { clasificarErrorGrave } from './problem-detail';
import { PARAM_RETURN_URL, RUTA_ERROR, esRutaDeError, rutaInternaSegura } from './rutas-error';
import { UltimoErrorService } from './ultimo-error.service';

/**
 * Interceptor HTTP que redirige los errores graves a sus páginas propias:
 *
 * - status 0, 502, 503, 504 o 5xx sin `ProblemDetail` válido → `/error/no-disponible?returnUrl=…`
 * - 5xx con `ProblemDetail` → `/error/inesperado`
 * - 403 → `/error/sin-permiso`
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

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const tipo = clasificarErrorGrave(error);
      if (!tipo) {
        return throwError(() => error);
      }
      const navegacion = router.getCurrentNavigation();
      const origen = router.serializeUrl(navegacion?.finalUrl ?? navegacion?.extractedUrl ?? router.parseUrl(router.url));
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
      return from(router.navigate([RUTA_ERROR[tipo]], extras)).pipe(
        catchError(() => [false]),
        switchMap((navegado) => {
          if (navegado) {
            return EMPTY;
          }
          ultimoError.problema.set(undefined);
          return throwError(() => error);
        }),
      );
    }),
  );
};
