/**
 * Datos públicos mínimos de un usuario (`UsuarioResumen` del contrato).
 */
export interface UsuarioResumen {
  /** Identificador del usuario. */
  id: number;
  /** Nombre visible. */
  nombre: string;
}

/**
 * Amistad confirmada vista desde el usuario en sesión (`Amigo` del contrato).
 */
export interface Amigo {
  /** Identificador del amigo. */
  usuarioId: number;
  /** Nombre visible del amigo. */
  nombre: string;
  /** Momento en que se confirmó la amistad (ISO 8601). */
  desde: string;
}

/**
 * Solicitud de amistad pendiente (`SolicitudAmistad` del contrato).
 */
export interface SolicitudAmistad {
  /** Identificador de la solicitud. */
  id: number;
  /** La otra persona: quien la envía (recibidas) o a quien va (enviadas). */
  usuario: UsuarioResumen;
  /** Momento en que se envió (ISO 8601). */
  fecha: string;
}

/**
 * Datos para enviar una solicitud de amistad (`SolicitudAmistadRequest` del contrato).
 */
export interface SolicitudAmistadRequest {
  /** Usuario al que se envía la solicitud. */
  usuarioId: number;
}
