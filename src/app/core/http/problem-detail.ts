import { HttpErrorResponse } from '@angular/common/http';

import { ProblemDetail } from '../models/problem-detail.model';

/**
 * Convierte cualquier error HTTP en un `ProblemDetail` utilizable por la UI.
 *
 * Si el cuerpo no tiene el formato del contrato (por ejemplo, el backend no
 * está arrancado), se construye uno genérico a partir del estado HTTP.
 *
 * @param error Error recibido de `HttpClient`.
 * @returns Detalle del problema, siempre con `title` y `status`.
 */
export function aProblemDetail(error: unknown): ProblemDetail {
  if (!(error instanceof HttpErrorResponse)) {
    return { title: 'Error inesperado', status: 0, detail: 'Se ha producido un error inesperado.' };
  }
  if (error.status === 0) {
    return {
      title: 'Servidor no disponible',
      status: 0,
      detail: 'No se ha podido conectar con el servidor. Inténtalo de nuevo más tarde.',
    };
  }
  const cuerpo: unknown = error.error;
  if (esProblemDetail(cuerpo)) {
    return cuerpo;
  }
  return {
    title: 'Error del servidor',
    status: error.status,
    detail: `El servidor ha respondido con un error (${error.status}).`,
  };
}

/**
 * Tipo de error grave que la aplicación gestiona con una página propia.
 *
 * - `no-disponible`: no hay respuesta, gateway caído o 5xx sin `ProblemDetail` válido.
 * - `inesperado`: 5xx con `ProblemDetail` válido (fallo controlado del backend).
 * - `sin-permiso`: `403`.
 */
export type ErrorGrave = 'no-disponible' | 'inesperado' | 'sin-permiso';

/** Estados que indican que el servicio no está disponible, tenga o no cuerpo. */
const ESTADOS_NO_DISPONIBLE: readonly number[] = [0, 502, 503, 504];

/**
 * Clasifica un error HTTP como grave o no.
 *
 * Los errores que no son graves (`400`, `404`, `409`…) devuelven `undefined`
 * y los sigue gestionando el componente que hizo la petición.
 *
 * @param error Error recibido de `HttpClient`.
 * @returns El tipo de error grave o `undefined` si no lo es.
 */
export function clasificarErrorGrave(error: HttpErrorResponse): ErrorGrave | undefined {
  if (ESTADOS_NO_DISPONIBLE.includes(error.status)) {
    return 'no-disponible';
  }
  if (error.status === 403) {
    return 'sin-permiso';
  }
  if (error.status >= 500 && error.status <= 599) {
    return esProblemDetail(error.error) ? 'inesperado' : 'no-disponible';
  }
  return undefined;
}

/**
 * Indica si un valor tiene la forma mínima de un `ProblemDetail` (RFC 9457): `title` y `status`.
 *
 * @param valor Cuerpo de la respuesta.
 */
export function esProblemDetail(valor: unknown): valor is ProblemDetail {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as ProblemDetail).title === 'string' &&
    typeof (valor as ProblemDetail).status === 'number'
  );
}
