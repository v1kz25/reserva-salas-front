import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { SesionService } from './core/services/sesion.service';

describe('ruta /amigos', () => {
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
    await router.navigateByUrl('/amigos');
    expect(router.url).toBe('/login?returnUrl=%2Famigos');
  });

  it('con sesión es accesible y se titula «Amigos»', async () => {
    sesion.establecer({ id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' });
    await router.navigateByUrl('/amigos');
    expect(router.url).toBe('/amigos');
    expect(router.routerState.snapshot.root.firstChild?.title).toBe('Amigos');
    // Las listas que carga la pantalla quedan sin responder: no afecta a la ruta.
    http.match(() => true);
  });
});
