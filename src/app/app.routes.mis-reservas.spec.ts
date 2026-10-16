import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { SesionService } from './core/services/sesion.service';

describe('ruta /mis-reservas', () => {
  let router: Router;
  let sesion: SesionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
    sesion = TestBed.inject(SesionService);
    http = TestBed.inject(HttpTestingController);
  });

  it('sin sesión redirige a /login con returnUrl', async () => {
    sesion.limpiar();
    await router.navigateByUrl('/mis-reservas');
    expect(router.url).toBe('/login?returnUrl=%2Fmis-reservas');
  });

  it('sin sesión conserva la pestaña y la página en el returnUrl', async () => {
    sesion.limpiar();
    await router.navigateByUrl('/mis-reservas?vista=invitado&page=2');
    expect(router.url).toContain('returnUrl=');
    expect(decodeURIComponent(router.url)).toContain('/mis-reservas?vista=invitado&page=2');
  });

  it('con sesión es accesible y se titula «Mis reservas»', async () => {
    sesion.establecer({ id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' });
    await router.navigateByUrl('/mis-reservas');
    expect(router.url).toBe('/mis-reservas');
    expect(router.routerState.snapshot.root.firstChild?.title).toBe('Mis reservas');
    // Las listas que carga la pantalla quedan sin responder: no afecta a la ruta.
    http.match(() => true);
  });
});
