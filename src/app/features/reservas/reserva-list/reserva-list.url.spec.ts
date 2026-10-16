import { convertToParamMap } from '@angular/router';

import { estadoAQueryParams, leerEstadoDeUrl, mismoEstado } from './reserva-list.url';

const leer = (params: Record<string, string>) => leerEstadoDeUrl(convertToParamMap(params));

describe('reserva-list.url', () => {
  describe('leerEstadoDeUrl', () => {
    it('sin parámetros devuelve la página 0 y ningún filtro', () => {
      expect(leer({})).toEqual({
        salaId: undefined,
        fechaDesde: undefined,
        fechaHasta: undefined,
        pagina: 0,
      });
    });

    it('page va en base 1: page=3 es la página 2', () => {
      expect(leer({ page: '3' }).pagina).toBe(2);
      expect(leer({ page: '1' }).pagina).toBe(0);
    });

    it('ignora page no válido (0, negativo, decimal, texto, vacío)', () => {
      for (const valor of ['0', '-1', '1.5', 'abc', '', '2x', '99999999999999999999']) {
        expect(leer({ page: valor }).pagina).withContext(`page=${valor}`).toBe(0);
      }
    });

    it('lee salaId y fechas válidas', () => {
      expect(leer({ salaId: '4', fechaDesde: '2026-10-05', fechaHasta: '2026-10-07' })).toEqual({
        salaId: 4,
        fechaDesde: '2026-10-05',
        fechaHasta: '2026-10-07',
        pagina: 0,
      });
    });

    it('ignora salaId no válido', () => {
      for (const valor of ['x', '-2', '1.5', '']) {
        expect(leer({ salaId: valor }).salaId).withContext(`salaId=${valor}`).toBeUndefined();
      }
    });

    it('acepta salaId 0 como número', () => {
      expect(leer({ salaId: '0' }).salaId).toBe(0);
    });

    it('ignora fechas con formato no válido', () => {
      expect(leer({ fechaDesde: '05/10/2026', fechaHasta: '2026-1-5' })).toEqual(
        jasmine.objectContaining({ fechaDesde: undefined, fechaHasta: undefined }),
      );
    });
  });

  describe('estadoAQueryParams', () => {
    it('omite page en la primera página (null para quitarlo de la URL)', () => {
      expect(estadoAQueryParams({ pagina: 0 })['page']).toBeNull();
    });

    it('escribe page en base 1 a partir de la página 1', () => {
      expect(estadoAQueryParams({ pagina: 1 })['page']).toBe(2);
      expect(estadoAQueryParams({ pagina: 4 })['page']).toBe(5);
    });

    it('incluye los filtros y pone a null los ausentes', () => {
      expect(estadoAQueryParams({ pagina: 2, salaId: 1, fechaDesde: '2026-10-05' })).toEqual({
        page: 3,
        salaId: 1,
        fechaDesde: '2026-10-05',
        fechaHasta: null,
      });
      expect(estadoAQueryParams({ pagina: 0, salaId: 0 })['salaId']).toBe(0);
    });

    it('lo que se escribe se vuelve a leer igual (ida y vuelta)', () => {
      const estado = { pagina: 6, salaId: 3, fechaDesde: '2026-10-01', fechaHasta: '2026-10-31' };
      const params: Record<string, string> = {};
      for (const [clave, valor] of Object.entries(estadoAQueryParams(estado))) {
        if (valor !== null) {
          params[clave] = String(valor);
        }
      }
      expect(leer(params)).toEqual(estado);
    });
  });

  describe('mismoEstado', () => {
    const base = { pagina: 1, salaId: 2, fechaDesde: '2026-10-05', fechaHasta: '2026-10-06' };

    it('es verdadero para estados iguales', () => {
      expect(mismoEstado(base, { ...base })).toBeTrue();
      expect(mismoEstado({ pagina: 0 }, { pagina: 0 })).toBeTrue();
    });

    it('es falso si difiere cualquier campo', () => {
      expect(mismoEstado(base, { ...base, pagina: 2 })).toBeFalse();
      expect(mismoEstado(base, { ...base, salaId: 3 })).toBeFalse();
      expect(mismoEstado(base, { ...base, salaId: undefined })).toBeFalse();
      expect(mismoEstado(base, { ...base, fechaDesde: '2026-10-04' })).toBeFalse();
      expect(mismoEstado(base, { ...base, fechaHasta: undefined })).toBeFalse();
    });
  });
});
