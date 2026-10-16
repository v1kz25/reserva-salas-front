import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Reserva } from '../../../core/models/reserva.model';
import { SesionService } from '../../../core/services/sesion.service';
import { ReservaListComponent } from './reserva-list.component';
import { SOLO_INVITACIONES_PENDIENTES, descartarPeticionesDeFondo } from '../../../testing/peticiones-de-fondo';

@Component({ template: 'otra pantalla' })
class OtraComponent {}

const SALAS = [
  { id: 1, nombre: 'Sala Norte', capacidad: 10, planta: 1 },
  { id: 2, nombre: 'Sala Sur', capacidad: 4, planta: -1 },
];

const TAMANO = 20;

/** Genera `n` reservas del usuario 1 con ids consecutivos. */
function generar(n: number, desde = 1): Reserva[] {
  return Array.from({ length: n }, (_, i) => ({
    id: desde + i,
    salaId: 1,
    fecha: '2026-10-20',
    horaInicio: '09:00',
    horaFin: '10:00',
    detalle: 'COMPLETO',
    usuarioId: 1,
    responsable: 'Ana',
    motivo: `Motivo ${desde + i}`,
  }));
}

describe('ReservaListComponent: paginación', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let location: Location;
  let el: HTMLElement;
  /** Total de reservas que "tiene" el servidor falso. */
  let total: number;

  const reservasReqs = () => http.match((r) => r.url === '/api/reservas' && r.method === 'GET');

  /** Responde a una petición con la porción que le corresponde según `page` y `size`. */
  function responder(req: TestRequest): void {
    const page = Number(req.request.params.get('page'));
    const size = Number(req.request.params.get('size'));
    const totalPages = Math.ceil(total / size);
    const inicio = page * size;
    const restantes = Math.max(0, Math.min(size, total - inicio));
    req.flush({
      content: generar(restantes, inicio + 1),
      totalElements: total,
      totalPages,
      number: page,
      size,
    });
  }

  /** Atiende todas las peticiones de reservas pendientes y devuelve cuántas eran. */
  function atender(): TestRequest[] {
    const reqs = reservasReqs().filter((r) => !r.cancelled);
    reqs.forEach(responder);
    return reqs;
  }

  async function estable(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** Espera a que el router procese un popstate (lo difiere con un `setTimeout`). */
  async function historial(accion: () => void): Promise<void> {
    accion();
    await new Promise((r) => setTimeout(r));
    await estable();
  }

  async function abrir(url: string, totalReservas: number): Promise<TestRequest[]> {
    total = totalReservas;
    await harness.navigateByUrl(url, ReservaListComponent);
    http.expectOne('/api/salas').flush(SALAS);
    const reqs = atender();
    await estable();
    return reqs;
  }

  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('nav button')).find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;
  const nav = () => el.querySelector('nav[aria-label="Paginación de reservas"]');
  const estado = () => el.querySelector('.paginacion-estado')?.textContent?.trim();
  const filas = () => el.querySelectorAll('tbody tr').length;

  /** Pulsa un botón de paginación, atiende la petición resultante y devuelve sus parámetros. */
  async function pulsar(texto: string): Promise<TestRequest> {
    boton(texto).click();
    await estable();
    const reqs = reservasReqs();
    expect(reqs.length).withContext(`peticiones tras «${texto}»`).toBe(1);
    const req = reqs[0];
    responder(req);
    await estable();
    return req;
  }

  function elegirSala(texto: string): void {
    const select = el.querySelector('#filtro-sala') as HTMLSelectElement;
    const opcion = Array.from(select.options).find((o) => o.textContent?.includes(texto)) as HTMLOptionElement;
    select.value = opcion.value;
    select.dispatchEvent(new Event('change'));
  }

  function cambiarFecha(valor: string, id: string): void {
    const fecha = el.querySelector(`#${id}`) as HTMLInputElement;
    fecha.value = valor;
    fecha.dispatchEvent(new Event('input'));
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'reservas', component: ReservaListComponent },
          { path: 'otra', component: OtraComponent },
        ]),
        provideLocationMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SesionService).establecer({ id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' });
    http = TestBed.inject(HttpTestingController);
    location = TestBed.inject(Location);
    // El harness no hace la navegación inicial, y sin ella el router no escucha el historial.
    TestBed.inject(Router).setUpLocationChangeListener();
    harness = await RouterTestingHarness.create();
    el = harness.fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    descartarPeticionesDeFondo(http, SOLO_INVITACIONES_PENDIENTES);
    http.verify();
  });

  describe('navegación con 47 reservas', () => {
    it('la primera carga pide la página 0 con size 20 y muestra 20 filas', async () => {
      const reqs = await abrir('/reservas', 47);
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('0');
      expect(reqs[0].request.params.get('size')).toBe(String(TAMANO));
      expect(filas()).toBe(20);
      expect(estado()).toBe('Página 1 de 3 (47 reservas)');
    });

    it('Siguiente, Última, Anterior y Primera piden la página correcta y actualizan el texto', async () => {
      await abrir('/reservas', 47);

      let req = await pulsar('Siguiente');
      expect(req.request.params.get('page')).toBe('1');
      expect(estado()).toBe('Página 2 de 3 (47 reservas)');
      expect(location.path()).toBe('/reservas?page=2');

      req = await pulsar('Última');
      expect(req.request.params.get('page')).toBe('2');
      expect(estado()).toBe('Página 3 de 3 (47 reservas)');
      expect(filas()).toBe(7);
      expect(location.path()).toBe('/reservas?page=3');

      req = await pulsar('Anterior');
      expect(req.request.params.get('page')).toBe('1');
      expect(estado()).toBe('Página 2 de 3 (47 reservas)');

      req = await pulsar('Primera');
      expect(req.request.params.get('page')).toBe('0');
      expect(estado()).toBe('Página 1 de 3 (47 reservas)');
      // La página 1 no se escribe en la URL.
      expect(location.path()).toBe('/reservas');
    });

    it('en la primera página «Primera» y «Anterior» están desactivados y los otros no', async () => {
      await abrir('/reservas', 47);
      expect(boton('Primera').disabled).toBeTrue();
      expect(boton('Anterior').disabled).toBeTrue();
      expect(boton('Siguiente').disabled).toBeFalse();
      expect(boton('Última').disabled).toBeFalse();
    });

    it('en la página intermedia están todos activos', async () => {
      await abrir('/reservas?page=2', 47);
      for (const texto of ['Primera', 'Anterior', 'Siguiente', 'Última']) {
        expect(boton(texto).disabled).withContext(texto).toBeFalse();
      }
    });

    it('en la última página «Siguiente» y «Última» están desactivados y los otros no', async () => {
      await abrir('/reservas?page=3', 47);
      expect(boton('Siguiente').disabled).toBeTrue();
      expect(boton('Última').disabled).toBeTrue();
      expect(boton('Primera').disabled).toBeFalse();
      expect(boton('Anterior').disabled).toBeFalse();
    });

    it('el selector lista todas las páginas y «Ir» salta a la elegida', async () => {
      await abrir('/reservas', 47);
      const selector = el.querySelector('#paginacion-pagina') as HTMLSelectElement;
      expect(Array.from(selector.options).map((o) => o.textContent?.trim())).toEqual(['1', '2', '3']);
      expect(selector.value).toBe('0');

      selector.value = '2';
      selector.dispatchEvent(new Event('change'));
      const req = await pulsar('Ir');
      expect(req.request.params.get('page')).toBe('2');
      expect(estado()).toBe('Página 3 de 3 (47 reservas)');
      expect((el.querySelector('#paginacion-pagina') as HTMLSelectElement).value).toBe('2');
    });

    it('«Ir» con la página actual seleccionada no lanza ninguna petición', async () => {
      await abrir('/reservas', 47);
      boton('Ir').click();
      await estable();
      expect(reservasReqs().length).toBe(0);
    });

    it('al cambiar de página el foco va al caption de la tabla', async () => {
      await abrir('/reservas', 47);
      await pulsar('Siguiente');
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
      const caption = el.querySelector('caption') as HTMLElement;
      expect(caption).not.toBeNull();
      expect(document.activeElement).toBe(caption);
    });

    it('el texto de estado está en una región aria-live', async () => {
      await abrir('/reservas', 47);
      expect(el.querySelector('.paginacion-estado')?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('texto de estado y visibilidad del nav', () => {
    it('con una sola página no hay nav, pero sí el texto en plural', async () => {
      await abrir('/reservas', 5);
      expect(nav()).toBeNull();
      expect(estado()).toBe('Página 1 de 1 (5 reservas)');
    });

    it('exactamente 20 reservas: una página y sin nav', async () => {
      await abrir('/reservas', 20);
      expect(nav()).toBeNull();
      expect(filas()).toBe(20);
    });

    it('21 reservas: dos páginas y nav visible', async () => {
      await abrir('/reservas', 21);
      expect(nav()).not.toBeNull();
      expect(estado()).toBe('Página 1 de 2 (21 reservas)');
    });

    it('con una reserva el texto va en singular', async () => {
      await abrir('/reservas', 1);
      expect(estado()).toBe('Página 1 de 1 (1 reserva)');
      expect(nav()).toBeNull();
    });

    it('sin reservas no hay nav ni texto de estado', async () => {
      await abrir('/reservas', 0);
      expect(nav()).toBeNull();
      expect(estado()).toBe('');
      expect(el.textContent).toContain('No hay reservas');
    });
  });

  describe('filtros y paginación', () => {
    it('cambiar un filtro desde otra página vuelve a la página 1 (sin page en la URL)', async () => {
      await abrir('/reservas?page=3', 47);
      elegirSala('Sala Sur');
      await estable();
      const reqs = atender();
      await estable();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('0');
      expect(reqs[0].request.params.get('salaId')).toBe('2');
      expect(location.path()).toBe('/reservas?salaId=2');
    });

    it('cambiar un fecha también vuelve a la página 1', async () => {
      await abrir('/reservas?page=2', 47);
      cambiarFecha('2026-10-01', 'filtro-fecha-desde');
      await estable();
      const reqs = atender();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('0');
      expect(reqs[0].request.params.get('fechaDesde')).toBe('2026-10-01');
    });

    it('los filtros se conservan al paginar, también en la URL', async () => {
      await abrir('/reservas', 47);
      elegirSala('Sala Norte');
      cambiarFecha('2026-10-01', 'filtro-fecha-desde');
      cambiarFecha('2026-10-31', 'filtro-fecha-hasta');
      await estable();
      atender();
      await estable();

      const req = await pulsar('Siguiente');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('salaId')).toBe('1');
      expect(req.request.params.get('fechaDesde')).toBe('2026-10-01');
      expect(req.request.params.get('fechaHasta')).toBe('2026-10-31');
      const [ruta, query] = location.path().split('?');
      expect(ruta).toBe('/reservas');
      expect(Object.fromEntries(new URLSearchParams(query))).toEqual({
        page: '2',
        salaId: '1',
        fechaDesde: '2026-10-01',
        fechaHasta: '2026-10-31',
      });
    });

    it('con un rango de fechas inválido no se pide nada, ni siquiera desde otra página', async () => {
      await abrir('/reservas?page=2', 47);
      cambiarFecha('2026-10-10', 'filtro-fecha-desde');
      await estable();
      atender();
      await estable();
      cambiarFecha('2026-10-05', 'filtro-fecha-hasta');
      await estable();
      expect(reservasReqs().length).toBe(0);
      expect(el.querySelector('#filtro-fechas-error .error')?.textContent).toContain('no puede ser anterior');
      expect(el.textContent).not.toContain('Cargando reservas');
    });

    it('limpiar filtros vuelve a la página 1 sin filtros', async () => {
      await abrir('/reservas?page=2&salaId=1', 47);
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Limpiar')) as HTMLButtonElement).click();
      await estable();
      const reqs = atender();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('0');
      expect(reqs[0].request.params.has('salaId')).toBeFalse();
    });
  });

  describe('estado en la URL', () => {
    it('arranca desde ?page=3&salaId=1 pidiendo la página 2 (base 0) de la sala 1', async () => {
      const reqs = await abrir('/reservas?page=3&salaId=1', 47);
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('2');
      expect(reqs[0].request.params.get('salaId')).toBe('1');
      expect(estado()).toBe('Página 3 de 3 (47 reservas)');
      const select = el.querySelector('#filtro-sala') as HTMLSelectElement;
      expect(select.selectedOptions[0].textContent?.trim()).toBe('Sala Norte');
    });

    it('un page no válido se trata como la primera página', async () => {
      const reqs = await abrir('/reservas?page=abc', 47);
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('0');
    });

    it('?page=99 corrige a la última página con datos', async () => {
      total = 47;
      await harness.navigateByUrl('/reservas?page=99', ReservaListComponent);
      http.expectOne('/api/salas').flush(SALAS);
      const primera = reservasReqs();
      expect(primera.length).toBe(1);
      expect(primera[0].request.params.get('page')).toBe('98');
      responder(primera[0]);
      await estable();

      const segunda = reservasReqs();
      expect(segunda.length).toBe(1);
      expect(segunda[0].request.params.get('page')).toBe('2');
      responder(segunda[0]);
      await estable();

      expect(estado()).toBe('Página 3 de 3 (47 reservas)');
      expect(filas()).toBe(7);
      expect(location.path()).toBe('/reservas?page=3');
    });

    it('?page=99 sin ninguna reserva acaba en la primera página vacía', async () => {
      total = 0;
      await harness.navigateByUrl('/reservas?page=99', ReservaListComponent);
      http.expectOne('/api/salas').flush(SALAS);
      atender();
      await estable();
      const segunda = reservasReqs();
      expect(segunda.length).toBe(1);
      expect(segunda[0].request.params.get('page')).toBe('0');
      responder(segunda[0]);
      await estable();
      expect(el.textContent).toContain('No hay reservas');
      expect(location.path()).toBe('/reservas');
    });

    it('Atrás y Adelante del navegador restauran la página y vuelven a pedirla', async () => {
      await abrir('/reservas', 47);
      await pulsar('Siguiente');
      await pulsar('Siguiente');
      expect(estado()).toBe('Página 3 de 3 (47 reservas)');

      await historial(() => location.back());
      let reqs = reservasReqs();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('1');
      responder(reqs[0]);
      await estable();
      expect(estado()).toBe('Página 2 de 3 (47 reservas)');

      await historial(() => location.forward());
      reqs = reservasReqs();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('2');
      responder(reqs[0]);
      await estable();
      expect(estado()).toBe('Página 3 de 3 (47 reservas)');
    });

    it('Atrás tras un cambio de filtro restaura el filtro anterior', async () => {
      await abrir('/reservas?salaId=1', 47);
      await pulsar('Siguiente');
      await historial(() => location.back());
      const reqs = reservasReqs();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('0');
      expect(reqs[0].request.params.get('salaId')).toBe('1');
      responder(reqs[0]);
      await estable();
    });

    it('un cambio de filtro reemplaza la entrada del historial (Atrás no pasa por él)', async () => {
      await abrir('/reservas', 47);
      await pulsar('Siguiente');
      elegirSala('Sala Sur');
      await estable();
      atender();
      await estable();
      expect(location.path()).toBe('/reservas?salaId=2');
      await historial(() => location.back());
      // La entrada «?page=2» fue reemplazada: se vuelve a la lista sin filtros ni página.
      expect(location.path()).toBe('/reservas');
      atender();
      await estable();
    });

    it('las navegaciones propias no duplican la petición', async () => {
      await abrir('/reservas', 47);
      boton('Siguiente').click();
      await estable();
      expect(reservasReqs().length).toBe(1);
    });
  });

  describe('cancelar con paginación', () => {
    const dialogo = () => el.querySelector('dialog') as HTMLDialogElement;
    const botonDialogo = (texto: string) =>
      Array.from(el.querySelectorAll('dialog button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

    async function cancelarPrimeraFila(): Promise<void> {
      (el.querySelector('tbody tr button') as HTMLButtonElement).click();
      await estable();
      botonDialogo('Sí, cancelar').click();
      const del = http.expectOne((r) => r.method === 'DELETE');
      total -= 1;
      del.flush(null, { status: 204, statusText: 'No Content' });
      await estable();
    }

    beforeEach(() => {
      document.body.appendChild(el);
    });

    it('la recarga silenciosa tras cancelar mantiene la página y no muestra «Cargando»', async () => {
      await abrir('/reservas?page=2', 47);
      await cancelarPrimeraFila();
      expect(el.textContent).not.toContain('Cargando reservas');
      const reqs = reservasReqs();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('1');
      responder(reqs[0]);
      await estable();
      expect(estado()).toBe('Página 2 de 3 (46 reservas)');
      expect(location.path()).toBe('/reservas?page=2');
      expect(dialogo().open).toBeFalse();
    });

    it('cancelar la única reserva de la última página retrocede a la anterior', async () => {
      await abrir('/reservas?page=3', 41);
      expect(filas()).toBe(1);
      await cancelarPrimeraFila();

      // La recarga a la página 3 llega vacía (ya solo hay 2 páginas) y se retrocede.
      let reqs = reservasReqs();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('2');
      responder(reqs[0]);
      await estable();
      expect(el.textContent).not.toContain('Cargando reservas');

      reqs = reservasReqs();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('1');
      responder(reqs[0]);
      await estable();

      expect(estado()).toBe('Página 2 de 2 (40 reservas)');
      expect(filas()).toBe(20);
      expect(location.path()).toBe('/reservas?page=2');
      expect(el.querySelector('.exito')?.textContent).toContain('Reserva cancelada');
    });

    it('cancelar la última reserva que queda deja el listado vacío en la primera página', async () => {
      await abrir('/reservas', 1);
      await cancelarPrimeraFila();
      const reqs = reservasReqs();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('page')).toBe('0');
      responder(reqs[0]);
      await estable();
      expect(el.textContent).toContain('No hay reservas');
      expect(nav()).toBeNull();
    });
  });

  describe('errores', () => {
    it('un error al cambiar de página deja el foco en el h1 y oculta el nav', async () => {
      await abrir('/reservas', 47);
      boton('Siguiente').click();
      await estable();
      const reqs = reservasReqs();
      expect(reqs.length).toBe(1);
      reqs[0].flush(null, { status: 0, statusText: '' });
      await estable();
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));

      expect(el.querySelector('p.error')?.textContent).toContain('No se ha podido conectar');
      expect(el.querySelector('table')).toBeNull();
      expect(nav()).toBeNull();
      expect(document.activeElement).toBe(el.querySelector('h1#titulo-reservas'));
    });

    it('tras el error, cambiar un filtro vuelve a listar desde la página 1', async () => {
      await abrir('/reservas?page=2', 47);
      // Fuerza un error en la recarga mediante un cambio de filtro y luego lo corrige.
      elegirSala('Sala Sur');
      await estable();
      reservasReqs()[0].flush(null, { status: 0, statusText: '' });
      await estable();
      expect(el.querySelector('p.error')).not.toBeNull();
      elegirSala('Sala Norte');
      await estable();
      const reqs = atender();
      await estable();
      expect(reqs[0].request.params.get('page')).toBe('0');
      expect(el.querySelector('p.error')).toBeNull();
    });
  });
});
