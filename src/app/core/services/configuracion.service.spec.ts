import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ERRORES_PROPIOS } from '../http/errores-propios';
import { ConfiguracionService } from './configuracion.service';

describe('ConfiguracionService', () => {
  let http: HttpTestingController;
  let servicio: ConfiguracionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(ConfiguracionService);
  });

  afterEach(() => http.verify());

  it('la signal empieza sin valor', () => {
    expect(servicio.zonaHoraria()).toBeUndefined();
  });

  it('obtenerZonaHoraria hace GET /api/config/zona-horaria y guarda la zona en la signal', () => {
    let resultado: unknown;
    servicio.obtenerZonaHoraria().subscribe((z) => (resultado = z));
    const req = http.expectOne('/api/config/zona-horaria');
    expect(req.request.method).toBe('GET');
    expect(servicio.zonaHoraria()).toBeUndefined();
    req.flush({ zonaHoraria: 'Asia/Tokyo' });
    expect(resultado).toEqual({ zonaHoraria: 'Asia/Tokyo' });
    expect(servicio.zonaHoraria()).toBe('Asia/Tokyo');
  });

  it('obtenerZonaHoraria con respaldo marca todos los errores como propios', () => {
    servicio.obtenerZonaHoraria(true).subscribe({ error: () => undefined });
    const req = http.expectOne('/api/config/zona-horaria');
    expect(req.request.context.get(ERRORES_PROPIOS)).toBe('todos');
    req.flush(null, { status: 500, statusText: 'Error' });
    expect(servicio.zonaHoraria()).toBeUndefined();
  });

  it('obtenerZonaHoraria sin respaldo no marca errores propios', () => {
    servicio.obtenerZonaHoraria().subscribe();
    const req = http.expectOne('/api/config/zona-horaria');
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([]);
    req.flush({ zonaHoraria: 'UTC' });
  });

  it('cambiarZonaHoraria hace PUT con el cuerpo {zonaHoraria} y actualiza la signal', () => {
    let resultado: unknown;
    servicio.cambiarZonaHoraria('America/New_York').subscribe((z) => (resultado = z));
    const req = http.expectOne('/api/config/zona-horaria');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ zonaHoraria: 'America/New_York' });
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400]);
    req.flush({ zonaHoraria: 'America/New_York' });
    expect(resultado).toEqual({ zonaHoraria: 'America/New_York' });
    expect(servicio.zonaHoraria()).toBe('America/New_York');
  });

  it('un 400 al cambiar no modifica la signal', () => {
    servicio.obtenerZonaHoraria().subscribe();
    http.expectOne('/api/config/zona-horaria').flush({ zonaHoraria: 'Europe/Madrid' });
    servicio.cambiarZonaHoraria('Mars/Olympus').subscribe({ error: () => undefined });
    http
      .expectOne('/api/config/zona-horaria')
      .flush({ title: 'x', status: 400 }, { status: 400, statusText: 'Bad Request' });
    expect(servicio.zonaHoraria()).toBe('Europe/Madrid');
  });
});
