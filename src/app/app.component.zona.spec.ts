import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { ERRORES_PROPIOS } from './core/http/errores-propios';
import { Usuario } from './core/models/usuario.model';
import { ConfiguracionService } from './core/services/configuracion.service';
import { SesionService } from './core/services/sesion.service';
import { descartarPeticionesDeFondo } from './testing/peticiones-de-fondo';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const LUIS: Usuario = { id: 2, email: 'luis@example.com', nombre: 'Luis', rol: 'USER' };
const ZONA = '/api/config/zona-horaria';

describe('AppComponent: zona horaria al iniciar la sesión', () => {
  let fixture: ComponentFixture<AppComponent>;
  let http: HttpTestingController;
  let sesion: SesionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    fixture = TestBed.createComponent(AppComponent);
  });

  afterEach(() => {
    descartarPeticionesDeFondo(http, ['/api/invitaciones/pendientes', '/api/amistades/solicitudes/recibidas']);
    http.verify();
  });

  function iniciar(usuario: Usuario): void {
    sesion.establecer(usuario);
    fixture.detectChanges();
    TestBed.tick();
  }

  it('sin sesión no la pide', () => {
    sesion.limpiar();
    fixture.detectChanges();
    TestBed.tick();
    http.expectNone(ZONA);
  });

  it('al iniciar sesión la pide una vez, sin que el interceptor gestione sus errores, y la guarda', () => {
    iniciar(ANA);
    const req = http.expectOne(ZONA);
    expect(req.request.context.get(ERRORES_PROPIOS)).toBe('todos');
    req.flush({ zonaHoraria: 'Pacific/Kiritimati' });
    expect(TestBed.inject(ConfiguracionService).zonaHoraria()).toBe('Pacific/Kiritimati');
    fixture.detectChanges();
    TestBed.tick();
    http.expectNone(ZONA);
  });

  it('si falla, no pasa nada: la zona sigue sin conocerse', () => {
    iniciar(ANA);
    http.expectOne(ZONA).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(TestBed.inject(ConfiguracionService).zonaHoraria()).toBeUndefined();
  });

  it('con una sesión nueva (otro login) la vuelve a pedir', () => {
    iniciar(ANA);
    http.expectOne(ZONA).flush({ zonaHoraria: 'UTC' });
    iniciar(LUIS);
    http.expectOne(ZONA).flush({ zonaHoraria: 'Europe/Madrid' });
    expect(TestBed.inject(ConfiguracionService).zonaHoraria()).toBe('Europe/Madrid');
  });
});
