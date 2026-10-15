import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { Usuario } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { LoginComponent, MENSAJE_CREDENCIALES_INVALIDAS, MENSAJE_DATOS_INVALIDOS, MENSAJE_LOGIN_FALLIDO } from './login.component';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  async function crear(returnUrl: string | null = null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl === null ? {} : { returnUrl }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    el.remove();
  });

  const input = (id: string) => el.querySelector(`#${id}`) as HTMLInputElement;
  const boton = () => el.querySelector('button[type="submit"]') as HTMLButtonElement;
  const errorGeneral = () => el.querySelector('#login-error') as HTMLElement | null;

  function escribir(id: string, valor: string): void {
    const campo = input(id);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
  }

  function enviar(): void {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  async function esperarRender(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function rellenar(email = 'ana@example.com', password = 'secreta'): void {
    escribir('email', email);
    escribir('password', password);
    fixture.detectChanges();
  }

  /** Atiende el csrf previo y devuelve la petición de login. */
  function peticionLogin(): TestRequest {
    http.expectOne('/api/auth/csrf').flush(null, { status: 204, statusText: 'No Content' });
    return http.expectOne('/api/auth/login');
  }

  describe('estructura', () => {
    beforeEach(() => crear());

    it('tiene campos de email y contraseña con etiqueta y el tipo adecuado', () => {
      expect(el.querySelector('label[for="email"]')?.textContent).toContain('Email');
      expect(el.querySelector('label[for="password"]')?.textContent).toContain('Contraseña');
      expect(input('email').type).toBe('email');
      expect(input('password').type).toBe('password');
      expect(input('password').autocomplete).toBe('current-password');
      expect(boton().textContent).toContain('Entrar');
    });
  });

  describe('validación', () => {
    beforeEach(() => crear());

    it('vacío: muestra los errores, no envía y lleva el foco al primer campo con error', async () => {
      enviar();
      await esperarRender();
      expect(el.textContent).toContain('Indica tu email');
      expect(el.textContent).toContain('Indica tu contraseña');
      expect(input('email').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(input('email'));
      http.expectNone('/api/auth/csrf');
      http.expectNone('/api/auth/login');
    });

    it('email válido y contraseña vacía: el foco va a la contraseña', async () => {
      escribir('email', 'ana@example.com');
      enviar();
      await esperarRender();
      expect(el.textContent).not.toContain('Indica tu email');
      expect(document.activeElement).toBe(input('password'));
      http.expectNone('/api/auth/login');
    });

    it('email con formato no válido: error y no envía', async () => {
      rellenar('no-es-un-email', 'x');
      enviar();
      await esperarRender();
      expect(el.querySelector('#email-error')?.textContent).toContain('email válido');
      expect(document.activeElement).toBe(input('email'));
      http.expectNone('/api/auth/login');
    });

    it('email de más de 254 caracteres o contraseña de más de 128: no envía', async () => {
      // El validador de email de Angular ya rechaza más de 254 caracteres (con su propio mensaje).
      rellenar('a@' + 'b'.repeat(60).concat('.').repeat(5) + 'com', 'x'.repeat(129));
      enviar();
      await esperarRender();
      expect(el.querySelector('#email-error')?.textContent).toContain('email válido');
      // El atributo `maxlength` impide escribir más en el navegador; el validador sigue bloqueando el envío.
      expect(el.querySelector('#password-error')?.textContent?.trim()).toBe('');
      http.expectNone('/api/auth/login');
    });

    it('email solo con espacios: no es válido', async () => {
      rellenar('   ', 'x');
      enviar();
      await esperarRender();
      http.expectNone('/api/auth/login');
      expect(el.querySelector('#email-error')?.textContent?.trim()).not.toBe('');
    });

    it('los errores aparecen al salir del campo, no antes', () => {
      expect(el.querySelector('#email-error')?.textContent?.trim()).toBe('');
      escribir('email', '');
      fixture.detectChanges();
      expect(el.querySelector('#email-error')?.textContent).toContain('Indica tu email');
    });
  });

  describe('envío', () => {
    beforeEach(() => crear());

    it('pide el csrf y después hace POST /api/auth/login con email (sin espacios) y contraseña', () => {
      rellenar('  ana@example.com ', ' secreta ');
      enviar();
      http.expectNone('/api/auth/login');
      const req = peticionLogin();
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'ana@example.com', password: ' secreta ' });
      req.flush(ANA);
    });

    it('mientras envía, el botón está desactivado y un segundo envío no duplica la petición', () => {
      rellenar();
      enviar();
      fixture.detectChanges();
      expect(boton().disabled).toBeTrue();
      expect(boton().textContent).toContain('Entrando');
      enviar();
      http.expectOne('/api/auth/csrf').flush(null);
      enviar();
      const req = http.expectOne('/api/auth/login');
      http.expectNone('/api/auth/login');
      req.flush(ANA);
    });

    it('200: guarda la sesión y navega a /reservas si no hay returnUrl', async () => {
      rellenar();
      enviar();
      peticionLogin().flush(ANA);
      await fixture.whenStable();
      expect(TestBed.inject(SesionService).usuario()).toEqual(ANA);
      expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/reservas');
      expect(errorGeneral()).toBeNull();
    });

    it('401: muestra el mensaje, vacía la contraseña, conserva el email, reactiva el botón y enfoca el aviso', async () => {
      rellenar('ana@example.com', 'mala');
      enviar();
      peticionLogin().flush(
        { title: 'No autorizado', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );
      await esperarRender();
      expect(errorGeneral()?.textContent).toContain(MENSAJE_CREDENCIALES_INVALIDAS);
      // Se anuncia al recibir el foco; sin `role="alert"` para que no se lea dos veces.
      expect(errorGeneral()?.getAttribute('role')).toBeNull();
      expect(input('password').value).toBe('');
      expect(input('email').value).toBe('ana@example.com');
      expect(boton().disabled).toBeFalse();
      expect(document.activeElement).toBe(errorGeneral());
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(TestBed.inject(SesionService).autenticado()).toBeFalse();
    });

    it('el mensaje de 401 no revela cuál de los dos campos falla', () => {
      expect(MENSAJE_CREDENCIALES_INVALIDAS.toLowerCase()).toContain('email');
      expect(MENSAJE_CREDENCIALES_INVALIDAS.toLowerCase()).toContain('contraseña');
      expect(MENSAJE_CREDENCIALES_INVALIDAS.toLowerCase()).not.toContain('no existe');
    });

    it('tras un 401 se puede reintentar y el mensaje desaparece al volver a enviar', async () => {
      rellenar('ana@example.com', 'mala');
      enviar();
      peticionLogin().flush(null, { status: 401, statusText: 'Unauthorized' });
      await esperarRender();
      escribir('password', 'buena');
      enviar();
      expect(errorGeneral()).toBeNull();
      const req = peticionLogin();
      expect(req.request.body.password).toBe('buena');
      req.flush(ANA);
    });

    it('400 del servidor: muestra el mensaje de datos no válidos y no vacía la contraseña', async () => {
      rellenar('ana@example.com', 'secreta');
      enviar();
      peticionLogin().flush({ title: 'Solicitud no válida', status: 400 }, { status: 400, statusText: 'Bad Request' });
      await esperarRender();
      expect(errorGeneral()?.textContent).toContain(MENSAJE_DATOS_INVALIDOS);
      expect(input('password').value).toBe('secreta');
      expect(boton().disabled).toBeFalse();
    });

    it('403 (csrf no válido): reintenta una vez con un csrf nuevo y, si va bien, entra', async () => {
      rellenar();
      enviar();
      http.expectOne('/api/auth/csrf').flush(null);
      http.expectOne('/api/auth/login').flush(null, { status: 403, statusText: 'Forbidden' });
      expect(errorGeneral()).toBeNull();
      peticionLogin().flush(ANA);
      await fixture.whenStable();
      expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/reservas');
      expect(errorGeneral()).toBeNull();
    });

    it('403 también en el reintento: muestra MENSAJE_LOGIN_FALLIDO, conserva la contraseña y reactiva el botón', async () => {
      rellenar('ana@example.com', 'secreta');
      enviar();
      http.expectOne('/api/auth/csrf').flush(null);
      http.expectOne('/api/auth/login').flush(null, { status: 403, statusText: 'Forbidden' });
      peticionLogin().flush(null, { status: 403, statusText: 'Forbidden' });
      await esperarRender();
      expect(errorGeneral()?.textContent).toContain(MENSAJE_LOGIN_FALLIDO);
      expect(input('password').value).toBe('secreta');
      expect(boton().disabled).toBeFalse();
      expect(document.activeElement).toBe(errorGeneral());
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      http.expectNone('/api/auth/login');
    });

    it('error de red: no se queda cargando (el botón vuelve a estar activo)', async () => {
      rellenar();
      enviar();
      http.expectOne('/api/auth/csrf').flush(null);
      http.expectOne('/api/auth/login').error(new ProgressEvent('error'));
      await esperarRender();
      expect(boton().disabled).toBeFalse();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('returnUrl', () => {
    async function entrarCon(returnUrl: string | null): Promise<void> {
      await crear(returnUrl);
      rellenar();
      enviar();
      peticionLogin().flush(ANA);
      await fixture.whenStable();
    }

    it('200 con returnUrl interno: navega a esa URL', async () => {
      await entrarCon('/reservas/10?x=1');
      expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/reservas/10?x=1');
    });

    for (const insegura of ['https://evil.com', '//evil.com', 'reservas', '/login', '/login?returnUrl=%2Fx', '/error/sin-permiso', '/a\\b', '']) {
      it(`returnUrl no seguro «${insegura}»: navega a /reservas`, async () => {
        await entrarCon(insegura);
        expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/reservas');
      });
    }
  });
});
