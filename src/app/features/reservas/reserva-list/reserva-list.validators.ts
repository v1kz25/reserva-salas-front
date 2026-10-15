import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Valida que `fechaHasta` no sea anterior a `fechaDesde`.
 *
 * Se aplica al grupo de filtros. Devuelve `{ rangoFechasInvalido: true }` si ambas
 * fechas están informadas y «hasta» es anterior a «desde» (la misma fecha es válida).
 */
export const rangoFechasValidator: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const desde = grupo.get('fechaDesde')?.value as string | undefined;
  const hasta = grupo.get('fechaHasta')?.value as string | undefined;
  if (!desde || !hasta) {
    return null;
  }
  return hasta < desde ? { rangoFechasInvalido: true } : null;
};
