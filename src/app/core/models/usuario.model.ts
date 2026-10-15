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

/**
 * Usuario tal y como lo ve un administrador (`UsuarioAdmin` del contrato).
 */
export interface UsuarioAdmin {
  /** Identificador del usuario. */
  id: number;
  /** Email con el que inicia sesión (único). */
  email: string;
  /** Nombre visible. */
  nombre: string;
  /** Rol del usuario. */
  rol: Rol;
  /** Indica si puede iniciar sesión. */
  activo: boolean;
  /** Momento del alta (ISO 8601 con zona). */
  fechaCreacion: string;
}

/**
 * Datos para dar de alta un usuario (`UsuarioNuevoRequest` del contrato).
 */
export interface UsuarioNuevoRequest {
  /** Email (único, hasta 254 caracteres). */
  email: string;
  /** Nombre visible (1 a 100 caracteres). */
  nombre: string;
  /** Contraseña inicial (8 a 72 caracteres y como mucho 72 bytes en UTF-8). */
  password: string;
  /** Rol del usuario (`USER` si no se indica). */
  rol?: Rol;
}

/**
 * Datos para modificar un usuario (`UsuarioCambioRequest` del contrato).
 */
export interface UsuarioCambioRequest {
  /** Nombre visible (1 a 100 caracteres). */
  nombre: string;
  /** Rol del usuario. */
  rol: Rol;
  /** Indica si puede iniciar sesión. */
  activo: boolean;
}

/**
 * Contraseña nueva de un usuario (`PasswordRequest` del contrato).
 */
export interface PasswordRequest {
  /** Contraseña (8 a 72 caracteres y como mucho 72 bytes en UTF-8). */
  password: string;
}
