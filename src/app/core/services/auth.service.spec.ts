import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ERRORES_PROPIOS } from '../http/errores-propios';
import { Usuario } from '../models/usuario.model';
import { AuthService } from './auth.service';
import { EstadoSesion, SesionService } from './sesion.service';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };

describe('AuthService', () => {
  let auth: AuthService;
  let sesion: SesionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    sesion = TestBed.inject(SesionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('obtenerCsrf', () => {
    it('hace GET /api/auth/csrf', () => {
      auth.obtenerCsrf().subscribe();
      const req = http.expectOne('/api/auth/csrf');
      expect(req.request.method).toBe('GET');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('gestiona él mismo todos los errores (el interceptor no actúa)', () => {
      auth.obtenerCsrf().subscribe();
      const req = http.expectOne('/api/auth/csrf');
      expect(req.request.context.get(ERRORES_PROPIOS)).toBe('todos');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('un error no se propaga: completa con undefined', () => {
      let valor: unknown = 'sin-valor';
      let error: unknown;
      auth.obtenerCsrf().subscribe({ next: (v) => (valor = v), error: (e: unknown) => (error = e) });
      http.expectOne('/api/auth/csrf').flush(null, { status: 500, statusText: 'Error' });
      expect(valor).toBeUndefined();
      expect(error).toBeUndefined();
    });
  });

  describe('restaurarSesion', () => {
    function restaurar(): { estado?: EstadoSesion; error?: unknown } {
      const r: { estado?: EstadoSesion; error?: unknown } = {};
      auth.restaurarSesion().subscribe({ next: (e) => (r.estado = e), error: (e: unknown) => (r.error = e) });
      return r;
    }

    it('GET /api/auth/me con 200 inicia la sesión y no pide csrf', () => {
      const r = restaurar();
      const req = http.expectOne('/api/auth/me');
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(ERRORES_PROPIOS)).toBe('todos');
      req.flush(ANA);
      expect(r.estado).toBe('autenticado');
      expect(sesion.usuario()).toEqual(ANA);
      http.expectNone('/api/auth/csrf');
    });

    it('401 deja la sesión «anonimo» y pide el csrf', () => {
      const r = restaurar();
      http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      expect(r.estado).toBeUndefined();
      http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
      expect(r.estado).toBe('anonimo');
      expect(sesion.estado()).toBe('anonimo');
    });

    it('401 y fallo del csrf: sigue siendo «anonimo» sin error', () => {
      const r = restaurar();
      http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      http.expectOne('/api/auth/csrf').flush(null, { status: 500, statusText: 'Error' });
      expect(r.estado).toBe('anonimo');
      expect(r.error).toBeUndefined();
    });

    it('401 tras una sesión previa la borra', () => {
      sesion.establecer(ANA);
      restaurar();
      http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      http.expectOne('/api/auth/csrf').flush(null);
      expect(sesion.autenticado()).toBeFalse();
    });

    it('error de red: «desconocido», no falla y no pide csrf', () => {
      const r = restaurar();
      http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
      expect(r.estado).toBe('desconocido');
      expect(r.error).toBeUndefined();
      expect(sesion.estado()).toBe('desconocido');
      http.expectNone('/api/auth/csrf');
    });

    it('500: «desconocido» y no falla', () => {
      const r = restaurar();
      http.expectOne('/api/auth/me').flush(null, { status: 500, statusText: 'Error' });
      expect(r.estado).toBe('desconocido');
      expect(r.error).toBeUndefined();
    });
  });

  describe('login', () => {
    const CRED = { email: 'ana@example.com', password: 'secreta' };

    it('pide el csrf ANTES del POST /api/auth/login con las credenciales', () => {
      let usuario: Usuario | undefined;
      auth.login(CRED).subscribe((u) => (usuario = u));
      // Hasta que no llega el csrf no se envía el login.
      http.expectNone('/api/auth/login');
      http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
      const req = http.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(CRED);
      req.flush(ANA);
      expect(usuario).toEqual(ANA);
      expect(sesion.usuario()).toEqual(ANA);
    });

    it('si falla el csrf, intenta igualmente el login', () => {
      auth.login(CRED).subscribe();
      http.expectOne('/api/auth/csrf').flush(null, { status: 500, statusText: 'Error' });
      http.expectOne('/api/auth/login').flush(ANA);
      expect(sesion.usuario()).toEqual(ANA);
    });

    it('declara que gestiona él mismo el 400 y el 401', () => {
      auth.login(CRED).subscribe();
      http.expectOne('/api/auth/csrf').flush(null);
      const req = http.expectOne('/api/auth/login');
      expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400, 401]);
      req.flush(ANA);
    });

    it('401: propaga el error y no inicia sesión', () => {
      let error: { status?: number } | undefined;
      auth.login(CRED).subscribe({ error: (e: { status?: number }) => (error = e) });
      http.expectOne('/api/auth/csrf').flush(null);
      http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
      expect(error?.status).toBe(401);
      expect(sesion.autenticado()).toBeFalse();
    });
  });

  describe('logout', () => {
    const CSRF = { status: 204, statusText: 'No Content' };

    it('hace POST /api/auth/logout sin cuerpo, limpia la sesión y renueva el csrf', () => {
      sesion.establecer(ANA);
      let completo = false;
      auth.logout().subscribe({ complete: () => (completo = true) });
      const req = http.expectOne('/api/auth/logout');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(sesion.estado()).toBe('anonimo');
      http.expectOne('/api/auth/csrf').flush(null, CSRF);
      expect(completo).toBeTrue();
    });

    it('gestiona él mismo los errores (el interceptor no actúa)', () => {
      auth.logout().subscribe();
      const req = http.expectOne('/api/auth/logout');
      expect(req.request.context.get(ERRORES_PROPIOS)).toBe('todos');
      req.flush(null);
      http.expectOne('/api/auth/csrf').flush(null, CSRF);
    });

    for (const [nombre, status] of [['401 (sesión ya caducada)', 401], ['403 (csrf caducado)', 403], ['500', 500]] as const) {
      it(`error ${nombre}: no se propaga y la sesión local se cierra igualmente`, () => {
        sesion.establecer(ANA);
        let error: unknown;
        let completo = false;
        auth.logout().subscribe({ error: (e: unknown) => (error = e), complete: () => (completo = true) });
        http.expectOne('/api/auth/logout').flush(null, { status, statusText: 'x' });
        expect(sesion.autenticado()).toBeFalse();
        http.expectOne('/api/auth/csrf').flush(null, CSRF);
        expect(error).toBeUndefined();
        expect(completo).toBeTrue();
      });
    }

    it('error de red: la sesión local se cierra igualmente', () => {
      sesion.establecer(ANA);
      auth.logout().subscribe();
      http.expectOne('/api/auth/logout').error(new ProgressEvent('error'));
      expect(sesion.autenticado()).toBeFalse();
      http.expectOne('/api/auth/csrf').flush(null);
    });
  });
});
