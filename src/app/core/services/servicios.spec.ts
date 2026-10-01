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

  it('ReservasService.listar sin filtros no envía parámetros', () => {
    TestBed.inject(ReservasService).listar().subscribe();
    const req = http.expectOne((r) => r.url === '/api/reservas');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('ReservasService.listar envía salaId, fechaDesde y fechaHasta', () => {
    TestBed.inject(ReservasService).listar({ salaId: 3, fechaDesde: '2026-10-05', fechaHasta: '2026-10-07' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/reservas');
    expect(req.request.params.get('salaId')).toBe('3');
    expect(req.request.params.get('fechaDesde')).toBe('2026-10-05');
    expect(req.request.params.get('fechaHasta')).toBe('2026-10-07');
    req.flush([]);
  });

  it('ReservasService.listar admite salaId 0 sin descartarlo y omite fechas vacías', () => {
    TestBed.inject(ReservasService).listar({ salaId: 0, fechaDesde: '', fechaHasta: '' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/reservas');
    expect(req.request.params.get('salaId')).toBe('0');
    expect(req.request.params.has('fechaDesde')).toBeFalse();
    expect(req.request.params.has('fechaHasta')).toBeFalse();
    req.flush([]);
  });

  it('ReservasService.crear hace POST /api/reservas con el cuerpo', () => {
    const body = { salaId: 1, fecha: '2026-10-05', horaInicio: '10:00', horaFin: '11:00', responsable: 'A', motivo: 'B' };
    TestBed.inject(ReservasService).crear(body).subscribe();
    const req = http.expectOne('/api/reservas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 1, ...body });
  });
});
