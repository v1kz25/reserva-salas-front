/** Número mínimo de caracteres para lanzar una búsqueda (el contrato exige de 2 a 100). */
export const MIN_BUSQUEDA = 2;

/** Número máximo de caracteres de una búsqueda. */
export const MAX_BUSQUEDA = 100;

/** Espera, en milisegundos, desde la última pulsación hasta lanzar la búsqueda. */
export const ESPERA_BUSQUEDA_MS = 300;

/**
 * Aviso tras enviar una solicitud de amistad.
 *
 * @param nombre Nombre de la persona.
 */
export function avisoSolicitudEnviada(nombre: string): string {
  return `Solicitud de amistad enviada a ${nombre}.`;
}

/**
 * Aviso tras aceptar una solicitud.
 *
 * @param nombre Nombre de la persona.
 */
export function avisoSolicitudAceptada(nombre: string): string {
  return `Has aceptado la solicitud de ${nombre}: ya sois amigos.`;
}

/**
 * Aviso tras rechazar una solicitud.
 *
 * @param nombre Nombre de la persona.
 */
export function avisoSolicitudRechazada(nombre: string): string {
  return `Has rechazado la solicitud de ${nombre}.`;
}

/**
 * Aviso tras retirar una solicitud enviada.
 *
 * @param nombre Nombre de la persona.
 */
export function avisoSolicitudRetirada(nombre: string): string {
  return `Has retirado la solicitud enviada a ${nombre}.`;
}

/**
 * Aviso tras eliminar una amistad.
 *
 * @param nombre Nombre de la persona.
 */
export function avisoAmistadEliminada(nombre: string): string {
  return `${nombre} ya no está en tu lista de amigos.`;
}

/**
 * Mensaje si ya sois amigos o ya hay una solicitud pendiente entre los dos (`409`).
 *
 * @param nombre Nombre de la persona.
 */
export function mensajeSolicitudDuplicada(nombre: string): string {
  return (
    `No se ha enviado la solicitud: ${nombre} y tú ya sois amigos o ya hay una solicitud ` +
    'pendiente entre vosotros. Se han actualizado las listas.'
  );
}

/**
 * Mensaje si la persona ya no existe o está desactivada al enviarle la solicitud (`404`).
 *
 * @param nombre Nombre de la persona.
 */
export function mensajeUsuarioNoDisponible(nombre: string): string {
  return `No se ha enviado la solicitud: ${nombre} ya no está disponible.`;
}

/** Mensaje si la solicitud ya no está pendiente al aceptarla, rechazarla o retirarla (`404`). */
export const MENSAJE_SOLICITUD_NO_PENDIENTE =
  'La solicitud ya no está pendiente: puede que se haya aceptado, rechazado o retirado desde otra pestaña ' +
  'o por la otra persona. Se han actualizado las listas.';

/** Mensaje si la amistad ya no existía al eliminarla (`404`). */
export const MENSAJE_AMISTAD_NO_EXISTE =
  'Ya no erais amigos: puede que la amistad se haya eliminado desde otra pestaña o por la otra persona. ' +
  'Se han actualizado las listas.';

/** Aviso si falla la recarga silenciosa de las listas (se conservan las mostradas). */
export const MENSAJE_RECARGA_FALLIDA =
  'No se han podido actualizar las listas de amistades: puede que no estén al día. ' +
  'Recarga la página para verlas actualizadas.';

/**
 * Texto accesible del indicador de solicitudes pendientes de la cabecera.
 *
 * @param total Número de solicitudes recibidas pendientes.
 */
export function textoPendientes(total: number): string {
  return total === 1 ? '(1 solicitud pendiente)' : `(${total} solicitudes pendientes)`;
}
