/** Ruta del listado de salas de administración. */
export const RUTA_SALAS_ADMIN = '/admin/salas';

/**
 * Aviso que se muestra en el listado tras crear una sala.
 *
 * @param nombre Nombre de la sala creada.
 */
export function avisoSalaCreada(nombre: string): string {
  return `Sala «${nombre}» creada.`;
}

/**
 * Aviso que se muestra en el listado tras modificar una sala.
 *
 * @param nombre Nombre de la sala modificada.
 */
export function avisoSalaModificada(nombre: string): string {
  return `Sala «${nombre}» guardada.`;
}

/**
 * Aviso que se muestra en el listado tras eliminar una sala.
 *
 * @param nombre Nombre de la sala eliminada.
 */
export function avisoSalaEliminada(nombre: string): string {
  return `Sala «${nombre}» eliminada.`;
}

/**
 * Mensaje si la sala no se puede eliminar porque tiene reservas futuras (`409`).
 *
 * @param nombre Nombre de la sala.
 */
export function mensajeSalaConReservas(nombre: string): string {
  return (
    `No se puede eliminar la sala «${nombre}» porque tiene reservas futuras. ` +
    'Cancela antes esas reservas y vuelve a intentarlo.'
  );
}

/** Mensaje si la sala ya no existía al eliminarla (`404`). */
export const MENSAJE_SALA_YA_ELIMINADA =
  'La sala ya no existe: puede que se haya eliminado desde otra pestaña o por otra persona. ' +
  'Se ha actualizado el listado.';

/** Mensaje en el campo nombre si ya hay otra sala con ese nombre (`409`). */
export const MENSAJE_NOMBRE_REPETIDO = 'Ya existe una sala con ese nombre.';

/** Aviso si no se ha podido actualizar el listado tras eliminar (se conservan las salas mostradas). */
export const MENSAJE_RECARGA_FALLIDA =
  'No se ha podido actualizar el listado de salas: puede que no esté al día. Recarga la página para verlo actualizado.';
