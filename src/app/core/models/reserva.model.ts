import type { Invitacion, MiInvitacion } from './invitacion.model';

/**
 * Nivel de detalle con el que el usuario ve una reserva (`Reserva.detalle` del contrato):
 *
 * - `COMPLETO`: es el organizador, un invitado (pendiente o aceptado) o un `ADMIN`.
 * - `OCUPADA`: no participa; solo ve sala, fecha y franja.
 */
export type DetalleReserva = 'COMPLETO' | 'OCUPADA';

/**
 * Reserva de una sala tal y como la devuelve la API (`Reserva` del contrato). Con
 * `detalle: OCUPADA` solo llegan `id`, `salaId`, `fecha`, `horaInicio`, `horaFin` y `detalle`.
 */
export interface Reserva {
  /** Identificador de la reserva. */
  id: number;
  /** Identificador de la sala reservada. */
  salaId: number;
  /** Día de la reserva en formato `yyyy-MM-dd`. */
  fecha: string;
  /** Hora de inicio en formato `HH:mm`. */
  horaInicio: string;
  /** Hora de fin en formato `HH:mm`. */
  horaFin: string;
  /** Si el usuario ve la reserva completa o solo como franja ocupada. */
  detalle: DetalleReserva;
  /** Identificador del usuario que hizo la reserva (organizador; solo con `COMPLETO`). */
  usuarioId?: number;
  /** Nombre del usuario que hizo la reserva (solo lectura; solo con `COMPLETO`). */
  responsable?: string;
  /** Motivo de la reserva (solo con `COMPLETO`). */
  motivo?: string;
  /** Invitación del usuario en sesión, si está invitado (pendiente o aceptada; solo con `COMPLETO`). */
  miInvitacion?: MiInvitacion;
  /** Invitaciones de la reserva (solo en `GET /api/reservas/{id}` con `COMPLETO`). */
  invitaciones?: Invitacion[];
}

/**
 * Datos para crear una reserva (`ReservaRequest` del contrato). El responsable
 * no se envía: es siempre el usuario de la sesión.
 */
export interface ReservaRequest {
  /** Sala que se reserva. */
  salaId: number;
  /** Día de la reserva (`yyyy-MM-dd`, posterior a hoy). */
  fecha: string;
  /** Hora de inicio (`HH:mm`). */
  horaInicio: string;
  /** Hora de fin (`HH:mm`, posterior a la de inicio). */
  horaFin: string;
  /** Motivo de la reserva (1 a 255 caracteres). */
  motivo: string;
}

/**
 * Filtros opcionales del listado de reservas (`GET /api/reservas`).
 */
export interface FiltroReservas {
  /** Solo las reservas de esta sala. */
  salaId?: number;
  /** Solo las reservas de este día o posteriores (`yyyy-MM-dd`, inclusive). */
  fechaDesde?: string;
  /** Solo las reservas de este día o anteriores (`yyyy-MM-dd`, inclusive). */
  fechaHasta?: string;
}

/**
 * Filtro de «Mis reservas» por el papel del usuario (`rol` de `GET /api/reservas?mis=true`):
 *
 * - `ORGANIZADA`: las que organiza.
 * - `INVITADO`: aquellas cuya invitación ha aceptado.
 * - `PENDIENTE`: aquellas cuya invitación está pendiente (incluidas las de reservas pasadas).
 */
export type RolMisReservas = 'ORGANIZADA' | 'INVITADO' | 'PENDIENTE';

/** Tamaño de página por defecto del listado de reservas (el máximo que admite la API es 100). */
export const TAMANO_PAGINA_RESERVAS = 20;

/**
 * Página de reservas que devuelve `GET /api/reservas` (`PaginaReservas` del contrato).
 */
export interface PaginaReservas {
  /** Reservas de esta página, ordenadas por fecha y hora de inicio. */
  content: Reserva[];
  /** Número total de reservas que cumplen los filtros. */
  totalElements: number;
  /** Número total de páginas. */
  totalPages: number;
  /** Página actual, empezando en 0. */
  number: number;
  /** Tamaño de página solicitado. */
  size: number;
}
