import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Valida que un texto no esté formado solo por espacios. Un texto vacío lo deja pasar:
 * eso lo comprueba `Validators.required`.
 *
 * @returns `{ textoEnBlanco: true }` si el texto solo tiene espacios.
 */
export const textoNoEnBlancoValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor: unknown = control.value;
  return typeof valor === 'string' && valor.length > 0 && valor.trim().length === 0 ? { textoEnBlanco: true } : null;
};
