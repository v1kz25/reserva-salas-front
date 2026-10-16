import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Longitud mínima de una contraseña (contrato). */
export const MIN_PASSWORD = 8;

/** Longitud máxima de una contraseña, en caracteres y en bytes UTF-8 (contrato). */
export const MAX_PASSWORD = 72;

/** Longitud máxima de un email (contrato). */
export const MAX_EMAIL = 254;

/** Longitud máxima del nombre de un usuario (contrato). */
export const MAX_NOMBRE_USUARIO = 100;

/**
 * Valida que una contraseña no supere los 72 bytes en UTF-8 (límite del contrato; con
 * tildes o emojis se llega antes que a los 72 caracteres). Un valor vacío lo deja pasar.
 *
 * @returns `{ passwordBytes: true }` si supera el límite.
 */
export const passwordBytesValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor: unknown = control.value;
  if (typeof valor !== 'string' || valor.length === 0) {
    return null;
  }
  return new TextEncoder().encode(valor).length > MAX_PASSWORD ? { passwordBytes: true } : null;
};

/**
 * Crea un validador de grupo que comprueba que dos campos tienen el mismo valor. El error
 * se pone en el grupo, para no pisar los errores propios del campo de confirmación.
 *
 * @param campo Nombre del control con el valor original.
 * @param confirmacion Nombre del control que lo repite.
 * @returns `{ noCoincide: true }` si la confirmación no está vacía y no coincide.
 */
export function coincidenciaValidator(campo: string, confirmacion: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const valor: unknown = grupo.get(campo)?.value;
    const repetido: unknown = grupo.get(confirmacion)?.value;
    if (repetido === '' || repetido === null || repetido === undefined) {
      return null;
    }
    return valor === repetido ? null : { noCoincide: true };
  };
}
