/** Mensaje que se muestra tras cancelar una reserva. */
export const AVISO_RESERVA_CANCELADA = 'Reserva cancelada. La franja ha quedado libre.';

/** Mensaje que se muestra si la reserva ya no existía al cancelarla (`404`). */
export const MENSAJE_RESERVA_YA_CANCELADA =
  'La reserva ya no existe: puede que se haya cancelado desde otra pestaña o por otra persona. ' +
  'Se ha actualizado el listado.';

/** Mensaje que se muestra si el servidor no permite cancelar la reserva (`403`). */
export const MENSAJE_CANCELACION_SIN_PERMISO =
  'No tienes permiso para cancelar esta reserva: solo puede cancelarla quien la hizo o un administrador.';

/** Clave del estado de navegación con el aviso que debe mostrar el listado. */
export const CLAVE_AVISO = 'aviso';

/**
 * Lee el aviso que otra pantalla deja en el estado de navegación al volver al listado.
 *
 * @param estado Estado de la navegación (`Navigation.extras.state`).
 * @returns El aviso, si es un texto no vacío.
 */
export function leerAviso(estado: Record<string, unknown> | undefined): string | undefined {
  const aviso = estado?.[CLAVE_AVISO];
  return typeof aviso === 'string' && aviso ? aviso : undefined;
}

/**
 * Quita el aviso del estado de la entrada actual del historial, para que no vuelva
 * a mostrarse al navegar hacia atrás o adelante. Conserva el resto del estado del router.
 *
 * @param historial Historial del navegador.
 */
export function limpiarAvisoDelHistorial(historial: History): void {
  const estado: unknown = historial.state;
  if (typeof estado !== 'object' || estado === null || !(CLAVE_AVISO in estado)) {
    return;
  }
  const resto: Record<string, unknown> = { ...(estado as Record<string, unknown>) };
  delete resto[CLAVE_AVISO];
  historial.replaceState(resto, '');
}
