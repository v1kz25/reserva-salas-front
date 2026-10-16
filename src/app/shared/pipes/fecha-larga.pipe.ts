import { Pipe, PipeTransform } from '@angular/core';

/** Formato de fecha larga en español (`3 de octubre de 2026`). */
const FORMATO = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' });

/**
 * FechaLargaPipe — muestra un instante ISO 8601 como fecha larga en español, en la zona
 * horaria del navegador.
 */
@Pipe({ name: 'fechaLarga' })
export class FechaLargaPipe implements PipeTransform {
  /**
   * Formatea el instante recibido.
   *
   * @param valor Instante en formato ISO 8601.
   * @returns La fecha larga, o cadena vacía si no hay valor o no es una fecha válida.
   */
  transform(valor?: string | null): string {
    if (!valor) {
      return '';
    }
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? '' : FORMATO.format(fecha);
  }
}
