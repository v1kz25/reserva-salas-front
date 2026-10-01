import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { erroresInterceptor } from './errores.interceptor';
import { UltimoErrorService } from './ultimo-error.service';

describe('erroresInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let router: Router;
  let navigate: jasmine.Spy;
  let url: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigate = spyOn(router, 'navigate').and.resolveTo(true);
    url = spyOnProperty(router, 'url').and.returnValue('/reservas?salaId=1');
  });

  afterEach(() => controller.verify());

  /** Lanza una petición y devuelve lo que ha recibido el suscriptor. */
  function pedir(): { error?: unknown; completa: boolean } {
    const resultado: { error?: unknown; completa: boolean } = { completa: false };
    http.get('/api/reservas').subscribe({
      error: (e: unknown) => (resultado.error = e),
      complete: () => (resultado.completa = true),
    });
    return resultado;
  }

  it('status 0 redirige a no-disponible con la URL de origen y no propaga el error', async () => {
    const r = pedir();
    controller.expectOne('/api/reservas').error(new ProgressEvent('error'));
    await navigate.calls.mostRecent().returnValue;
    expect(navigate).toHaveBeenCalledWith(['/error/no-disponible'], {
      queryParams: { returnUrl: '/reservas?salaId=1' },
    });
    expect(r.error).toBeUndefined();
    expect(r.completa).toBeTrue();
  });

  for (const status of [502, 503, 504]) {
    it(`${status} redirige a no-disponible aunque traiga ProblemDetail`, () => {
      pedir();
      controller.expectOne('/api/reservas').flush({ title: 'X', status }, { status, statusText: 'X' });
      expect(navigate.calls.mostRecent().args[0]).toEqual(['/error/no-disponible']);
    });
  }

  it('500 sin ProblemDetail (proxy con el back parado) redirige a no-disponible', () => {
    pedir();
    controller
      .expectOne('/api/reservas')
      .flush('Error occurred while trying to proxy', { status: 500, statusText: 'Internal Server Error' });
    expect(navigate.calls.mostRecent().args[0]).toEqual(['/error/no-disponible']);
  });

  it('500 con ProblemDetail redirige a inesperado y guarda el problema', () => {
    pedir();
    const problema = { title: 'Error interno', status: 500, detail: 'Algo ha fallado' };
    controller.expectOne('/api/reservas').flush(problema, { status: 500, statusText: 'Internal Server Error' });
    expect(navigate).toHaveBeenCalledWith(['/error/inesperado'], {});
    expect(TestBed.inject(UltimoErrorService).problema()).toEqual(problema);
  });

  it('403 redirige a sin-permiso', () => {
    pedir();
    controller.expectOne('/api/reservas').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(navigate).toHaveBeenCalledWith(['/error/sin-permiso'], {});
  });

  for (const status of [400, 404, 409]) {
    it(`${status} no redirige y propaga el error al componente`, () => {
      const r = pedir();
      controller.expectOne('/api/reservas').flush({ title: 'X', status }, { status, statusText: 'X' });
      expect(navigate).not.toHaveBeenCalled();
      expect(r.error).toBeDefined();
    });
  }

  it('si ya se está en una página de error no vuelve a redirigir', () => {
    url.and.returnValue('/error/no-disponible?returnUrl=%2Freservas');
    const r = pedir();
    controller.expectOne('/api/reservas').error(new ProgressEvent('error'));
    expect(navigate).not.toHaveBeenCalled();
    expect(r.error).toBeUndefined();
  });

  describe('si la navegación a la página de error no se completa', () => {
    const problema = { title: 'Error interno', status: 500, detail: 'Fallo X' };

    for (const [nombre, preparar] of [
      ['resuelve false', () => navigate.and.resolveTo(false)],
      ['rechaza', () => navigate.and.rejectWith(new Error('navegación fallida'))],
    ] as const) {
      it(`${nombre}: propaga el error HTTP original y limpia el problema (500 con ProblemDetail)`, async () => {
        preparar();
        const r = pedir();
        controller.expectOne('/api/reservas').flush(problema, { status: 500, statusText: 'x' });
        await navigate.calls.mostRecent().returnValue.catch(() => undefined);
        expect(r.error).toBeInstanceOf(HttpErrorResponse);
        expect((r.error as HttpErrorResponse).status).toBe(500);
        expect((r.error as HttpErrorResponse).error).toEqual(problema);
        expect(r.completa).toBeFalse();
        expect(TestBed.inject(UltimoErrorService).problema()).toBeUndefined();
      });

      it(`${nombre}: propaga el error original en status 0 y en 403`, async () => {
        preparar();
        const r0 = pedir();
        controller.expectOne('/api/reservas').error(new ProgressEvent('error'));
        await navigate.calls.mostRecent().returnValue.catch(() => undefined);
        expect((r0.error as HttpErrorResponse).status).toBe(0);

        const r403 = pedir();
        controller.expectOne('/api/reservas').flush(null, { status: 403, statusText: 'Forbidden' });
        await navigate.calls.mostRecent().returnValue.catch(() => undefined);
        expect((r403.error as HttpErrorResponse).status).toBe(403);
      });
    }

    it('si la navegación se completa, la petición termina sin error y el problema se conserva', async () => {
      const r = pedir();
      controller.expectOne('/api/reservas').flush(problema, { status: 500, statusText: 'x' });
      await navigate.calls.mostRecent().returnValue;
      expect(r.error).toBeUndefined();
      expect(r.completa).toBeTrue();
      expect(TestBed.inject(UltimoErrorService).problema()).toEqual(problema);
    });
  });
});
