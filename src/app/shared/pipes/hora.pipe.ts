import { Pipe, PipeTransform } from '@angular/core';

/**
 * HoraPipe — muestra una hora siempre en formato `HH:mm` (recorta los segundos si llegan).
 */
@Pipe({ name: 'hora' })
export class HoraPipe implements PipeTransform {
  /**
   * Formatea la hora recibida.
   *
   * @param valor Hora en formato `HH:mm` o `HH:mm:ss`.
   * @returns La hora en formato `HH:mm`, o cadena vacía si no hay valor.
   */
  transform(valor?: string | null): string {
    return valor ? valor.slice(0, 5) : '';
  }
}
