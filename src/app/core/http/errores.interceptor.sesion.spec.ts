import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Usuario } from '../models/usuario.model';
import { SesionService } from '../services/sesion.service';
import { conErroresPropios } from './errores-propios';
import { erroresInterceptor } from './errores.interceptor';

/** Sesión caducada y errores de autenticación/permisos del interceptor de errores. */
describe('erroresInterceptor (sesión y permisos)', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let navigate: jasmine.Spy;
  let sesion: SesionService;
  let urlActual: string;

  beforeEach(() => {
    urlActual = '/reservas?salaId=1';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    const router = TestBed.inject(Router);
    navigate = spyOn(router, 'navigate').and.resolveTo(true);
    spyOnProperty(router, 'url').and.callFake(() => urlActual);
    sesion.establecer({ id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' });
  });

  afterEach(() => controller.verify());

  function lanzar(
    metodo: 'get' | 'post' | 'delete',
    url: string,
    context?: ReturnType<typeof conErroresPropios>,
  ): { error?: unknown; completa: boolean } {
    const r: { error?: unknown; completa: boolean } = { completa: false };
    const opciones = { context };
    const peticion =
      metodo === 'post' ? http.post(url, {}, opciones) : metodo === 'get' ? http.get(url, opciones) : http.delete(url, opciones);
    peticion.subscribe({ error: (e: unknown) => (r.error = e), complete: () => (r.completa = true) });
    return r;
  }

  const sinSesion = { status: 401, statusText: 'Unauthorized' };

  it('401 en una petición normal: limpia la sesión y va a /login con returnUrl', () => {
    lanzar('get', '/api/reservas');
    controller.expectOne('/api/reservas').flush(null, sinSesion);
    expect(sesion.estado()).toBe('anonimo');
    expect(navigate).toHaveBeenCalledOnceWith(['/login'], { queryParams: { returnUrl: '/reservas?salaId=1' } });
  });

  it('401 con la sesión caducada en otra pantalla (detalle): returnUrl es esa pantalla', () => {
    urlActual = '/reservas/10';
    lanzar('delete', '/api/reservas/10');
    controller.expectOne('/api/reservas/10').flush(null, sinSesion);
    expect(navigate).toHaveBeenCalledOnceWith(['/login'], { queryParams: { returnUrl: '/reservas/10' } });
  });

  it('401 estando ya en /login: limpia la sesión, no navega ni propaga error', () => {
    urlActual = '/login?returnUrl=%2Freservas';
    const r = lanzar('get', '/api/reservas');
    controller.expectOne('/api/reservas').flush(null, sinSesion);
    expect(navigate).not.toHaveBeenCalled();
    expect(r.error).toBeUndefined();
    expect(sesion.autenticado()).toBeFalse();
  });

  it('401 desde una página de error: va a /login sin returnUrl', () => {
    urlActual = '/error/no-disponible?returnUrl=%2Freservas';
    lanzar('get', '/api/reservas');
    controller.expectOne('/api/reservas').flush(null, sinSesion);
    expect(navigate).toHaveBeenCalledOnceWith(['/login'], {});
  });

  describe('peticiones que gestionan sus propios errores', () => {
    it('login (400/401): el 401 se propaga, no redirige y no toca la sesión', () => {
      const r = lanzar('post', '/api/auth/login', conErroresPropios([400, 401]));
      controller.expectOne('/api/auth/login').flush(null, sinSesion);
      expect((r.error as HttpErrorResponse).status).toBe(401);
      expect(navigate).not.toHaveBeenCalled();
      expect(sesion.autenticado()).toBeTrue();
    });

    it('login: el 400 se propaga sin redirigir', () => {
      const r = lanzar('post', '/api/auth/login', conErroresPropios([400, 401]));
      controller.expectOne('/api/auth/login').flush({ title: 'x', status: 400 }, { status: 400, statusText: 'Bad Request' });
      expect((r.error as HttpErrorResponse).status).toBe(400);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('login: un 500 sí lo gestiona el interceptor (no-disponible)', () => {
      lanzar('post', '/api/auth/login', conErroresPropios([400, 401]));
      controller.expectOne('/api/auth/login').flush(null, { status: 503, statusText: 'x' });
      expect(navigate.calls.mostRecent().args[0]).toEqual(['/error/no-disponible']);
    });

    for (const status of [0, 401, 403, 500, 503]) {
      it(`me/csrf ('todos'): el estado ${status} no redirige ni limpia la sesión`, () => {
        const r = lanzar('get', '/api/auth/me', conErroresPropios('todos'));
        const req = controller.expectOne('/api/auth/me');
        if (status === 0) {
          req.error(new ProgressEvent('error'));
        } else {
          req.flush(null, { status, statusText: 'x' });
        }
        expect(r.error).toBeDefined();
        expect(navigate).not.toHaveBeenCalled();
        expect(sesion.autenticado()).toBeTrue();
      });
    }

    it('cancelar reserva: el 403 se propaga sin redirigir', () => {
      const r = lanzar('delete', '/api/reservas/10', conErroresPropios([403]));
      controller.expectOne('/api/reservas/10').flush(null, { status: 403, statusText: 'Forbidden' });
      expect((r.error as HttpErrorResponse).status).toBe(403);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('cancelar reserva: el 401 sigue llevando a /login (solo el 403 es propio)', () => {
      urlActual = '/reservas/10';
      lanzar('delete', '/api/reservas/10', conErroresPropios([403]));
      controller.expectOne('/api/reservas/10').flush(null, sinSesion);
      expect(navigate).toHaveBeenCalledOnceWith(['/login'], { queryParams: { returnUrl: '/reservas/10' } });
      expect(sesion.autenticado()).toBeFalse();
    });
  });

  describe('401 tardío (generación de la sesión)', () => {
    const ANA2: Usuario = { id: 2, email: 'luis@example.com', nombre: 'Luis', rol: 'USER' };

    it('si la sesión cambió desde que salió la petición, no la limpia ni redirige, y propaga el error', () => {
      const r = lanzar('get', '/api/reservas');
      const req = controller.expectOne('/api/reservas');
      sesion.establecer(ANA2); // p. ej. un login nuevo mientras la petición vieja seguía en vuelo
      req.flush(null, sinSesion);
      expect(sesion.usuario()).toEqual(ANA2);
      expect(navigate).not.toHaveBeenCalled();
      expect((r.error as HttpErrorResponse).status).toBe(401);
    });

    it('también si la sesión se limpió entre medias (logout): no redirige', () => {
      lanzar('get', '/api/reservas');
      const req = controller.expectOne('/api/reservas');
      sesion.limpiar();
      req.flush(null, sinSesion);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('con la misma generación sí limpia la sesión y redirige', () => {
      const generacion = sesion.generacion();
      lanzar('get', '/api/reservas');
      controller.expectOne('/api/reservas').flush(null, sinSesion);
      expect(sesion.generacion()).toBeGreaterThan(generacion);
      expect(sesion.autenticado()).toBeFalse();
      expect(navigate).toHaveBeenCalledOnceWith(['/login'], { queryParams: { returnUrl: '/reservas?salaId=1' } });
    });

    it('la generación avanza con establecer() y con limpiar()', () => {
      const g0 = sesion.generacion();
      sesion.establecer(ANA2);
      const g1 = sesion.generacion();
      sesion.limpiar();
      expect(g1).toBeGreaterThan(g0);
      expect(sesion.generacion()).toBeGreaterThan(g1);
    });
  });

  it('otro 403 (sin declarar) lleva a /error/sin-permiso y no cierra la sesión', () => {
    lanzar('get', '/api/reservas');
    controller.expectOne('/api/reservas').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(navigate).toHaveBeenCalledOnceWith(['/error/sin-permiso'], {});
    expect(sesion.autenticado()).toBeTrue();
  });

  it('403 de un POST normal (p. ej. crear reserva sin CSRF válido) lleva a /error/sin-permiso', () => {
    lanzar('post', '/api/reservas');
    controller.expectOne('/api/reservas').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(navigate).toHaveBeenCalledOnceWith(['/error/sin-permiso'], {});
  });
});
