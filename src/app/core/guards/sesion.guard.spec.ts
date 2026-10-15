import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, fakeAsync, flush, flushMicrotasks } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, from } from 'rxjs';

import { Usuario } from '../models/usuario.model';
import { SesionService } from '../services/sesion.service';
import { loginGuard, sesionGuard } from './sesion.guard';

@Component({ template: '' })
class VacioComponent {}

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };

describe('guards de sesión', () => {
  let router: Router;
  let sesion: SesionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'protegida', component: VacioComponent, canActivate: [sesionGuard] },
          { path: 'login', component: VacioComponent, canActivate: [loginGuard] },
          { path: 'reservas', component: VacioComponent },
          { path: 'error/no-disponible', component: VacioComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    router = TestBed.inject(Router);
    sesion = TestBed.inject(SesionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * Ejecuta el guard directamente para la URL pedida, sin pasar por la navegación del router,
   * y devuelve su resultado: `true`, o la URL serializada de la redirección.
   * La petición a `/me`, si el guard la hace, queda pendiente de responder en `http`.
   */
  function ejecutarGuard(guard: CanActivateFn, url: string): Promise<true | false | string> {
    const resultado = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return firstValueFrom(from(resultado as Observable<boolean | UrlTree>)).then((r) =>
      typeof r === 'boolean' ? r : router.serializeUrl(r),
    );
  }

  describe('sesionGuard', () => {
    it('con sesión deja pasar', async () => {
      sesion.establecer(ANA);
      expect(await router.navigateByUrl('/protegida')).toBeTrue();
      expect(router.url).toBe('/protegida');
    });

    it('sin sesión (anónimo) redirige a /login con returnUrl', async () => {
      sesion.limpiar();
      expect(await router.navigateByUrl('/protegida?x=1')).toBeTrue();
      expect(router.url).toBe('/login?returnUrl=%2Fprotegida%3Fx%3D1');
    });

    it('con sesión anónima no pregunta de nuevo al servidor', async () => {
      sesion.limpiar();
      expect(await ejecutarGuard(sesionGuard, '/protegida')).toBe('/login?returnUrl=%2Fprotegida');
      http.expectNone('/api/auth/me');
    });

    it('estado desconocido: pregunta a /me y, si responde 200, deja pasar', async () => {
      const resultado = ejecutarGuard(sesionGuard, '/protegida');
      http.expectOne('/api/auth/me').flush(ANA);
      expect(await resultado).toBeTrue();
      expect(sesion.usuario()).toEqual(ANA);
    });

    it('estado desconocido: /me 401 → /login con returnUrl', async () => {
      const resultado = ejecutarGuard(sesionGuard, '/protegida');
      http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      http.expectOne('/api/auth/csrf').flush(null);
      expect(await resultado).toBe('/login?returnUrl=%2Fprotegida');
    });

    it('estado desconocido y el servidor no responde → /error/no-disponible con returnUrl', async () => {
      const resultado = ejecutarGuard(sesionGuard, '/protegida');
      http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
      expect(await resultado).toBe('/error/no-disponible?returnUrl=%2Fprotegida');
    });

    it('estado desconocido, integrado con el router: /me 401 lleva a /login', fakeAsync(() => {
      void router.navigateByUrl('/protegida');
      flushMicrotasks();
      http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      http.expectOne('/api/auth/csrf').flush(null);
      flush();
      expect(router.url).toBe('/login?returnUrl=%2Fprotegida');
    }));

    it('la URL pedida es /login: no se encadena (no pone returnUrl=/login)', async () => {
      sesion.limpiar();
      expect(await ejecutarGuard(sesionGuard, '/login')).toBe('/login');
    });

    for (const url of ['//evil.com', '/error/inesperado', '/login?returnUrl=%2Fx']) {
      it(`returnUrl no seguro «${url}» no se propaga`, async () => {
        sesion.limpiar();
        expect(await ejecutarGuard(sesionGuard, url)).toBe('/login');
      });
    }
  });

  describe('loginGuard', () => {
    it('sin sesión muestra el login', async () => {
      sesion.limpiar();
      expect(await router.navigateByUrl('/login')).toBeTrue();
      expect(router.url).toBe('/login');
    });

    it('con sesión redirige /login → /reservas', async () => {
      sesion.establecer(ANA);
      await router.navigateByUrl('/login');
      expect(router.url).toBe('/reservas');
    });

    it('estado desconocido con /me 200 → /reservas', async () => {
      const resultado = ejecutarGuard(loginGuard, '/login');
      http.expectOne('/api/auth/me').flush(ANA);
      expect(await resultado).toBe('/reservas');
    });

    it('si no se puede comprobar la sesión, muestra igualmente el login', async () => {
      const resultado = ejecutarGuard(loginGuard, '/login');
      http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
      expect(await resultado).toBeTrue();
    });
  });
});
