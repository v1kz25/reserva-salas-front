/**
 * Sala de reuniones tal y como la devuelve la API (`Sala` del contrato).
 */
export interface Sala {
  /** Identificador de la sala. */
  id: number;
  /** Nombre visible de la sala. */
  nombre: string;
  /** Número máximo de personas. */
  capacidad: number;
  /** Planta en la que está (puede ser negativa). */
  planta: number;
}

/**
 * Datos para crear o modificar una sala (`SalaRequest` del contrato).
 */
export interface SalaRequest {
  /** Nombre visible de la sala (1 a 100 caracteres, único). */
  nombre: string;
  /** Número máximo de personas (al menos 1). */
  capacidad: number;
  /** Planta en la que está (puede ser negativa: sótanos). */
  planta: number;
}
