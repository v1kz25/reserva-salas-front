import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Usuario } from '../models/usuario.model';
import { SesionService } from '../services/sesion.service';
import { adminGuard } from './admin.guard';
import { sesionGuard } from './sesion.guard';

@Component({ template: '' })
class VacioComponent {}

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const ADMIN: Usuario = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

const esperar = () => new Promise<void>((r) => setTimeout(r));

describe('adminGuard', () => {
  let router: Router;
  let sesion: SesionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/salas', component: VacioComponent, canActivate: [sesionGuard, adminGuard] },
          { path: 'solo-admin', component: VacioComponent, canActivate: [adminGuard] },
          { path: 'reservas', component: VacioComponent },
          { path: 'login', component: VacioComponent },
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

  it('un ADMIN entra', async () => {
    sesion.establecer(ADMIN);
    expect(await router.navigateByUrl('/admin/salas')).toBeTrue();
    expect(router.url).toBe('/admin/salas');
  });

  it('un USER va a /reservas', async () => {
    sesion.establecer(ANA);
    await router.navigateByUrl('/admin/salas');
    expect(router.url).toBe('/reservas');
  });

  it('sin sesión va a /login con returnUrl (decide sesionGuard)', async () => {
    sesion.limpiar();
    await router.navigateByUrl('/admin/salas');
    expect(router.url).toBe('/login?returnUrl=%2Fadmin%2Fsalas');
  });

  it('sin sesión y sin sesionGuard delante redirige él mismo a /login con returnUrl', async () => {
    sesion.limpiar();
    await router.navigateByUrl('/solo-admin');
    expect(router.url).toBe('/login?returnUrl=%2Fsolo-admin');
  });

  it('estado desconocido y /me devuelve un ADMIN: entra', async () => {
    const nav = router.navigateByUrl('/admin/salas');
    await esperar();
    http.expectOne('/api/auth/me').flush(ADMIN);
    expect(await nav).toBeTrue();
    expect(router.url).toBe('/admin/salas');
  });

  it('estado desconocido y /me devuelve un USER: va a /reservas', async () => {
    const nav = router.navigateByUrl('/admin/salas');
    await esperar();
    http.expectOne('/api/auth/me').flush(ANA);
    await nav;
    expect(router.url).toBe('/reservas');
  });

  it('estado desconocido y /me 401: va a /login', async () => {
    const nav = router.navigateByUrl('/admin/salas');
    await esperar();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/csrf').flush(null);
    await nav;
    expect(router.url).toBe('/login?returnUrl=%2Fadmin%2Fsalas');
  });

  it('con dos guards en la misma ruta solo se lanza un GET /api/auth/me', async () => {
    const nav = router.navigateByUrl('/admin/salas');
    await esperar();
    const peticiones = http.match('/api/auth/me');
    expect(peticiones.length).toBe(1);
    peticiones[0].flush(ADMIN);
    expect(await nav).toBeTrue();
  });

  it('el servidor no responde: va a /error/no-disponible (decide sesionGuard)', async () => {
    const nav = router.navigateByUrl('/admin/salas');
    await esperar();
    http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
    await nav;
    expect(router.url).toBe('/error/no-disponible?returnUrl=%2Fadmin%2Fsalas');
  });
});
