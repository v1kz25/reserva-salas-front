/** Mensaje que se muestra tras cancelar una reserva. */
export const AVISO_RESERVA_CANCELADA = 'Reserva cancelada. La franja ha quedado libre.';

/** Mensaje que se muestra si la reserva ya no existía al cancelarla (`404`). */
export const MENSAJE_RESERVA_YA_CANCELADA =
  'La reserva ya no existe: puede que se haya cancelado desde otra pestaña o por otra persona. ' +
  'Se ha actualizado el listado.';

/**
 * Mensaje que se muestra si el servidor rechaza la cancelación (`403`): puede ser por permisos
 * o por el token CSRF, así que no es categórico.
 */
export const MENSAJE_CANCELACION_SIN_PERMISO =
  'No se ha podido cancelar la reserva: no tienes permiso o tu sesión ha caducado. ' +
  'Recarga la página e inténtalo de nuevo.';

/** Aviso si falla la recarga silenciosa del detalle de una reserva (se conservan los datos mostrados). */
export const MENSAJE_RECARGA_RESERVA_FALLIDA =
  'No se ha podido actualizar la reserva: puede que no esté al día. Recarga la página para verla actualizada.';

/** Utilidades del aviso en el estado de navegación, compartidas con otras pantallas. */
export { CLAVE_AVISO, leerAviso, limpiarAvisoDelHistorial } from '../../shared/utils/aviso-navegacion';
