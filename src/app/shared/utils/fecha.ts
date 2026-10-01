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
 * Devuelve el día siguiente al indicado (a la misma hora local).
 *
 * @param fecha Fecha de partida (por defecto, ahora).
 */
export function diaSiguiente(fecha: Date = new Date()): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1, fecha.getHours(), fecha.getMinutes());
}
