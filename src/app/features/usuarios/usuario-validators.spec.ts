import { FormControl, FormGroup } from '@angular/forms';

import { coincidenciaValidator, passwordBytesValidator } from './usuario-validators';

describe('passwordBytesValidator', () => {
  const validar = (valor: unknown) => passwordBytesValidator(new FormControl(valor));

  it('acepta vacío, null y valores que no son texto', () => {
    expect(validar('')).toBeNull();
    expect(validar(null)).toBeNull();
    expect(validar(42)).toBeNull();
  });

  it('acepta 72 bytes ASCII y rechaza 73', () => {
    expect(validar('a'.repeat(72))).toBeNull();
    expect(validar('a'.repeat(73))).toEqual({ passwordBytes: true });
  });

  it('cuenta bytes UTF-8, no caracteres: 36 «ñ» son 72 bytes y 37 son 74', () => {
    expect(validar('ñ'.repeat(36))).toBeNull();
    expect(validar('ñ'.repeat(37))).toEqual({ passwordBytes: true });
  });

  it('un emoji ocupa 4 bytes: 18 caben (72) y 19 no', () => {
    expect(validar('😀'.repeat(18))).toBeNull();
    expect(validar('😀'.repeat(19))).toEqual({ passwordBytes: true });
  });
});

describe('coincidenciaValidator', () => {
  const grupo = (a: string, b: string) =>
    new FormGroup({ a: new FormControl(a), b: new FormControl(b) }, { validators: coincidenciaValidator('a', 'b') });

  it('coinciden: sin error', () => {
    expect(grupo('x1', 'x1').errors).toBeNull();
  });

  it('no coinciden: noCoincide en el grupo', () => {
    expect(grupo('x1', 'x2').errors).toEqual({ noCoincide: true });
  });

  it('confirmación vacía: no se marca (lo cubre required del campo)', () => {
    expect(grupo('x1', '').errors).toBeNull();
  });

  it('distingue mayúsculas y espacios', () => {
    expect(grupo('Abc', 'abc').errors).toEqual({ noCoincide: true });
    expect(grupo('abc', 'abc ').errors).toEqual({ noCoincide: true });
  });
});
