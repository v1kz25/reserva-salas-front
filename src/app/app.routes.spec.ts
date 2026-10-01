import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { routes } from './app.routes';

describe('rutas', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  it('la ruta por defecto / redirige a /reservas', async () => {
    await router.navigateByUrl('/');
    expect(location.path()).toBe('/reservas');
  });

  it('/reservas/nueva es accesible', async () => {
    await router.navigateByUrl('/reservas/nueva');
    expect(location.path()).toBe('/reservas/nueva');
  });

  it('una ruta desconocida no redirige y muestra la página «no encontrado»', async () => {
    await router.navigateByUrl('/lo-que-sea');
    expect(location.path()).toBe('/lo-que-sea');
    const ruta = router.routerState.snapshot.root.firstChild;
    expect(ruta?.routeConfig?.path).toBe('**');
    expect(ruta?.title).toBe('Página no encontrada');
  });

  for (const [url, titulo] of [
    ['/error/no-disponible', 'Servicio no disponible'],
    ['/error/inesperado', 'Error inesperado'],
    ['/error/sin-permiso', 'Sin permiso'],
    ['/no-encontrado', 'Página no encontrada'],
  ]) {
    it(`${url} es accesible con el título «${titulo}»`, async () => {
      await router.navigateByUrl(url);
      expect(location.path()).toBe(url);
      expect(router.routerState.snapshot.root.firstChild?.title).toBe(titulo);
    });
  }
});
