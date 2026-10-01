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
