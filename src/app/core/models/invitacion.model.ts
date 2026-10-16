import type { Reserva } from './reserva.model';

/**
 * Estado de una invitación a una reserva (`EstadoInvitacion` del contrato).
 */
export type EstadoInvitacion = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';

/**
 * Invitación de un amigo a una reserva (`Invitacion` del contrato).
 */
export interface Invitacion {
  /** Identificador de la invitación. */
  id: number;
  /** Reserva a la que se invita. */
  reservaId: number;
  /** Usuario invitado. */
  usuarioId: number;
  /** Nombre del usuario invitado. */
  nombre: string;
  /** Estado de la invitación. */
  estado: EstadoInvitacion;
}

/**
 * Invitación del usuario en sesión a una reserva (`MiInvitacion` del contrato): viene en
 * `Reserva.miInvitacion` con `detalle: COMPLETO` si tiene una pendiente o aceptada.
 */
export interface MiInvitacion {
  /** Identificador de la invitación. */
  id: number;
  /** Estado de la invitación. */
  estado: EstadoInvitacion;
}

/**
 * Datos para invitar a un amigo a una reserva (`InvitacionRequest` del contrato).
 */
export interface InvitacionRequest {
  /** Amigo al que se invita. */
  usuarioId: number;
}

/**
 * Invitación pendiente recibida por el usuario en sesión (`InvitacionRecibida` del contrato).
 */
export interface InvitacionRecibida {
  /** Identificador de la invitación. */
  id: number;
  /** Reserva a la que está invitado, con `detalle: COMPLETO` y sin `invitaciones`. */
  reserva: Reserva;
}
