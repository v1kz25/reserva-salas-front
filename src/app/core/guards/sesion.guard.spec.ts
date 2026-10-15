import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';

import { Usuario } from '../models/usuario.model';
import { SesionService } from '../services/sesion.service';
import { loginGuard, sesionGuard } from './sesion.guard';

@Component({ template: '' })
class VacioComponent {}

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };

/** Deja que el router llegue al guard y éste lance su petición. */
const esperar = () => new Promise<void>((r) => setTimeout(r));

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
      await router.navigateByUrl('/protegida');
      http.expectNone('/api/auth/me');
      expect(router.url).toContain('/login');
    });

    it('estado desconocido: pregunta a /me y, si responde 200, deja pasar', async () => {
      const nav = router.navigateByUrl('/protegida');
      await esperar();
      http.expectOne('/api/auth/me').flush(ANA);
      expect(await nav).toBeTrue();
      expect(router.url).toBe('/protegida');
      expect(sesion.usuario()).toEqual(ANA);
    });

    it('estado desconocido: /me 401 → /login con returnUrl', async () => {
      const nav = router.navigateByUrl('/protegida');
      await esperar();
      http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
      http.expectOne('/api/auth/csrf').flush(null);
      await nav;
      expect(router.url).toBe('/login?returnUrl=%2Fprotegida');
    });

    it('estado desconocido y el servidor no responde → /error/no-disponible con returnUrl', async () => {
      const nav = router.navigateByUrl('/protegida');
      await esperar();
      http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
      await nav;
      expect(router.url).toBe('/error/no-disponible?returnUrl=%2Fprotegida');
    });

    it('la URL pedida es /login: el guard no se encadena (no pone returnUrl=/login)', async () => {
      sesion.limpiar();
      const arbol = TestBed.runInInjectionContext(() =>
        sesionGuard({} as never, { url: '/login' } as never),
      ) as import('rxjs').Observable<boolean | UrlTree>;
      let resultado: boolean | UrlTree | undefined;
      arbol.subscribe((r) => (resultado = r));
      expect(resultado instanceof UrlTree).toBeTrue();
      expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
    });

    it('returnUrl de una URL externa o de error no se propaga', async () => {
      sesion.limpiar();
      for (const url of ['//evil.com', '/error/inesperado']) {
        let resultado: boolean | UrlTree | undefined;
        (TestBed.runInInjectionContext(() => sesionGuard({} as never, { url } as never)) as import('rxjs').Observable<
          boolean | UrlTree
        >).subscribe((r) => (resultado = r));
        expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
      }
    });
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
      const nav = router.navigateByUrl('/login');
      await esperar();
      http.expectOne('/api/auth/me').flush(ANA);
      await nav;
      expect(router.url).toBe('/reservas');
    });

    it('si no se puede comprobar la sesión, muestra igualmente el login', async () => {
      const nav = router.navigateByUrl('/login');
      await esperar();
      http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
      expect(await nav).toBeTrue();
      expect(router.url).toBe('/login');
    });
  });
});
