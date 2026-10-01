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

  it('una ruta desconocida redirige a /reservas', async () => {
    await router.navigateByUrl('/lo-que-sea');
    expect(location.path()).toBe('/reservas');
  });
});
