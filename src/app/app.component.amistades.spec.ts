import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { SolicitudAmistad } from './core/models/amistad.model';
import { Usuario } from './core/models/usuario.model';
import { SesionService } from './core/services/sesion.service';
import { PETICIONES_DE_SESION, descartarPeticionesDeFondo } from './testing/peticiones-de-fondo';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const ADMIN: Usuario = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

const solicitudes = (n: number): SolicitudAmistad[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    usuario: { id: i + 100, nombre: `Persona ${i + 1}` },
    fecha: '2026-10-01T10:00:00Z',
  }));

describe('AppComponent: enlace «Amigos» de la cabecera', () => {
  let fixture: ComponentFixture<AppComponent>;
  let http: HttpTestingController;
  let sesion: SesionService;
  let el: HTMLElement;

  beforeEach(async () => {
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
    descartarPeticionesDeFondo(http, PETICIONES_DE_SESION);
    http.verify();
  });

  const nav = () => el.querySelector('nav[aria-label="Principal"]');
  const enlace = () => nav()?.querySelector('a[href="/amigos"]') ?? null;
  const insignia = () => el.querySelector('.insignia');

  /** Inicia sesión y responde a la carga del indicador con `n` solicitudes. */
  function conSesion(usuario: Usuario, n: number): void {
    sesion.establecer(usuario);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/amistades/solicitudes/recibidas').flush(solicitudes(n));
    fixture.detectChanges();
  }

  it('sin sesión no hay navegación principal ni enlace «Amigos»', () => {
    sesion.limpiar();
    fixture.detectChanges();
    TestBed.tick();
    expect(nav()).toBeNull();
    expect(el.querySelector('a[href="/amigos"]')).toBeNull();
    http.expectNone('/api/amistades/solicitudes/recibidas');
  });

  it('un USER ve el enlace «Amigos» en el nav «Principal»', () => {
    conSesion(ANA, 0);
    expect(enlace()?.textContent).toContain('Amigos');
  });

  it('un ADMIN también ve el enlace, además de la navegación de administración', () => {
    conSesion(ADMIN, 0);
    expect(enlace()).not.toBeNull();
    expect(el.querySelector('nav[aria-label="Administración"] a[href="/admin/salas"]')).not.toBeNull();
  });

  it('el USER no ve la navegación de administración', () => {
    conSesion(ANA, 0);
    expect(el.querySelector('nav[aria-label="Administración"]')).toBeNull();
  });

  it('con 0 pendientes no hay insignia ni texto oculto', () => {
    conSesion(ANA, 0);
    expect(insignia()).toBeNull();
    expect(enlace()?.querySelector('.visualmente-oculto')).toBeNull();
    expect(enlace()?.textContent?.trim()).toBe('Amigos');
  });

  it('con 1 pendiente: insignia «1» aria-hidden y texto oculto en singular', () => {
    conSesion(ANA, 1);
    expect(insignia()?.textContent?.trim()).toBe('1');
    expect(insignia()?.getAttribute('aria-hidden')).toBe('true');
    expect(enlace()?.querySelector('.visualmente-oculto')?.textContent?.trim()).toBe('(1 solicitud pendiente)');
  });

  it('con 3 pendientes: insignia «3» y texto oculto en plural', () => {
    conSesion(ANA, 3);
    expect(insignia()?.textContent?.trim()).toBe('3');
    expect(enlace()?.querySelector('.visualmente-oculto')?.textContent?.trim()).toBe('(3 solicitudes pendientes)');
  });

  it('el nombre accesible del enlace incluye el número pero no duplica la insignia', () => {
    conSesion(ANA, 2);
    const visible = Array.from(enlace()!.childNodes)
      .filter((n) => n.nodeType !== Node.COMMENT_NODE && !(n instanceof HTMLElement && n.getAttribute('aria-hidden') === 'true'))
      .map((n) => n.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(visible).toBe('Amigos (2 solicitudes pendientes)');
  });

  it('si falla la carga del indicador no hay insignia', () => {
    sesion.establecer(ANA);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/amistades/solicitudes/recibidas').flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(insignia()).toBeNull();
    expect(enlace()).not.toBeNull();
  });

  it('al cerrar la sesión desaparecen el enlace y la insignia', () => {
    conSesion(ANA, 2);
    sesion.limpiar();
    fixture.detectChanges();
    expect(nav()).toBeNull();
    expect(insignia()).toBeNull();
  });
});
