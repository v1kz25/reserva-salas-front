import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { UsuarioAltaComponent } from './usuario-alta.component';

describe('UsuarioAltaComponent', () => {
  let fixture: ComponentFixture<UsuarioAltaComponent>;
  let http: HttpTestingController;
  let navigate: jasmine.Spy;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuarioAltaComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(UsuarioAltaComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    el.remove();
  });

  const campo = (id: string) => el.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;

  function escribir(id: string, valor: string): void {
    const c = campo(id);
    c.value = valor;
    c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  function rellenar(datos: Partial<Record<'email' | 'nombre' | 'password', string>> = {}): void {
    escribir('email', datos.email ?? 'eva@example.com');
    escribir('nombre', datos.nombre ?? 'Eva');
    escribir('password', datos.password ?? 'clave-segura-1');
  }

  async function enviar(): Promise<void> {
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const errores = (id: string) => el.querySelector(`#${id}-error`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('muestra los campos con etiqueta, el rol USER por defecto y enlace «Cancelar» al listado', () => {
    for (const id of ['email', 'nombre', 'password', 'rol']) {
      expect(el.querySelector(`label[for="${id}"]`)).withContext(id).not.toBeNull();
    }
    expect(campo('rol').value).toBe('USER');
    expect(Array.from(campo('rol').querySelectorAll('option')).map((o) => o.value)).toEqual(['USER', 'ADMIN']);
    expect(el.querySelector('a[href="/admin/usuarios"]')?.textContent).toContain('Cancelar');
  });

  it('la contraseña es type=password con autocomplete=new-password', () => {
    expect(campo('password').getAttribute('type')).toBe('password');
    expect(campo('password').getAttribute('autocomplete')).toBe('new-password');
  });

  it('no muestra errores antes de interactuar', () => {
    expect(el.querySelectorAll('.error').length).toBe(0);
  });

  describe('validaciones (no envía nada)', () => {
    it('todo vacío: errores de email, nombre y contraseña', async () => {
      await enviar();
      expect(errores('email')).toContain('Indica el email');
      expect(errores('nombre')).toContain('Indica el nombre');
      expect(errores('password')).toContain('Indica la contraseña');
      http.expectNone(() => true);
    });

    it('email vacío no se acepta', async () => {
      rellenar({ email: '' });
      await enviar();
      expect(errores('email')).toContain('Indica el email');
      http.expectNone(() => true);
    });

    it('email con solo espacios no se acepta', async () => {
      rellenar({ email: '   ' });
      await enviar();
      expect(el.querySelector('#email')?.getAttribute('aria-invalid')).toBe('true');
      http.expectNone(() => true);
    });

    it('email inválido', async () => {
      rellenar({ email: 'no-es-un-email' });
      await enviar();
      expect(errores('email')).toContain('email válido');
      http.expectNone(() => true);
    });

    it('nombre vacío y nombre en blanco', async () => {
      rellenar({ nombre: '' });
      await enviar();
      expect(errores('nombre')).toContain('Indica el nombre');
      rellenar({ nombre: '    ' });
      await enviar();
      expect(errores('nombre')).toContain('Indica el nombre');
      http.expectNone(() => true);
    });

    it('contraseña de 7 caracteres: mínimo 8', async () => {
      rellenar({ password: '1234567' });
      await enviar();
      expect(errores('password')).toContain('Mínimo 8');
      http.expectNone(() => true);
    });

    it('contraseña de 8 caracteres: válida', async () => {
      rellenar({ password: '12345678' });
      await enviar();
      expect(http.expectOne('/api/usuarios').request.method).toBe('POST');
    });

    it('contraseña de 72 caracteres ASCII: válida', async () => {
      rellenar({ password: 'a'.repeat(72) });
      await enviar();
      expect(http.expectOne('/api/usuarios').request.method).toBe('POST');
    });

    it('73 bytes con caracteres multibyte (36 «ñ» + 1 ASCII = 37 caracteres): rechazada con el mensaje de longitud', async () => {
      rellenar({ password: 'ñ'.repeat(36) + 'a' });
      await enviar();
      expect(errores('password')).toContain('demasiado larga');
      http.expectNone(() => true);
    });

    it('72 bytes con caracteres multibyte (36 «ñ»): válida', async () => {
      rellenar({ password: 'ñ'.repeat(36) });
      await enviar();
      expect(http.expectOne('/api/usuarios').request.method).toBe('POST');
    });

    it('el campo email, nombre y contraseña declaran maxlength del contrato', () => {
      expect(campo('email').getAttribute('maxlength')).toBe('254');
      expect(campo('nombre').getAttribute('maxlength')).toBe('100');
      expect(campo('password').getAttribute('maxlength')).toBe('72');
    });
  });

  describe('foco', () => {
    it('al enviar con errores, el foco va al primer campo inválido', async () => {
      rellenar({ email: '' });
      await enviar();
      await new Promise((r) => setTimeout(r));
      expect(document.activeElement).toBe(campo('email'));
    });

    it('si solo falla la contraseña, el foco va a la contraseña', async () => {
      rellenar({ password: 'corta' });
      await enviar();
      await new Promise((r) => setTimeout(r));
      expect(document.activeElement).toBe(campo('password'));
    });

    it('los campos inválidos llevan aria-invalid y los errores están en regiones aria-live asociadas', async () => {
      await enviar();
      expect(campo('email').getAttribute('aria-invalid')).toBe('true');
      expect(campo('email').getAttribute('aria-describedby')).toContain('email-error');
      expect(el.querySelector('#email-error')?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('envío', () => {
    it('POST /api/usuarios con el cuerpo (email y nombre recortados, rol USER por defecto) y vuelve al listado con aviso', async () => {
      rellenar({ email: '  eva@example.com ', nombre: '  Eva  ' });
      await enviar();
      const req = http.expectOne('/api/usuarios');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'eva@example.com',
        nombre: 'Eva',
        password: 'clave-segura-1',
        rol: 'USER',
      });
      req.flush({ id: 5, email: 'eva@example.com', nombre: 'Eva', rol: 'USER', activo: true, fechaCreacion: '2026-10-15T10:00:00Z' });
      expect(navigate).toHaveBeenCalledTimes(1);
      const [ruta, extras] = navigate.calls.mostRecent().args as [string[], { state: Record<string, string> }];
      expect(ruta).toEqual(['/admin/usuarios']);
      expect(Object.values(extras.state)[0]).toContain('Eva');
    });

    it('con rol ADMIN seleccionado lo envía', async () => {
      rellenar();
      escribir('rol', 'ADMIN');
      await enviar();
      const req = http.expectOne('/api/usuarios');
      expect((req.request.body as { rol: string }).rol).toBe('ADMIN');
      req.flush({ id: 5, nombre: 'Eva' });
    });

    it('la contraseña no se recorta', async () => {
      rellenar({ password: ' con espacios ' });
      await enviar();
      const req = http.expectOne('/api/usuarios');
      expect((req.request.body as { password: string }).password).toBe(' con espacios ');
      req.flush({ id: 5, nombre: 'Eva' });
    });

    it('doble envío seguido: una sola petición y el botón indica «Guardando»', async () => {
      rellenar();
      const boton = el.querySelector('button[type="submit"]') as HTMLButtonElement;
      boton.click();
      boton.click();
      fixture.detectChanges();
      const reqs = http.match('/api/usuarios');
      expect(reqs.length).toBe(1);
      expect(boton.textContent).toContain('Guardando');
      expect(boton.disabled).toBeTrue();
      reqs[0].flush({ id: 5, nombre: 'Eva' });
    });

    it('409: el error se muestra en el campo email, con foco, sin navegar', async () => {
      rellenar();
      await enviar();
      http.expectOne('/api/usuarios').flush({ title: 'Conflicto', status: 409 }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
      expect(errores('email')).toContain('Ya existe un usuario con ese email');
      expect(campo('email').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(campo('email'));
      expect(el.querySelector('.error-general')).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
      expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeFalse();
    });

    it('tras el 409 se puede corregir el email y reenviar', async () => {
      rellenar();
      await enviar();
      http.expectOne('/api/usuarios').flush({ title: 'C', status: 409 }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      escribir('email', 'otra@example.com');
      await enviar();
      const req = http.expectOne('/api/usuarios');
      expect((req.request.body as { email: string }).email).toBe('otra@example.com');
      req.flush({ id: 6, nombre: 'Eva' });
    });

    it('400 con errores por campo: los pone en cada campo', async () => {
      rellenar();
      await enviar();
      http.expectOne('/api/usuarios').flush(
        { title: 'Solicitud no válida', status: 400, errores: [{ campo: 'password', mensaje: 'Contraseña demasiado común' }] },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      expect(errores('password')).toContain('Contraseña demasiado común');
      expect(el.querySelector('.error-general')).toBeNull();
    });

    it('400 con error sin campo: lo muestra en el error general', async () => {
      rellenar();
      await enviar();
      http.expectOne('/api/usuarios').flush(
        { title: 'Solicitud no válida', status: 400, errores: [{ campo: 'otro', mensaje: 'raro' }] },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      const general = el.querySelector('.error-general[role="alert"]');
      expect(general?.textContent).toContain('Revisa los datos');
      expect(general?.textContent).toContain('otro: raro');
    });

    it('400 con campo conocido sin control propio (activo): usa la etiqueta legible', async () => {
      rellenar();
      await enviar();
      http.expectOne('/api/usuarios').flush(
        { title: 'Solicitud no válida', status: 400, errores: [{ campo: 'otro', mensaje: 'raro' }, { campo: 'activo', mensaje: 'no válido' }] },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      const items = Array.from(el.querySelectorAll('.error-general li')).map((li) => li.textContent?.trim());
      expect(items).toContain('Estado: no válido');
      expect(items).toContain('otro: raro');
    });
  });
});
