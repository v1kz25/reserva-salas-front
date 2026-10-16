/**
 * Devuelve la fecha local indicada en formato `yyyy-MM-dd`.
 *
 * @param fecha Fecha a formatear (por defecto, ahora).
 */
export function fechaIso(fecha: Date = new Date()): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Devuelve la zona horaria del navegador (identificador IANA).
 */
export function zonaNavegador(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Indica si el navegador reconoce un identificador de zona horaria IANA.
 *
 * @param zona Identificador a comprobar.
 */
export function esZonaValida(zona: string | undefined): zona is string {
  if (!zona) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve el día de un instante en una zona horaria, en formato `yyyy-MM-dd`. Sin zona,
 * o si la zona no es válida, usa la del navegador.
 *
 * El respaldo a la zona del navegador es intencionado: cubre la zona aún no recibida, el
 * fallo de la petición y una zona del servidor que el navegador no reconoce, para que el
 * formulario de reservas nunca quede bloqueado (el servidor valida igualmente la fecha).
 *
 * @param fecha Instante a convertir.
 * @param zona Identificador IANA de la zona horaria.
 */
export function fechaIsoEnZona(fecha: Date, zona?: string): string {
  if (!esZonaValida(zona)) {
    return fechaIso(fecha);
  }
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

/**
 * Devuelve el día siguiente a una fecha `yyyy-MM-dd`, en el mismo formato.
 *
 * @param iso Fecha de partida en formato `yyyy-MM-dd`.
 */
export function diaSiguienteIso(iso: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);
}

/**
 * Convierte una fecha `yyyy-MM-dd` al formato `dd/MM/yyyy`.
 *
 * @param iso Fecha en formato `yyyy-MM-dd`.
 */
export function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}
