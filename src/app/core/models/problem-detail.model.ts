/**
 * Error de validación de un campo concreto (`ErrorCampo` del contrato).
 */
export interface ErrorCampo {
  /** Nombre del campo de la petición. */
  campo: string;
  /** Mensaje de error del campo. */
  mensaje: string;
}

/**
 * Error de la API según RFC 9457 (`ProblemDetail` del contrato).
 */
export interface ProblemDetail {
  /** URI del tipo de error. */
  type?: string;
  /** Resumen del error. */
  title: string;
  /** Código HTTP. */
  status: number;
  /** Explicación concreta del error. */
  detail?: string;
  /** Recurso que ha provocado el error. */
  instance?: string;
  /** Errores por campo (solo en `400`). */
  errores?: ErrorCampo[];
}
