import { CLAVE_AVISO, leerAviso, limpiarAvisoDelHistorial } from './reserva-cancelacion';

describe('leerAviso', () => {
  it('devuelve el aviso si es un texto no vacío', () => {
    expect(leerAviso({ [CLAVE_AVISO]: 'Hecho' })).toBe('Hecho');
  });

  it('devuelve undefined sin estado, sin clave, vacío o con un tipo incorrecto', () => {
    expect(leerAviso(undefined)).toBeUndefined();
    expect(leerAviso({})).toBeUndefined();
    expect(leerAviso({ [CLAVE_AVISO]: '' })).toBeUndefined();
    expect(leerAviso({ [CLAVE_AVISO]: 5 })).toBeUndefined();
  });
});

describe('limpiarAvisoDelHistorial', () => {
  const historial = (state: unknown) => {
    const h = { state, replaceState: jasmine.createSpy('replaceState') };
    return h as unknown as History & { replaceState: jasmine.Spy };
  };

  it('borra el aviso y conserva el resto del state', () => {
    const h = historial({ [CLAVE_AVISO]: 'Hecho', navigationId: 3 });
    limpiarAvisoDelHistorial(h);
    expect(h.replaceState).toHaveBeenCalledOnceWith({ navigationId: 3 }, '');
  });

  it('no toca el historial si no hay aviso o el state no es un objeto', () => {
    for (const state of [null, undefined, 'x', { navigationId: 1 }]) {
      const h = historial(state);
      limpiarAvisoDelHistorial(h);
      expect(h.replaceState).not.toHaveBeenCalled();
    }
  });
});
