import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { Usuario } from './core/models/usuario.model';
import { SesionService } from './core/services/sesion.service';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const ADMIN: Usuario = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

describe('AppComponent: cabecera con la sesión', () => {
  let fixture: ComponentFixture<AppComponent>;
  let http: HttpTestingController;
  let sesion: SesionService;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AppComponent);
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  const salir = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Salir'));

  it('sin sesión no muestra usuario ni botón Salir', () => {
    sesion.limpiar();
    fixture.detectChanges();
    expect(salir()).toBeUndefined();
    expect(el.querySelector('.usuario')).toBeNull();
  });

  it('con sesión muestra el nombre y el botón Salir, sin «(administrador)»', () => {
    sesion.establecer(ANA);
    fixture.detectChanges();
    expect(el.querySelector('.usuario')?.textContent).toContain('Ana');
    expect(el.textContent).not.toContain('administrador');
    expect(salir()).toBeDefined();
  });

  it('con un administrador muestra «(administrador)»', () => {
    sesion.establecer(ADMIN);
    fixture.detectChanges();
    expect(el.querySelector('.usuario')?.textContent).toContain('Admin');
    expect(el.querySelector('.usuario')?.textContent).toContain('(administrador)');
  });

  it('el nombre se muestra como texto, no como HTML', () => {
    sesion.establecer({ ...ANA, nombre: '<b>Ana</b>' });
    fixture.detectChanges();
    expect(el.querySelector('.usuario b')).toBeNull();
    expect(el.querySelector('.usuario')?.textContent).toContain('<b>Ana</b>');
  });

  it('la cabecera se actualiza al cambiar de sesión', () => {
    sesion.establecer(ANA);
    fixture.detectChanges();
    sesion.limpiar();
    fixture.detectChanges();
    expect(salir()).toBeUndefined();
  });

  /** Responde al logout y a la renovación del csrf posterior. */
  function responderLogout(estado = 204): void {
    http.expectOne('/api/auth/logout').flush(null, { status: estado, statusText: 'x' });
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
  }

  it('Salir hace POST /api/auth/logout, cierra la sesión y navega a /login', async () => {
    sesion.establecer(ANA);
    fixture.detectChanges();
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);
    salir()?.click();
    fixture.detectChanges();
    expect((el.querySelector('.boton-barra') as HTMLButtonElement).disabled).toBeTrue();
    const req = http.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(sesion.autenticado()).toBeFalse();
    expect(navegar).toHaveBeenCalledOnceWith(['/login']);
    expect(salir()).toBeUndefined();
  });

  it('un doble clic en Salir envía un solo POST', () => {
    sesion.establecer(ANA);
    fixture.detectChanges();
    spyOn(router, 'navigate').and.resolveTo(true);
    salir()?.click();
    salir()?.click();
    responderLogout();
    expect(sesion.autenticado()).toBeFalse();
  });

  it('logout con 401 (sesión ya caducada) también lleva a /login', async () => {
    sesion.establecer(ANA);
    fixture.detectChanges();
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);
    salir()?.click();
    responderLogout(401);
    await fixture.whenStable();
    expect(navegar).toHaveBeenCalledOnceWith(['/login']);
    expect(sesion.autenticado()).toBeFalse();
  });

  it('logout con error 500: cierra igualmente la sesión local y va a /login', async () => {
    sesion.establecer(ANA);
    fixture.detectChanges();
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);
    salir()?.click();
    responderLogout(500);
    await fixture.whenStable();
    expect(sesion.autenticado()).toBeFalse();
    expect(navegar).toHaveBeenCalledWith(['/login']);
  });

  describe('enlace «Salas»', () => {
    const enlace = () => el.querySelector('nav a[href="/admin/salas"]');

    it('un ADMIN ve el enlace «Salas» en un nav', () => {
      sesion.establecer(ADMIN);
      fixture.detectChanges();
      expect(enlace()?.textContent?.trim()).toBe('Salas');
      expect(el.querySelector('nav')?.getAttribute('aria-label')).toBeTruthy();
    });

    it('un USER no ve el enlace', () => {
      sesion.establecer(ANA);
      fixture.detectChanges();
      expect(enlace()).toBeNull();
      expect(el.querySelector('nav')).toBeNull();
    });

    it('sin sesión no ve el enlace', () => {
      sesion.limpiar();
      fixture.detectChanges();
      expect(enlace()).toBeNull();
    });

    it('el enlace desaparece al cerrar la sesión', () => {
      sesion.establecer(ADMIN);
      fixture.detectChanges();
      sesion.limpiar();
      fixture.detectChanges();
      expect(enlace()).toBeNull();
    });
  });
});
