import { Location } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { AHORA } from '../tokens/ahora.token';
import { erroresInterceptor } from './errores.interceptor';
import { UltimoErrorService } from './ultimo-error.service';

const SALAS = [{ id: 1, nombre: 'Sala Norte', capacidad: 10, planta: 1 }];

describe('gestión de errores (router real + componentes)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let client: HttpClient;
  let location: Location;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
        { provide: AHORA, useValue: () => new Date(2026, 9, 1, 12, 30) },
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    location = TestBed.inject(Location);
  });

  afterEach(() => http.verify());

  const el = () => harness.routeNativeElement as HTMLElement;
  const reservas = () => http.match((r) => r.url === '/api/reservas');

  async function abrirListado(): Promise<void> {
    await harness.navigateByUrl('/reservas');
    harness.detectChanges();
  }


  function rellenarYEnviarForm(): void {
    const set = (id: string, valor: string) => {
      const c = el().querySelector(`#${id}`) as HTMLInputElement;
      c.value = valor;
      c.dispatchEvent(new Event('input'));
    };
    const sala = el().querySelector('#sala') as HTMLSelectElement;
    sala.value = sala.options[1].value;
    sala.dispatchEvent(new Event('change'));
    set('fecha', '2026-10-02');
    set('hora-inicio', '10:00');
    set('hora-fin', '11:00');
    set('responsable', 'Ana');
    set('motivo', 'Reunión');
    harness.detectChanges();
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    harness.detectChanges();
  }

  async function reposo(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  describe('listado', () => {
    for (const [nombre, respuesta, esperada, tipo] of [
      ['status 0', undefined, '/error/no-disponible', 'red'],
      ['502', { status: 502, statusText: 'Bad Gateway' }, '/error/no-disponible', 'http'],
      ['503', { status: 503, statusText: 'x' }, '/error/no-disponible', 'http'],
      ['504', { status: 504, statusText: 'x' }, '/error/no-disponible', 'http'],
      ['500 con cuerpo vacío (proxy)', { status: 500, statusText: 'x' }, '/error/no-disponible', 'http'],
      ['403', { status: 403, statusText: 'Forbidden' }, '/error/sin-permiso', 'http'],
    ] as const) {
      it(`${nombre}: redirige a ${esperada} sin mensaje propio del listado`, async () => {
        await abrirListado();
        http.expectOne('/api/salas').flush(SALAS);
        const req = reservas()[0];
        if (tipo === 'red') {
          req.error(new ProgressEvent('error'));
        } else {
          req.flush(null, respuesta!);
        }
        await reposo();
        expect(location.path().split('?')[0]).toBe(esperada);
        expect(el().querySelector('[role="alert"]')).toBeNull();
        expect(el().querySelector('h1')).not.toBeNull();
      });
    }

    it('500 con texto plano del proxy: no-disponible con returnUrl=/reservas', async () => {
      await abrirListado();
      http.expectOne('/api/salas').flush(SALAS);
      reservas()[0].flush('Error occurred while trying to proxy: localhost:4200/api/reservas', {
        status: 500,
        statusText: 'Internal Server Error',
      });
      await reposo();
      expect(location.path()).toBe('/error/no-disponible?returnUrl=%2Freservas');
    });

    it('500 con ProblemDetail: va a inesperado y muestra title/detail', async () => {
      await abrirListado();
      http.expectOne('/api/salas').flush(SALAS);
      reservas()[0].flush(
        { title: 'Error interno', status: 500, detail: 'Fallo X' },
        { status: 500, statusText: 'x' },
      );
      await reposo();
      expect(location.path()).toBe('/error/inesperado');
      expect(el().textContent).toContain('Error interno');
      expect(el().textContent).toContain('Fallo X');
      expect(TestBed.inject(UltimoErrorService).problema()?.detail).toBe('Fallo X');
    });

    it('404 y 400 se muestran en el listado sin redirigir', async () => {
      for (const status of [400, 404]) {
        await abrirListado();
        http.expectOne('/api/salas').flush(SALAS);
        reservas()[0].flush({ title: 'Fallo', status, detail: `Detalle ${status}` }, { status, statusText: 'x' });
        await reposo();
        expect(location.path()).toBe('/reservas');
        expect(el().querySelector('[role="alert"]')?.textContent).toContain(`Detalle ${status}`);
        await harness.navigateByUrl('/reservas/nueva');
        http.match(() => true);
      }
    });

    it('error de salas 503 también redirige y no muestra el aviso de salas', async () => {
      await abrirListado();
      http.expectOne('/api/salas').flush(null, { status: 503, statusText: 'x' });
      reservas().forEach((r) => r.flush([]));
      await reposo();
      expect(location.path().split('?')[0]).toBe('/error/no-disponible');
      expect(el().textContent).not.toContain('No se han podido cargar las salas');
    });
  });

  describe('formulario', () => {
    async function abrirFormulario(): Promise<void> {
      await harness.navigateByUrl('/reservas/nueva');
      harness.detectChanges();
      http.expectOne('/api/salas').flush(SALAS);
      harness.detectChanges();
    }

    function rellenarYEnviar(): void {
      const set = (id: string, valor: string, evento = 'input') => {
        const c = el().querySelector(`#${id}`) as HTMLInputElement;
        c.value = valor;
        c.dispatchEvent(new Event(evento));
      };
      const sala = el().querySelector('#sala') as HTMLSelectElement;
      sala.value = sala.options[1].value;
      sala.dispatchEvent(new Event('change'));
      set('fecha', '2026-10-02');
      set('hora-inicio', '10:00');
      set('hora-fin', '11:00');
      set('responsable', 'Ana');
      set('motivo', 'Reunión');
      harness.detectChanges();
      (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      harness.detectChanges();
    }

    for (const [status, ruta] of [
      [503, '/error/no-disponible'],
      [403, '/error/sin-permiso'],
    ] as const) {
      it(`POST ${status}: redirige a ${ruta} y el formulario no muestra error propio`, async () => {
        await abrirFormulario();
        rellenarYEnviar();
        http.expectOne('/api/reservas').flush(null, { status, statusText: 'x' });
        await reposo();
        expect(location.path().split('?')[0]).toBe(ruta);
        expect(el().querySelector('form')).toBeNull();
      });
    }

    it('POST 500 con ProblemDetail redirige a inesperado', async () => {
      await abrirFormulario();
      rellenarYEnviar();
      http
        .expectOne('/api/reservas')
        .flush({ title: 'Error interno', status: 500 }, { status: 500, statusText: 'x' });
      await reposo();
      expect(location.path()).toBe('/error/inesperado');
    });

    it('POST 500 sin cuerpo: no-disponible y returnUrl al formulario', async () => {
      await abrirFormulario();
      rellenarYEnviar();
      http.expectOne('/api/reservas').flush('Error occurred while trying to proxy', { status: 500, statusText: 'x' });
      await reposo();
      expect(location.path()).toBe('/error/no-disponible?returnUrl=%2Freservas%2Fnueva');
    });

    it('POST 409 se muestra en el formulario sin redirigir', async () => {
      await abrirFormulario();
      rellenarYEnviar();
      http
        .expectOne('/api/reservas')
        .flush({ title: 'Conflicto', status: 409, detail: 'La sala ya está reservada' }, { status: 409, statusText: 'x' });
      await reposo();
      expect(location.path()).toBe('/reservas/nueva');
      expect(el().querySelector('[role="alert"]')?.textContent).toContain('La sala ya está reservada');
    });

    it('POST 400 con errores por campo se muestra en el formulario sin redirigir', async () => {
      await abrirFormulario();
      rellenarYEnviar();
      http.expectOne('/api/reservas').flush(
        { title: 'Datos no válidos', status: 400, errores: [{ campo: 'motivo', mensaje: 'Motivo no válido' }] },
        { status: 400, statusText: 'x' },
      );
      await reposo();
      expect(location.path()).toBe('/reservas/nueva');
      expect(el().textContent).toContain('Motivo no válido');
    });

    it('error de salas 503 en el formulario redirige y no muestra aviso propio', async () => {
      await harness.navigateByUrl('/reservas/nueva');
      http.expectOne('/api/salas').flush(null, { status: 503, statusText: 'x' });
      await reposo();
      expect(location.path()).toBe('/error/no-disponible?returnUrl=%2Freservas%2Fnueva');
      expect(el().textContent).not.toContain('No se han podido cargar las salas');
    });
  });

  describe('sin bucles', () => {
    it('dos peticiones fallando a la vez producen una sola página de error y un solo returnUrl', async () => {
      await harness.navigateByUrl('/reservas/nueva');
      const salas = http.expectOne('/api/salas');
      client.get('/api/otra').subscribe();
      const otra = http.expectOne('/api/otra');
      salas.flush(null, { status: 503, statusText: 'x' });
      otra.error(new ProgressEvent('error'));
      await reposo();
      expect(location.path()).toBe('/error/no-disponible?returnUrl=%2Freservas%2Fnueva');
    });

    it('la segunda petición fallida, llegada ya en la página de error, no cambia la URL', async () => {
      await harness.navigateByUrl('/reservas/nueva');
      const salas = http.expectOne('/api/salas');
      client.get('/api/otra').subscribe();
      const otra = http.expectOne('/api/otra');
      salas.error(new ProgressEvent('error'));
      await reposo();
      otra.flush(null, { status: 500, statusText: 'x' });
      await reposo();
      expect(location.path()).toBe('/error/no-disponible?returnUrl=%2Freservas%2Fnueva');
    });

    it('500 con ProblemDetail y 503 simultáneos: gana el primero y no hay bucle', async () => {
      await harness.navigateByUrl('/reservas/nueva');
      http.expectOne('/api/salas');
      client.get('/api/a').subscribe();
      client.get('/api/b').subscribe();
      http.expectOne('/api/a').flush({ title: 'T', status: 500 }, { status: 500, statusText: 'x' });
      http.expectOne('/api/b').flush(null, { status: 503, statusText: 'x' });
      await reposo();
      expect(location.path()).toBe('/error/inesperado');
    });

    it('Reintentar con el servidor aún caído vuelve a la página de error una sola vez', async () => {
      await harness.navigateByUrl('/reservas/nueva');
      http.expectOne('/api/salas').flush(null, { status: 503, statusText: 'x' });
      await reposo();
      (el().querySelector('button') as HTMLButtonElement).click();
      await reposo();
      http.expectOne('/api/salas').flush(null, { status: 503, statusText: 'x' });
      await reposo();
      expect(location.path()).toBe('/error/no-disponible?returnUrl=%2Freservas%2Fnueva');
    });

    it('si la petición falla durante una navegación hacia una página de error, no se encadena otra', async () => {
      client.get('/api/x').subscribe();
      const x = http.expectOne('/api/x');
      const nav = harness.navigateByUrl('/error/sin-permiso');
      x.error(new ProgressEvent('error'));
      await nav;
      await reposo();
      expect(location.path()).toBe('/error/sin-permiso');
    });

    it('fuera de cualquier navegación, un error de petición usa la URL actual como origen', async () => {
      await harness.navigateByUrl('/reservas/nueva?a=1');
      http.expectOne('/api/salas');
      client.get('/api/x').subscribe();
      http.expectOne('/api/x').error(new ProgressEvent('error'));
      await reposo();
      expect(location.path()).toBe('/error/no-disponible?returnUrl=%2Freservas%2Fnueva%3Fa%3D1');
    });

    it('la URL de origen con caracteres especiales se conserva codificada', async () => {
      await harness.navigateByUrl('/reservas?salaId=1&fechaDesde=2026-10-02');
      http.match(() => true);
      client.get('/api/x').subscribe();
      http.expectOne('/api/x').error(new ProgressEvent('error'));
      await reposo();
      expect(location.path()).toBe(
        '/error/no-disponible?returnUrl=%2Freservas%3FsalaId%3D1%26fechaDesde%3D2026-10-02',
      );
    });
  });

  describe('navegación a la página de error que no se completa', () => {
    const casos = [
      ['resuelve false', (r: Router) => spyOn(r, 'navigate').and.resolveTo(false)],
      ['rechaza', (r: Router) => spyOn(r, 'navigate').and.rejectWith(new Error('navegación fallida'))],
    ] as const;

    for (const [nombre, espiar] of casos) {
      it(`listado, 503 y navegación que ${nombre}: muestra su error, deja de cargar y no deja problema`, async () => {
        espiar(TestBed.inject(Router));
        await abrirListado();
        http.expectOne('/api/salas').flush(SALAS);
        reservas()[0].flush(null, { status: 503, statusText: 'x' });
        await reposo();
        expect(location.path()).toBe('/reservas');
        expect(el().textContent).not.toContain('Cargando reservas');
        expect(el().querySelector('[role="alert"]')?.textContent).toContain('El servidor ha respondido con un error (503).');
        expect(TestBed.inject(UltimoErrorService).problema()).toBeUndefined();
      });

      it(`listado, 500 con ProblemDetail y navegación que ${nombre}: muestra su detalle y limpia el problema`, async () => {
        espiar(TestBed.inject(Router));
        await abrirListado();
        http.expectOne('/api/salas').flush(SALAS);
        reservas()[0].flush({ title: 'Error interno', status: 500, detail: 'Fallo X' }, { status: 500, statusText: 'x' });
        await reposo();
        expect(el().textContent).not.toContain('Cargando reservas');
        expect(el().querySelector('[role="alert"]')?.textContent).toContain('Fallo X');
        expect(TestBed.inject(UltimoErrorService).problema()).toBeUndefined();
      });

      it(`formulario, POST 503 y navegación que ${nombre}: quita «Guardando…», muestra su error y no deja problema`, async () => {
        espiar(TestBed.inject(Router));
        await harness.navigateByUrl('/reservas/nueva');
        harness.detectChanges();
        http.expectOne('/api/salas').flush(SALAS);
        harness.detectChanges();
        rellenarYEnviarForm();
        expect(el().textContent).toContain('Guardando…');
        http.expectOne('/api/reservas').flush(null, { status: 503, statusText: 'x' });
        await reposo();
        expect(location.path()).toBe('/reservas/nueva');
        expect(el().textContent).not.toContain('Guardando…');
        expect(el().querySelector('button[type="submit"]')?.textContent).toContain('Guardar reserva');
        expect(el().querySelector('[role="alert"]')?.textContent).toContain('El servidor ha respondido con un error (503).');
        expect(TestBed.inject(UltimoErrorService).problema()).toBeUndefined();
      });

      it(`formulario, POST 500 con ProblemDetail y navegación que ${nombre}: muestra su error y limpia el problema`, async () => {
        espiar(TestBed.inject(Router));
        await harness.navigateByUrl('/reservas/nueva');
        harness.detectChanges();
        http.expectOne('/api/salas').flush(SALAS);
        harness.detectChanges();
        rellenarYEnviarForm();
        http.expectOne('/api/reservas').flush({ title: 'Error interno', status: 500, detail: 'Fallo X' }, { status: 500, statusText: 'x' });
        await reposo();
        expect(el().textContent).not.toContain('Guardando…');
        expect(el().querySelector('[role="alert"]')?.textContent).toContain('Fallo X');
        expect(TestBed.inject(UltimoErrorService).problema()).toBeUndefined();
      });
    }
  });

  describe('limpieza del problema al salir de inesperado', () => {
    it('tras destruir InesperadoComponent, problema queda undefined y al volver sin error nuevo se ve el texto genérico', async () => {
      await harness.navigateByUrl('/reservas/nueva');
      http.expectOne('/api/salas');
      client.get('/api/x').subscribe();
      http.expectOne('/api/x').flush({ title: 'Error interno', status: 500, detail: 'Fallo X' }, { status: 500, statusText: 'x' });
      await reposo();
      expect(location.path()).toBe('/error/inesperado');
      expect(el().textContent).toContain('Fallo X');

      await harness.navigateByUrl('/reservas');
      http.match(() => true);
      expect(TestBed.inject(UltimoErrorService).problema()).toBeUndefined();

      await harness.navigateByUrl('/error/inesperado');
      await reposo();
      expect(el().querySelector('.error-general')).toBeNull();
      expect(el().textContent).not.toContain('Fallo X');
      expect(el().textContent).toContain('Se ha producido un error inesperado');
    });
  });
});
