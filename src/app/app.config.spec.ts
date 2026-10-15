import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { appConfig } from './app.config';
import { Usuario } from './core/models/usuario.model';
import { SesionService } from './core/services/sesion.service';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };

/** Borra una cookie del documento de pruebas. */
function borrarCookie(nombre: string): void {
  document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe('appConfig: inicializador de la sesión', () => {
  let controller: HttpTestingController;
  let sesion: SesionService;
  let estado: ApplicationInitStatus;

  beforeEach(() => {
    // Mismos providers que la aplicación, pero con el backend HTTP de pruebas.
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    controller = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    estado = TestBed.inject(ApplicationInitStatus);
  });

  afterEach(() => controller.verify());

  it('/me 200: la app arranca con la sesión iniciada y sin pedir csrf', async () => {
    const req = controller.expectOne('/api/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush(ANA);
    await estado.donePromise;
    expect(sesion.estado()).toBe('autenticado');
    expect(sesion.usuario()).toEqual(ANA);
    controller.expectNone('/api/auth/csrf');
  });

  it('con la configuración real de la app, un POST lleva X-XSRF-TOKEN si existe la cookie', async () => {
    controller.expectOne('/api/auth/me').flush(ANA);
    await estado.donePromise;
    document.cookie = 'XSRF-TOKEN=token-real; path=/';
    try {
      TestBed.inject(HttpClient).post('/api/reservas', {}).subscribe();
      const req = controller.expectOne('/api/reservas');
      expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('token-real');
      req.flush(null);
    } finally {
      borrarCookie('XSRF-TOKEN');
    }
  });

  it('/me 401: la app arranca anónima y pide el csrf', async () => {
    controller.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    await estado.donePromise;
    expect(sesion.estado()).toBe('anonimo');
  });

  it('error de red en /me: la app arranca igualmente, con la sesión «desconocida»', async () => {
    controller.expectOne('/api/auth/me').error(new ProgressEvent('error'));
    await estado.donePromise;
    expect(sesion.estado()).toBe('desconocido');
    controller.expectNone('/api/auth/csrf');
  });

  it('500 en /me: la app arranca igualmente', async () => {
    controller.expectOne('/api/auth/me').flush(null, { status: 500, statusText: 'Error' });
    await estado.donePromise;
    expect(sesion.estado()).toBe('desconocido');
  });
});

/**
 * Comprueba la cabecera `X-XSRF-TOKEN` con el interceptor XSRF real de Angular.
 * Límite: se usa la misma configuración (`withXsrfConfiguration`) que `appConfig`, pero
 * no el `withFetch()` real, porque `HttpClientTestingBackend` sustituye al backend; el
 * interceptor XSRF se ejecuta antes del backend, así que el resultado es equivalente.
 */
describe('protección CSRF (X-XSRF-TOKEN)', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    borrarCookie('XSRF-TOKEN');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }), withInterceptors([])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    borrarCookie('XSRF-TOKEN');
    controller.verify();
  });

  for (const metodo of ['post', 'put', 'delete'] as const) {
    it(`${metodo.toUpperCase()} a /api con cookie XSRF-TOKEN envía X-XSRF-TOKEN`, () => {
      document.cookie = 'XSRF-TOKEN=token-abc; path=/';
      (metodo === 'delete' ? http.delete('/api/reservas/1') : http[metodo]('/api/reservas', {})).subscribe();
      const req = controller.expectOne((r) => r.url.startsWith('/api/reservas'));
      expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('token-abc');
      req.flush(null);
    });
  }

  it('GET no envía X-XSRF-TOKEN', () => {
    document.cookie = 'XSRF-TOKEN=token-abc; path=/';
    http.get('/api/reservas').subscribe();
    const req = controller.expectOne('/api/reservas');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBeFalse();
    req.flush([]);
  });

  it('sin cookie no envía la cabecera', () => {
    http.post('/api/reservas', {}).subscribe();
    const req = controller.expectOne('/api/reservas');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBeFalse();
    req.flush(null);
  });

  it('el valor de la cookie se envía tal cual aunque cambie entre peticiones (csrf renovado)', () => {
    document.cookie = 'XSRF-TOKEN=uno; path=/';
    http.post('/api/reservas', {}).subscribe();
    expect(controller.expectOne('/api/reservas').request.headers.get('X-XSRF-TOKEN')).toBe('uno');
    document.cookie = 'XSRF-TOKEN=dos; path=/';
    http.post('/api/reservas', {}).subscribe();
    expect(controller.expectOne('/api/reservas').request.headers.get('X-XSRF-TOKEN')).toBe('dos');
  });

  it('no se envía a URLs absolutas de otro origen', () => {
    document.cookie = 'XSRF-TOKEN=token-abc; path=/';
    http.post('https://otro.example.com/api/x', {}, { headers: new HttpHeaders() }).subscribe();
    const req = controller.expectOne('https://otro.example.com/api/x');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBeFalse();
    req.flush(null);
  });
});
