import { FormControl } from '@angular/forms';

import { textoNoEnBlancoValidator as reexportado } from '../../features/salas/sala-form/sala-form.validators';
import { textoNoEnBlancoValidator } from './texto.validators';

describe('textoNoEnBlancoValidator', () => {
  const validar = (valor: unknown) => textoNoEnBlancoValidator(new FormControl(valor));

  it('texto con contenido: sin error', () => {
    expect(validar('Sala')).toBeNull();
    expect(validar('  Sala  ')).toBeNull();
  });

  it('vacío, null y no texto: sin error (lo cubre required)', () => {
    expect(validar('')).toBeNull();
    expect(validar(null)).toBeNull();
    expect(validar(5)).toBeNull();
  });

  it('solo espacios, tabuladores o saltos de línea: textoEnBlanco', () => {
    expect(validar('   ')).toEqual({ textoEnBlanco: true });
    expect(validar('\t\n ')).toEqual({ textoEnBlanco: true });
  });

  it('sala-form.validators lo reexporta (misma función)', () => {
    expect(reexportado).toBe(textoNoEnBlancoValidator);
  });
});
