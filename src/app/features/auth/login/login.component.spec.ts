import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { Usuario } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { AHORA } from '../../../core/tokens/ahora.token';
import {
  LoginComponent,
  MENSAJE_CREDENCIALES_INVALIDAS,
  MENSAJE_DATOS_INVALIDOS,
  MENSAJE_DEMASIADOS_INTENTOS,
  MENSAJE_FIN_ESPERA,
  MENSAJE_LOGIN_FALLIDO,
  MAX_SEGUNDOS_RETRY_AFTER,
  mensajeEspera,
} from './login.component';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  /** Momento actual (ms) que devuelve `AHORA` en las pruebas; se avanza a mano junto con `tick`. */
  let ahoraMs: number;
  /** Veces que el componente ha consultado `AHORA`. */
  let consultasReloj: number;

  /** Configura el módulo y crea el componente sin esperas (válido también dentro de `fakeAsync`). */
  function montar(returnUrl: string | null = null): void {
    ahoraMs = new Date(2026, 9, 16, 10, 0, 0).getTime();
    consultasReloj = 0;
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AHORA,
          useValue: () => {
            consultasReloj++;
            return new Date(ahoraMs);
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl === null ? {} : { returnUrl }) } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  async function crear(returnUrl: string | null = null): Promise<void> {
    montar(returnUrl);
    await fixture.whenStable();
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

  describe('429 (demasiados intentos)', () => {
    const espera = () => el.querySelector('#login-espera') as HTMLElement | null;
    const estado = () => el.querySelector('#login-estado') as HTMLElement;

    /** Envía el login y responde 429 con la cabecera `Retry-After` indicada (o sin ella). */
    function responder429(retryAfter?: string): void {
      rellenar('ana@example.com', 'mala');
      enviar();
      const headers: Record<string, string> = retryAfter === undefined ? {} : { 'Retry-After': retryAfter };
      peticionLogin().flush(
        { title: 'Demasiados intentos', status: 429, detail: 'Texto del servidor' },
        { status: 429, statusText: 'Too Many Requests', headers },
      );
    }

    /** Avanza el reloj de `AHORA` y los temporizadores de segundo en segundo. */
    function avanzar(segundos: number): void {
      for (let i = 0; i < segundos; i++) {
        ahoraMs += 1000;
        tick(1000);
      }
      fixture.detectChanges();
    }

    it('mensajeEspera redondea hacia arriba a minutos y usa «menos de un minuto» por debajo de 60 s', () => {
      expect(mensajeEspera(1)).toBe('Has hecho demasiados intentos. Vuelve a intentarlo en menos de un minuto.');
      expect(mensajeEspera(59)).toContain('en menos de un minuto.');
      expect(mensajeEspera(60)).toBe('Has hecho demasiados intentos. Vuelve a intentarlo en 1 minuto.');
      expect(mensajeEspera(61)).toBe('Has hecho demasiados intentos. Vuelve a intentarlo en 2 minutos.');
      expect(mensajeEspera(300)).toBe('Has hecho demasiados intentos. Vuelve a intentarlo en 5 minutos.');
      expect(mensajeEspera(301)).toContain('en 6 minutos.');
    });

    it('con Retry-After: mensaje con minutos, enfocado, contraseña vacía y botón desactivado con cuenta atrás', fakeAsync(() => {
      montar();
      responder429('300');
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      expect(errorGeneral()?.textContent?.trim()).toBe(mensajeEspera(300));
      expect(errorGeneral()?.textContent).not.toContain('Texto del servidor');
      expect(document.activeElement).toBe(errorGeneral());
      expect(input('password').value).toBe('');
      expect(input('email').value).toBe('ana@example.com');
      expect(boton().disabled).toBeTrue();
      expect(boton().textContent).toContain('Entrar');
      expect(boton().getAttribute('aria-describedby')).toBe('login-espera');
      expect(espera()?.textContent).toContain('5:00');
      expect(router.navigateByUrl).not.toHaveBeenCalled();

      avanzar(1);
      expect(espera()?.textContent).toContain('4:59');
      avanzar(234);
      expect(espera()?.textContent).toContain('1:05');
      expect(boton().disabled).toBeTrue();
      expect(estado().textContent?.trim()).toBe('');

      expect(document.activeElement).toBe(errorGeneral());
      avanzar(65);
      fixture.detectChanges();
      expect(boton().disabled).toBeFalse();
      expect(boton().getAttribute('aria-describedby')).toBeNull();
      expect(espera()).toBeNull();
      expect(estado().textContent?.trim()).toBe(MENSAJE_FIN_ESPERA);
      // El mensaje del 429 ya no es cierto: desaparece y el foco que tenía pasa al botón «Entrar».
      expect(errorGeneral()).toBeNull();
      expect(document.activeElement).toBe(boton());
      // El intervalo se ha parado: no quedan temporizadores periódicos (fakeAsync fallaría).
    }));

    it('al terminar la espera con el foco en otro sitio, se quita el mensaje y el foco no se mueve', fakeAsync(() => {
      montar();
      responder429('5');
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      input('email').focus();
      avanzar(5);
      fixture.detectChanges();
      expect(errorGeneral()).toBeNull();
      expect(estado().textContent?.trim()).toBe(MENSAJE_FIN_ESPERA);
      expect(document.activeElement).toBe(input('email'));
    }));

    it('menos de 60 s: «en menos de un minuto» y cuenta atrás en segundos', fakeAsync(() => {
      montar();
      responder429('45');
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      expect(errorGeneral()?.textContent).toContain('en menos de un minuto');
      expect(espera()?.textContent).toContain('0:45');
      avanzar(45);
      expect(boton().disabled).toBeFalse();
      expect(estado().textContent).toContain(MENSAJE_FIN_ESPERA);
    }));

    it('durante la espera no se puede enviar y, al terminar, se puede volver a intentar', fakeAsync(() => {
      montar();
      responder429('10');
      fixture.detectChanges();
      flush();
      rellenar('ana@example.com', 'buena');
      enviar();
      http.expectNone('/api/auth/csrf');
      http.expectNone('/api/auth/login');

      avanzar(10);
      enviar();
      // Al reintentar se limpian el aviso de fin de espera y el mensaje anterior.
      expect(estado().textContent?.trim()).toBe('');
      expect(errorGeneral()).toBeNull();
      const req = peticionLogin();
      expect(req.request.body.password).toBe('buena');
      req.flush(ANA);
      flush();
      expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/reservas');
    }));

    it('no se reintenta: una sola petición de csrf y una de login', async () => {
      await crear();
      responder429('300');
      await esperarRender();
      http.expectNone('/api/auth/csrf');
      http.expectNone('/api/auth/login');
      expect(TestBed.inject(SesionService).autenticado()).toBeFalse();
      fixture.destroy();
    });

    it('accesibilidad: la cuenta atrás no está en una región viva y el estado existe desde el principio', fakeAsync(() => {
      montar();
      expect(estado().getAttribute('role')).toBe('status');
      expect(estado().textContent?.trim()).toBe('');
      responder429('120');
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      // El mensaje inicial se anuncia al recibir el foco, sin `role="alert"` (no se lee dos veces).
      expect(errorGeneral()?.getAttribute('role')).toBeNull();
      expect(document.activeElement).toBe(errorGeneral());
      const cuenta = espera() as HTMLElement;
      expect(cuenta.closest('[aria-live], [role="status"], [role="alert"], [role="timer"]')).toBeNull();
      expect(estado().contains(cuenta)).toBeFalse();
      // Mientras corre la cuenta atrás, la región `status` no cambia.
      avanzar(30);
      expect(estado().textContent?.trim()).toBe('');
      avanzar(90);
      expect(estado().textContent?.trim()).toBe(MENSAJE_FIN_ESPERA);
    }));

    it('al destruir el componente durante la espera se para la cuenta atrás', fakeAsync(() => {
      montar();
      responder429('300');
      fixture.detectChanges();
      flush();
      avanzar(2);
      const consultas = consultasReloj;
      expect(consultas).toBeGreaterThan(0);
      fixture.destroy();
      // Si el intervalo siguiera activo, seguiría consultando el reloj (y fakeAsync fallaría por temporizadores pendientes).
      ahoraMs += 5000;
      tick(5000);
      expect(consultasReloj).toBe(consultas);
    }));

    it('sin Retry-After: mensaje genérico sin tiempo, contraseña vacía y botón activo', async () => {
      await crear();
      responder429();
      await esperarRender();
      expect(errorGeneral()?.textContent?.trim()).toBe(MENSAJE_DEMASIADOS_INTENTOS);
      expect(document.activeElement).toBe(errorGeneral());
      expect(input('password').value).toBe('');
      expect(boton().disabled).toBeFalse();
      expect(espera()).toBeNull();
    });

    for (const invalido of ['', 'abc', '-5', '1.5', '0', '10s', 'Fri, 16 Oct 2026 10:05:00 GMT', '86401', '99999999999999999999']) {
      it(`Retry-After no válido «${invalido}»: mensaje genérico y botón activo`, async () => {
        await crear();
        responder429(invalido);
        await esperarRender();
        expect(errorGeneral()?.textContent?.trim()).toBe(MENSAJE_DEMASIADOS_INTENTOS);
        expect(boton().disabled).toBeFalse();
        expect(espera()).toBeNull();
      });
    }

    it('Retry-After de 24 h exactas (86400 s) se acepta y bloquea', fakeAsync(() => {
      montar();
      responder429(String(MAX_SEGUNDOS_RETRY_AFTER));
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      expect(errorGeneral()?.textContent).toContain('en 1440 minutos');
      expect(boton().disabled).toBeTrue();
      expect(espera()?.textContent).toContain('1440:00');
      fixture.destroy();
    }));

    it('Retry-After con espacios alrededor se acepta', fakeAsync(() => {
      montar();
      responder429(' 90 ');
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      expect(errorGeneral()?.textContent).toContain('en 2 minutos');
      expect(espera()?.textContent).toContain('1:30');
      avanzar(90);
    }));
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
