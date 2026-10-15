/** Clave del estado de navegación con el aviso que debe mostrar la pantalla de destino. */
export const CLAVE_AVISO = 'aviso';

/**
 * Lee el aviso que otra pantalla deja en el estado de navegación al volver a un listado.
 *
 * @param estado Estado de la navegación (`Navigation.extras.state`).
 * @returns El aviso, si es un texto no vacío.
 */
export function leerAviso(estado: Record<string, unknown> | undefined): string | undefined {
  const aviso = estado?.[CLAVE_AVISO];
  return typeof aviso === 'string' && aviso ? aviso : undefined;
}

/**
 * Quita el aviso del estado de la entrada actual del historial, para que no vuelva
 * a mostrarse al navegar hacia atrás o adelante. Conserva el resto del estado del router.
 *
 * @param historial Historial del navegador.
 */
export function limpiarAvisoDelHistorial(historial: History): void {
  const estado: unknown = historial.state;
  if (typeof estado !== 'object' || estado === null || !(CLAVE_AVISO in estado)) {
    return;
  }
  const resto: Record<string, unknown> = { ...(estado as Record<string, unknown>) };
  delete resto[CLAVE_AVISO];
  historial.replaceState(resto, '');
}
