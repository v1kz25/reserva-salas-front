/**
 * Rol de un usuario (`Rol` del contrato).
 */
export type Rol = 'USER' | 'ADMIN';

/**
 * Usuario autenticado tal y como lo devuelve la API (`Usuario` del contrato).
 */
export interface Usuario {
  /** Identificador del usuario. */
  id: number;
  /** Email con el que inicia sesión. */
  email: string;
  /** Nombre visible. */
  nombre: string;
  /** Rol del usuario. */
  rol: Rol;
}

/**
 * Credenciales para iniciar sesión (`LoginRequest` del contrato).
 */
export interface LoginRequest {
  /** Email del usuario. */
  email: string;
  /** Contraseña. */
  password: string;
}
