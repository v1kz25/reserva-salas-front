import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { fechaIso } from '../../../shared/utils/fecha';

/**
 * Valida que `horaFin` sea estrictamente posterior a `horaInicio`.
 *
 * Se aplica al grupo del formulario. Devuelve `{ horaFinNoPosterior: true }`
 * si ambas horas están informadas y la de fin no es posterior.
 */
export const horaFinPosteriorValidator: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const horaInicio = grupo.get('horaInicio')?.value as string | undefined;
  const horaFin = grupo.get('horaFin')?.value as string | undefined;
  if (!horaInicio || !horaFin) {
    return null;
  }
  return horaFin > horaInicio ? null : { horaFinNoPosterior: true };
};

/**
 * Crea un validador que solo admite fechas a partir de mañana.
 *
 * Se aplica al control `fecha`. Devuelve `{ fechaNoPosteriorAHoy: true }` si el
 * día indicado es hoy o anterior. Un valor vacío no se valida.
 *
 * @param ahora Función que devuelve el momento actual (inyectable para pruebas).
 */
export function aPartirDeMananaValidator(ahora: () => Date = () => new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const fecha = control.value as string | undefined;
    if (!fecha) {
      return null;
    }
    return fecha > fechaIso(ahora()) ? null : { fechaNoPosteriorAHoy: true };
  };
}
