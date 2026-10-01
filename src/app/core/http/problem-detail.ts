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

function esProblemDetail(valor: unknown): valor is ProblemDetail {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as ProblemDetail).title === 'string' &&
    typeof (valor as ProblemDetail).status === 'number'
  );
}
