import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Reexportado desde `shared/validators` para no romper las importaciones existentes. */
export { textoNoEnBlancoValidator } from '../../../shared/validators/texto.validators';

/**
 * Valida que un número sea entero. Un valor vacío lo deja pasar: eso lo comprueba
 * `Validators.required`.
 *
 * @returns `{ noEntero: true }` si el valor no es un número entero.
 */
export const enteroValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor: unknown = control.value;
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  return typeof valor === 'number' && Number.isSafeInteger(valor) ? null : { noEntero: true };
};
