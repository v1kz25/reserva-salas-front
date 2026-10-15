import { HttpErrorResponse } from '@angular/common/http';

import { aProblemDetail, clasificarErrorGrave } from './problem-detail';

describe('aProblemDetail', () => {
  it('devuelve el cuerpo si tiene formato ProblemDetail', () => {
    const cuerpo = { title: 'Conflicto', status: 409, detail: 'Solapada' };
    const r = aProblemDetail(new HttpErrorResponse({ status: 409, error: cuerpo }));
    expect(r).toEqual(cuerpo);
  });

  it('conserva los errores por campo de un 400', () => {
    const cuerpo = { title: 'Bad', status: 400, errores: [{ campo: 'motivo', mensaje: 'vacío' }] };
    expect(aProblemDetail(new HttpErrorResponse({ status: 400, error: cuerpo })).errores).toEqual(cuerpo.errores);
  });

  it('status 0 = servidor no disponible', () => {
    const r = aProblemDetail(new HttpErrorResponse({ status: 0 }));
    expect(r.title).toBe('Servidor no disponible');
    expect(r.status).toBe(0);
  });

  it('cuerpo no válido genera error genérico con el estado', () => {
    const r = aProblemDetail(new HttpErrorResponse({ status: 500, error: '<html>' }));
    expect(r.status).toBe(500);
    expect(r.detail).toContain('500');
  });

  it('cuerpo null genera error genérico', () => {
    expect(aProblemDetail(new HttpErrorResponse({ status: 502, error: null })).status).toBe(502);
  });

  it('un error que no es HttpErrorResponse genera error inesperado', () => {
    expect(aProblemDetail(new Error('x')).title).toBe('Error inesperado');
  });
});

describe('clasificarErrorGrave', () => {
  const pd = (status: number) => ({ title: 'X', status });

  it('clasifica los estados graves', () => {
    expect(clasificarErrorGrave(new HttpErrorResponse({ status: 0 }))).toBe('no-disponible');
    expect(clasificarErrorGrave(new HttpErrorResponse({ status: 503, error: pd(503) }))).toBe('no-disponible');
    expect(clasificarErrorGrave(new HttpErrorResponse({ status: 500, error: '<html>' }))).toBe('no-disponible');
    expect(clasificarErrorGrave(new HttpErrorResponse({ status: 500, error: pd(500) }))).toBe('inesperado');
    expect(clasificarErrorGrave(new HttpErrorResponse({ status: 403 }))).toBe('sin-permiso');
  });

  it('los errores de cliente no son graves', () => {
    for (const status of [400, 404, 409]) {
      expect(clasificarErrorGrave(new HttpErrorResponse({ status, error: pd(status) }))).toBeUndefined();
    }
  });
});
