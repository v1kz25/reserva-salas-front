import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { adminGuard } from './core/guards/admin.guard';
import { sesionGuard } from './core/guards/sesion.guard';
import { SesionService } from './core/services/sesion.service';

@Component({ template: '' })
class VacioComponent {}

const RUTAS_USUARIOS = ['admin/usuarios', 'admin/usuarios/nuevo', 'admin/usuarios/:id'];

describe('rutas de /admin/usuarios', () => {
  let router: Router;
  let sesion: SesionService;
  let http: HttpTestingController;

  beforeEach(() => {
    // Mismas rutas y guards que la aplicación, pero sin cargar los componentes reales.
    const simuladas: Route[] = [
      ...RUTAS_USUARIOS.map((path) => {
        const real = routes.find((r) => r.path === path) as Route;
        return { path, canActivate: real.canActivate, component: VacioComponent };
      }),
      { path: 'reservas', component: VacioComponent },
      { path: 'login', component: VacioComponent },
    ];
    TestBed.configureTestingModule({
      providers: [provideRouter(simuladas), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
    sesion = TestBed.inject(SesionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('las tres rutas existen, con título y [sesionGuard, adminGuard]', () => {
    for (const path of RUTAS_USUARIOS) {
      const ruta = routes.find((r) => r.path === path);
      expect(ruta).withContext(path).toBeDefined();
      expect(ruta?.title).withContext(path).toBeTruthy();
      expect(ruta?.canActivate).withContext(path).toEqual([sesionGuard, adminGuard]);
    }
  });

  it('«admin/usuarios/nuevo» va antes que «admin/usuarios/:id»', () => {
    const paths = routes.map((r) => r.path);
    expect(paths.indexOf('admin/usuarios/nuevo')).toBeLessThan(paths.indexOf('admin/usuarios/:id'));
  });

  for (const url of ['/admin/usuarios', '/admin/usuarios/nuevo', '/admin/usuarios/5']) {
    it(`un USER que va a ${url} acaba en /reservas`, async () => {
      sesion.establecer({ id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' });
      await router.navigateByUrl(url);
      expect(router.url).toBe('/reservas');
    });

    it(`un ADMIN entra en ${url}`, async () => {
      sesion.establecer({ id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' });
      expect(await router.navigateByUrl(url)).toBeTrue();
      expect(router.url).toBe(url);
    });

    it(`sin sesión, ${url} lleva a /login con returnUrl`, async () => {
      sesion.limpiar();
      await router.navigateByUrl(url);
      expect(router.url).toBe(`/login?returnUrl=${encodeURIComponent(url)}`);
    });
  }
});
