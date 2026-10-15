import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { UltimoErrorService } from '../../core/http/ultimo-error.service';

describe('páginas de error', () => {
  let harness: RouterTestingHarness;
  let location: Location;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    harness = await RouterTestingHarness.create();
    location = TestBed.inject(Location);
  });

  async function ir(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    await harness.fixture.whenStable();
    el = harness.routeNativeElement as HTMLElement;
  }

  const h1 = () => el.querySelector('h1') as HTMLElement;
  const boton = () => el.querySelector('button') as HTMLButtonElement;

  describe('comunes', () => {
    for (const [url, titulo] of [
      ['/error/no-disponible', 'Servicio no disponible'],
      ['/error/inesperado', 'Error inesperado'],
      ['/error/sin-permiso', 'Sin permiso'],
      ['/no-encontrado', 'Página no encontrada'],
      ['/ruta/que/no/existe', 'Página no encontrada'],
    ]) {
      it(`${url}: renderiza un único h1 «${titulo}», lo enlaza con aria-labelledby y le da el foco`, async () => {
        await ir(url);
        expect(el.querySelectorAll('h1').length).toBe(1);
        expect(h1().textContent?.trim()).toBe(titulo);
        const seccion = el.querySelector('section') as HTMLElement;
        expect(seccion.getAttribute('aria-labelledby')).toBe(h1().id);
        expect(document.activeElement).toBe(h1());
      });

      it(`${url}: el título de la pestaña es «${titulo}»`, async () => {
        await ir(url);
        expect(document.title).toBe(titulo);
      });
    }

    it('los títulos de pestaña de las cuatro páginas son únicos salvo no-encontrado, que comparte con la comodín', async () => {
      const titulos: string[] = [];
      for (const url of ['/error/no-disponible', '/error/inesperado', '/error/sin-permiso', '/no-encontrado']) {
        await ir(url);
        titulos.push(document.title);
      }
      expect(new Set(titulos).size).toBe(4);
    });
  });

  describe('no-disponible', () => {
    it('muestra un botón «Reintentar» (rol button) y ningún enlace', async () => {
      await ir('/error/no-disponible');
      expect(boton().textContent?.trim()).toBe('Reintentar');
      expect(boton().type).toBe('button');
      expect(el.querySelector('a')).toBeNull();
    });

    it('«Reintentar» vuelve a la returnUrl válida, con su query', async () => {
      await ir('/error/no-disponible?returnUrl=%2Freservas%2Fnueva%3Fx%3D1');
      boton().click();
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/reservas/nueva?x=1');
    });

    it('sin returnUrl, «Reintentar» va a /reservas', async () => {
      await ir('/error/no-disponible');
      boton().click();
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/reservas');
    });

    it('returnUrl vacía, «Reintentar» va a /reservas', async () => {
      await ir('/error/no-disponible?returnUrl=');
      boton().click();
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/reservas');
    });

    for (const maliciosa of [
      '//evil.com',
      '/\\evil.com',
      '\\\\evil.com',
      'https://evil.com',
      'http://evil.com/reservas',
      'javascript:alert(1)',
      '/error/no-disponible',
      '/error/inesperado?returnUrl=%2Freservas',
      '/no-encontrado',
      '/reservas\r\nSet-Cookie:x=1',
      'reservas',
    ]) {
      it(`returnUrl maliciosa «${maliciosa.replace(/[\r\n]/g, ' ')}»: «Reintentar» va a /reservas y no sale de la app`, async () => {
        await ir(`/error/no-disponible?returnUrl=${encodeURIComponent(maliciosa)}`);
        boton().click();
        await harness.fixture.whenStable();
        expect(location.path()).toBe('/reservas');
      });
    }

    it('returnUrl repetida: se usa la primera (válida) y se descarta la segunda maliciosa', async () => {
      await ir('/error/no-disponible?returnUrl=%2Freservas%2Fnueva&returnUrl=%2F%2Fevil.com');
      boton().click();
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/reservas/nueva');
    });
  });

  describe('inesperado', () => {
    it('muestra título y detalle del último ProblemDetail', async () => {
      TestBed.inject(UltimoErrorService).problema.set({ title: 'Error interno', status: 500, detail: 'Algo ha fallado' });
      await ir('/error/inesperado');
      expect(el.textContent).toContain('Error interno');
      expect(el.textContent).toContain('Algo ha fallado');
    });

    it('sin detalle muestra solo el título', async () => {
      TestBed.inject(UltimoErrorService).problema.set({ title: 'Error interno', status: 500 });
      await ir('/error/inesperado');
      expect(el.textContent).toContain('Error interno');
      expect(el.querySelectorAll('.error-general p').length).toBe(1);
    });

    it('tras recargar (sin problema guardado) muestra el mensaje genérico', async () => {
      await ir('/error/inesperado');
      expect(el.querySelector('.error-general')).toBeNull();
      expect(el.textContent).toContain('Se ha producido un error inesperado');
    });

    it('escapa el HTML del detalle (no se interpreta)', async () => {
      TestBed.inject(UltimoErrorService).problema.set({
        title: '<img src=x onerror=alert(1)>',
        status: 500,
        detail: '<b>negrita</b>',
      });
      await ir('/error/inesperado');
      expect(el.querySelector('.error-general img')).toBeNull();
      expect(el.querySelector('.error-general b')).toBeNull();
    });

    it('ofrece un enlace a /reservas y navega al pulsarlo', async () => {
      await ir('/error/inesperado');
      const enlace = el.querySelector('a') as HTMLAnchorElement;
      expect(enlace.getAttribute('href')).toBe('/reservas');
      enlace.click();
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/reservas');
    });
  });

  describe('sin-permiso', () => {
    it('mensaje genérico, sin detalles del servidor, y enlace a /reservas', async () => {
      TestBed.inject(UltimoErrorService).problema.set({ title: 'Secreto', status: 403, detail: 'detalle interno' });
      await ir('/error/sin-permiso');
      expect(el.textContent).not.toContain('Secreto');
      expect(el.textContent).not.toContain('detalle interno');
      const enlace = el.querySelector('a') as HTMLAnchorElement;
      expect(enlace.getAttribute('href')).toBe('/reservas');
      enlace.click();
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/reservas');
    });
  });

  describe('no-encontrado', () => {
    it('enlace a /reservas y no redirige solo', async () => {
      await ir('/no-encontrado');
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/no-encontrado');
      expect((el.querySelector('a') as HTMLAnchorElement).getAttribute('href')).toBe('/reservas');
    });

    it('la comodín conserva la URL (con query y fragmento) y no redirige', async () => {
      await ir('/algo/raro?x=1#f');
      await harness.fixture.whenStable();
      expect(location.path(true)).toBe('/algo/raro?x=1#f');
      expect(h1().textContent?.trim()).toBe('Página no encontrada');
    });

    it('/error (sin sufijo) cae en la comodín', async () => {
      await ir('/error');
      expect(h1().textContent?.trim()).toBe('Página no encontrada');
    });

    it('/error/no-disponible/extra cae en la comodín', async () => {
      await ir('/error/no-disponible/extra');
      expect(h1().textContent?.trim()).toBe('Página no encontrada');
    });

    it('el enlace navega a /reservas', async () => {
      await ir('/no-encontrado');
      (el.querySelector('a') as HTMLAnchorElement).click();
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/reservas');
    });
  });
});
