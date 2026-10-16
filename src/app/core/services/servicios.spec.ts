import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ReservasService } from './reservas.service';
import { SalasService } from './salas.service';

describe('servicios HTTP', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('SalasService.listar hace GET /api/salas', () => {
    TestBed.inject(SalasService).listar().subscribe();
    const req = http.expectOne('/api/salas');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('ReservasService.listar sin filtros solo envía la página 0 y el tamaño por defecto', () => {
    TestBed.inject(ReservasService).listar().subscribe();
    const req = http.expectOne((r) => r.url === '/api/reservas');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['page', 'size']);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
  });

  it('ReservasService.listar envía la página y el tamaño indicados junto a los filtros', () => {
    TestBed.inject(ReservasService).listar({ salaId: 2 }, 4, 50).subscribe();
    const req = http.expectOne((r) => r.url === '/api/reservas');
    expect(req.request.params.get('page')).toBe('4');
    expect(req.request.params.get('size')).toBe('50');
    expect(req.request.params.get('salaId')).toBe('2');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 4, size: 50 });
  });

  it('ReservasService.listar envía salaId, fechaDesde y fechaHasta', () => {
    TestBed.inject(ReservasService).listar({ salaId: 3, fechaDesde: '2026-10-05', fechaHasta: '2026-10-07' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/reservas');
    expect(req.request.params.get('salaId')).toBe('3');
    expect(req.request.params.get('fechaDesde')).toBe('2026-10-05');
    expect(req.request.params.get('fechaHasta')).toBe('2026-10-07');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
  });

  it('ReservasService.listar admite salaId 0 sin descartarlo y omite fechas vacías', () => {
    TestBed.inject(ReservasService).listar({ salaId: 0, fechaDesde: '', fechaHasta: '' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/reservas');
    expect(req.request.params.get('salaId')).toBe('0');
    expect(req.request.params.has('fechaDesde')).toBeFalse();
    expect(req.request.params.has('fechaHasta')).toBeFalse();
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
  });

  it('ReservasService.crear hace POST /api/reservas con el cuerpo', () => {
    const body = { salaId: 1, fecha: '2026-10-05', horaInicio: '10:00', horaFin: '11:00', motivo: 'B' };
    TestBed.inject(ReservasService).crear(body).subscribe();
    const req = http.expectOne('/api/reservas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 1, ...body });
  });

  it('ReservasService.obtener hace GET /api/reservas/{id}', () => {
    TestBed.inject(ReservasService).obtener(7).subscribe();
    const req = http.expectOne('/api/reservas/7');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 7 });
  });

  it('ReservasService.cancelar hace DELETE /api/reservas/{id} sin cuerpo', () => {
    let completado = false;
    TestBed.inject(ReservasService)
      .cancelar(7)
      .subscribe({ complete: () => (completado = true) });
    const req = http.expectOne('/api/reservas/7');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(completado).toBeTrue();
  });

  it('ReservasService.cancelar propaga el error 404', () => {
    let status = 0;
    TestBed.inject(ReservasService)
      .cancelar(9)
      .subscribe({ error: (e) => (status = e.status) });
    http.expectOne('/api/reservas/9').flush({ title: 'x', status: 404 }, { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
  });
});
