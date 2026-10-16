import { EstadoInvitacion } from '../../core/models/invitacion.model';

/** Texto visible de cada estado de invitación. */
export const ESTADO_INVITACION: Readonly<Record<EstadoInvitacion, string>> = {
  PENDIENTE: 'Pendiente',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
};

/**
 * Texto accesible del indicador de invitaciones pendientes de la cabecera.
 *
 * @param total Número de invitaciones pendientes.
 */
export function textoInvitacionesPendientes(total: number): string {
  return total === 1 ? '(1 invitación pendiente)' : `(${total} invitaciones pendientes)`;
}

/**
 * Aviso tras invitar a un amigo.
 *
 * @param nombre Nombre del amigo.
 */
export function avisoInvitacionEnviada(nombre: string): string {
  return `Invitación enviada a ${nombre}.`;
}

/**
 * Aviso tras retirar una invitación.
 *
 * @param nombre Nombre del invitado.
 */
export function avisoInvitacionRetirada(nombre: string): string {
  return `Has retirado la invitación de ${nombre}.`;
}

/** Aviso tras aceptar una invitación. */
export const AVISO_INVITACION_ACEPTADA = 'Has aceptado la invitación: asistirás a la reserva.';

/** Aviso tras rechazar una invitación pendiente. */
export const AVISO_INVITACION_RECHAZADA = 'Has rechazado la invitación.';

/** Aviso tras dejar de asistir a una reserva cuya invitación se había aceptado. */
export const AVISO_DEJAR_DE_ASISTIR = 'Ya no asistirás a la reserva.';

/** Mensaje si se intenta invitar sin elegir a nadie. */
export const MENSAJE_ELIGE_AMIGO = 'Elige a un amigo para invitarle.';

/** Mensaje si el servidor rechaza la invitación por ser a uno mismo (`400`). */
export const MENSAJE_INVITACION_A_TI_MISMO = 'No puedes invitarte a ti mismo a tu propia reserva.';

/**
 * Mensaje si el servidor rechaza la invitación por permisos (`403`): solo invita el organizador,
 * pero también puede ser por el token CSRF, así que no es categórico.
 */
export const MENSAJE_INVITAR_SIN_PERMISO =
  'No se ha podido completar la acción: solo el organizador gestiona las invitaciones, o tu sesión ha ' +
  'caducado. Recarga la página e inténtalo de nuevo.';

/**
 * Mensaje si no se puede invitar a alguien (`409`): no es amigo, ya está invitado, se supera el
 * aforo o la reserva ya ha pasado. Si el servidor explica el motivo, se usa; si no, se enumeran
 * las causas posibles.
 *
 * @param nombre Nombre del amigo.
 * @param detalle Explicación del servidor, si la hay.
 */
export function mensajeInvitacionRechazadaPorServidor(nombre: string, detalle?: string): string {
  const motivo =
    detalle ??
    'ya no sois amigos, ya tiene una invitación, la sala está completa o la reserva ya ha pasado.';
  return `No se ha podido invitar a ${nombre}: ${conPunto(motivo)} Se ha actualizado la reserva.`;
}

/** Mensaje si la invitación ya no existe al retirarla, aceptarla o rechazarla (`404`). */
export const MENSAJE_INVITACION_NO_EXISTE =
  'La invitación ya no existe: puede que se haya retirado o que la reserva se haya cancelado. ' +
  'Se ha actualizado la información.';

/**
 * Mensaje si no se puede responder a una invitación (`409`): ya no está pendiente (o ya estaba
 * rechazada) o la reserva ya ha pasado.
 *
 * @param detalle Explicación del servidor, si la hay.
 */
export function mensajeRespuestaNoPosible(detalle?: string): string {
  const motivo = detalle ?? 'la invitación ya no está pendiente o la reserva ya ha pasado.';
  return `No se ha podido responder a la invitación: ${conPunto(motivo)} Se ha actualizado la información.`;
}

/** Aviso si falla la recarga silenciosa de las invitaciones (se conservan las mostradas). */
export const MENSAJE_RECARGA_INVITACIONES_FALLIDA =
  'No se han podido actualizar las invitaciones: puede que no estén al día. Recarga la página para verlas.';

/** Añade un punto final al texto si no termina ya en un signo de puntuación. */
function conPunto(texto: string): string {
  const recortado = texto.trim();
  return /[.!?…]$/.test(recortado) ? recortado : `${recortado}.`;
}
