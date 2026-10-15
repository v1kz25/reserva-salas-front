import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ERRORES_PROPIOS } from '../http/errores-propios';
import { SalasService } from './salas.service';

const BODY = { nombre: 'Sala Sur', capacidad: 4, planta: -1 };

describe('SalasService (administración)', () => {
  let http: HttpTestingController;
  let service: SalasService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SalasService);
  });

  afterEach(() => http.verify());

  it('obtener hace GET /api/salas/{id}', () => {
    let sala: unknown;
    service.obtener(3).subscribe((s) => (sala = s));
    const req = http.expectOne('/api/salas/3');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 3, ...BODY });
    expect(sala).toEqual({ id: 3, ...BODY });
  });

  it('crear hace POST /api/salas con el cuerpo y gestiona 400 y 409', () => {
    service.crear(BODY).subscribe();
    const req = http.expectOne('/api/salas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(BODY);
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400, 409]);
    req.flush({ id: 1, ...BODY });
  });

  it('modificar hace PUT /api/salas/{id} con el cuerpo y gestiona 400, 404 y 409', () => {
    service.modificar(5, BODY).subscribe();
    const req = http.expectOne('/api/salas/5');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(BODY);
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400, 404, 409]);
    req.flush({ id: 5, ...BODY });
  });

  it('eliminar hace DELETE /api/salas/{id} y gestiona 404 y 409', () => {
    service.eliminar(5).subscribe();
    const req = http.expectOne('/api/salas/5');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([404, 409]);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('obtener no declara errores propios (el interceptor gestiona lo no previsto)', () => {
    service.obtener(1).subscribe({ error: () => undefined });
    const req = http.expectOne('/api/salas/1');
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([]);
    req.flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('propaga el error 409 de crear a quien llama', () => {
    let status: number | undefined;
    service.crear(BODY).subscribe({ error: (e: { status: number }) => (status = e.status) });
    http.expectOne('/api/salas').flush({ title: 'x', status: 409 }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
  });
});
