import { FechaLargaPipe } from './fecha-larga.pipe';

describe('FechaLargaPipe', () => {
  const pipe = new FechaLargaPipe();

  it('formatea un instante ISO como fecha larga en español', () => {
    // Mediodía UTC: el día es el mismo en cualquier zona horaria habitual.
    expect(pipe.transform('2026-10-03T12:00:00Z')).toBe('3 de octubre de 2026');
  });

  it('formatea otro mes', () => {
    expect(pipe.transform('2026-01-15T12:00:00Z')).toBe('15 de enero de 2026');
  });

  for (const vacio of [undefined, null, '']) {
    it(`devuelve cadena vacía con ${JSON.stringify(vacio)}`, () => {
      expect(pipe.transform(vacio)).toBe('');
    });
  }

  it('devuelve cadena vacía con una fecha no válida', () => {
    expect(pipe.transform('no es una fecha')).toBe('');
  });
});
