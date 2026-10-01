import { InjectionToken } from '@angular/core';

/**
 * Reloj de la aplicación: función que devuelve el momento actual.
 *
 * En las pruebas se puede fijar la hora con
 * `{ provide: AHORA, useValue: () => new Date(2026, 9, 1, 12, 30) }`.
 */
export const AHORA = new InjectionToken<() => Date>('AHORA', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
