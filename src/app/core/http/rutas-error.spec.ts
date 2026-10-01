import { esRutaDeError, rutaInternaSegura } from './rutas-error';

describe('rutaInternaSegura', () => {
  it('acepta rutas internas con query params', () => {
    expect(rutaInternaSegura('/reservas?salaId=1')).toBe('/reservas?salaId=1');
  });

  for (const valor of ['https://malo.com', '//malo.com', '/\\malo.com', 'reservas', '', null, undefined, '/a\nb']) {
    it(`rechaza ${JSON.stringify(valor)}`, () => {
      expect(rutaInternaSegura(valor)).toBeUndefined();
    });
  }

  it('rechaza páginas de error para evitar bucles', () => {
    expect(rutaInternaSegura('/error/no-disponible')).toBeUndefined();
    expect(rutaInternaSegura('/no-encontrado')).toBeUndefined();
  });
});

describe('esRutaDeError', () => {
  it('detecta las páginas de error con o sin query params', () => {
    expect(esRutaDeError('/error/inesperado')).toBeTrue();
    expect(esRutaDeError('/error/no-disponible?returnUrl=%2Freservas')).toBeTrue();
    expect(esRutaDeError('/reservas')).toBeFalse();
    expect(esRutaDeError('/errores')).toBeFalse();
  });
});
