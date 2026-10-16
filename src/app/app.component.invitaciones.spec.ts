import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { InvitacionRecibida } from './core/models/invitacion.model';
import { Usuario } from './core/models/usuario.model';
import { InvitacionesService } from './core/services/invitaciones.service';
import { SesionService } from './core/services/sesion.service';
import { descartarPeticionesDeFondo } from './testing/peticiones-de-fondo';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const PENDIENTES = '/api/invitaciones/pendientes';

const invitaciones = (n: number): InvitacionRecibida[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    reserva: { id: 100 + i, salaId: 1, fecha: '2026-10-20', horaInicio: '09:00', horaFin: '10:00', detalle: 'COMPLETO' },
  }));

describe('AppComponent: enlace «Mis reservas» de la cabecera', () => {
  let fixture: ComponentFixture<AppComponent>;
  let http: HttpTestingController;
  let sesion: SesionService;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    fixture = TestBed.createComponent(AppComponent);
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    http.match('/api/amistades/solicitudes/recibidas');
    http.match(PENDIENTES);
    descartarPeticionesDeFondo(http, ['/api/config/zona-horaria']);
    http.verify();
    localStorage.clear();
  });

  const nav = () => el.querySelector('nav[aria-label="Principal"]');
  const enlace = () => nav()?.querySelector('a[href="/mis-reservas"]') ?? null;
  const insignia = () => enlace()?.querySelector('.insignia') ?? null;

  /** Inicia sesión y responde al indicador de invitaciones con `n` pendientes. */
  function conSesion(n: number): void {
    sesion.establecer(ANA);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne(PENDIENTES).flush(invitaciones(n));
    fixture.detectChanges();
  }

  it('sin sesión no hay enlace ni se piden las pendientes', () => {
    sesion.limpiar();
    fixture.detectChanges();
    TestBed.tick();
    expect(enlace()).toBeNull();
    http.expectNone(PENDIENTES);
  });

  it('con sesión muestra «Mis reservas» en el nav «Principal»', () => {
    conSesion(0);
    expect(enlace()?.textContent).toContain('Mis reservas');
  });

  it('con 0 pendientes no hay insignia ni texto oculto', () => {
    conSesion(0);
    expect(insignia()).toBeNull();
    expect(enlace()?.querySelector('.visualmente-oculto')).toBeNull();
    expect(enlace()?.textContent?.trim()).toBe('Mis reservas');
  });

  it('con 1 pendiente: insignia «1» aria-hidden y texto oculto en singular', () => {
    conSesion(1);
    expect(insignia()?.textContent?.trim()).toBe('1');
    expect(insignia()?.getAttribute('aria-hidden')).toBe('true');
    expect(enlace()?.querySelector('.visualmente-oculto')?.textContent?.trim()).toBe('(1 invitación pendiente)');
  });

  it('con 3 pendientes: insignia «3» y texto oculto en plural', () => {
    conSesion(3);
    expect(insignia()?.textContent?.trim()).toBe('3');
    expect(enlace()?.querySelector('.visualmente-oculto')?.textContent?.trim()).toBe('(3 invitaciones pendientes)');
  });

  it('el nombre accesible incluye el número una sola vez (la insignia está oculta)', () => {
    conSesion(2);
    const visible = Array.from(enlace()!.childNodes)
      .filter((n) => n.nodeType !== Node.COMMENT_NODE && !(n instanceof HTMLElement && n.getAttribute('aria-hidden') === 'true'))
      .map((n) => n.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(visible).toBe('Mis reservas (2 invitaciones pendientes)');
  });

  it('si falla la carga del indicador no hay insignia, pero el enlace sigue', () => {
    sesion.establecer(ANA);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne(PENDIENTES).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(insignia()).toBeNull();
    expect(enlace()).not.toBeNull();
  });

  it('al aceptar una invitación la insignia baja', () => {
    conSesion(2);
    TestBed.inject(InvitacionesService).aceptar(1).subscribe();
    http.expectOne('/api/invitaciones/1/aceptar').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(insignia()?.textContent?.trim()).toBe('1');
    expect(enlace()?.querySelector('.visualmente-oculto')?.textContent?.trim()).toBe('(1 invitación pendiente)');
  });

  it('al responder la última desaparece la insignia', () => {
    conSesion(1);
    TestBed.inject(InvitacionesService).rechazar(1).subscribe();
    http.expectOne('/api/invitaciones/1/rechazar').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(insignia()).toBeNull();
  });

  it('al cerrar la sesión desaparecen el enlace y la insignia', () => {
    conSesion(2);
    sesion.limpiar();
    fixture.detectChanges();
    expect(enlace()).toBeNull();
    expect(el.querySelector('.insignia')).toBeNull();
  });
});
