/**
 * Reserva de una sala tal y como la devuelve la API (`Reserva` del contrato).
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
  /** Identificador del usuario que hizo la reserva. */
  usuarioId: number;
  /** Nombre del usuario que hizo la reserva (solo lectura). */
  responsable: string;
  /** Motivo de la reserva. */
  motivo: string;
}

/**
 * Datos para crear una reserva (`ReservaRequest` del contrato). El responsable
 * no se envía: es siempre el usuario de la sesión.
 */
export type ReservaRequest = Pick<Reserva, 'salaId' | 'fecha' | 'horaInicio' | 'horaFin' | 'motivo'>;

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
