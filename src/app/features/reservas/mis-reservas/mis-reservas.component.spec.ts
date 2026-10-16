import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Reserva, RolMisReservas } from '../../../core/models/reserva.model';
import { CLAVE_INVITACIONES_VISTAS } from '../../../core/services/invitaciones.service';
import { SesionService } from '../../../core/services/sesion.service';
import { AVISO_INVITACION_ACEPTADA } from '../../invitaciones/invitaciones-mensajes';
import { MisReservasComponent } from './mis-reservas.component';

const SALAS = [{ id: 1, nombre: 'Sala Norte', capacidad: 10, planta: 1 }];
const PENDIENTES = '/api/invitaciones/pendientes';
const ANA = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' as const };

const reserva = (id: number, usuarioId: number, extra: Partial<Reserva> = {}): Reserva => ({
  id,
  salaId: 1,
  fecha: '2026-10-20',
  horaInicio: '09:00',
  horaFin: '10:00',
  detalle: 'COMPLETO',
  usuarioId,
  responsable: usuarioId === 1 ? 'Ana' : 'Luis',
  motivo: `Motivo ${id}`,
  ...extra,
});

/** Reserva ajena con la invitación pendiente `invitacionId` del usuario. */
const pendiente = (id: number, invitacionId: number): Reserva =>
  reserva(id, 2, { miInvitacion: { id: invitacionId, estado: 'PENDIENTE' } });

const propias = (n: number, desde = 100): Reserva[] => Array.from({ length: n }, (_, i) => reserva(desde + i, 1));

/** Página del servidor; `total` es el `totalElements` declarado. */
const pagina = (content: Reserva[], number = 0, total = content.length, size = 20) => ({
  content,
  totalElements: total,
  totalPages: Math.ceil(total / size),
  number,
  size,
});

/** Totales por rol con los que se responde a los recuentos (`size=1`). */
type Totales = Record<RolMisReservas, number>;
const TOTALES: Totales = { ORGANIZADA: 2, INVITADO: 1, PENDIENTE: 1 };

describe('MisReservasComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;
  let el: HTMLElement;

  const esPagina = (r: { url: string; params: { get(k: string): string | null } }) =>
    r.url === '/api/reservas' && r.params.get('mis') === 'true' && r.params.get('size') === '20';
  const esRecuento = (r: { url: string; params: { get(k: string): string | null } }) =>
    r.url === '/api/reservas' && r.params.get('mis') === 'true' && r.params.get('size') === '1';

  /** Petición de la página visible. */
  const peticionPagina = (): TestRequest => http.expectOne((r) => esPagina(r));

  /** Responde a los recuentos abiertos y devuelve los roles que se han contado. */
  function responderRecuentos(totales: Totales = TOTALES): string[] {
    return http.match((r) => esRecuento(r)).map((req) => {
      const rol = req.request.params.get('rol') as RolMisReservas;
      req.flush(pagina([], 0, totales[rol], 1));
      return rol;
    });
  }

  async function crear(url: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'mis-reservas', component: MisReservasComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SesionService).establecer(ANA);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    el = harness.routeNativeElement as HTMLElement;
  }

  /** Abre la pantalla y responde a la carga: salas, la página visible y los recuentos. */
  async function abrir(url: string, contenido: Reserva[], total = contenido.length, number = 0): Promise<void> {
    await crear(url);
    http.expectOne('/api/salas').flush(SALAS);
    peticionPagina().flush(pagina(contenido, number, total));
    responderRecuentos();
    harness.detectChanges();
  }

  afterEach(() => {
    http.match(PENDIENTES);
    http.verify();
    localStorage.clear();
  });

  beforeEach(() => localStorage.clear());

  const pestanas = () => Array.from(el.querySelectorAll('nav.pestanas a')) as HTMLAnchorElement[];
  const pestana = (texto: string) => pestanas().find((a) => a.textContent?.trim().startsWith(texto)) as HTMLAnchorElement;
  const actual = () => pestanas().filter((a) => a.getAttribute('aria-current') === 'page');
  const filas = () => Array.from(el.querySelectorAll('tbody tr'));
  const boton = (txt: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(txt)) as HTMLButtonElement;

  async function pulsar(elemento: HTMLElement): Promise<void> {
    elemento.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  describe('pestañas', () => {
    it('por defecto está activa «Organizadas», con aria-current', async () => {
      await abrir('/mis-reservas', [reserva(1, 1)]);
      expect(actual().length).toBe(1);
      expect(actual()[0].textContent).toContain('Organizadas');
      expect(pestana('Invitado').hasAttribute('aria-current')).toBeFalse();
    });

    it('son enlaces dentro de una navegación etiquetada', async () => {
      await abrir('/mis-reservas', []);
      expect(el.querySelector('nav.pestanas')?.getAttribute('aria-label')).toBeTruthy();
      expect(pestanas().map((a) => a.textContent?.replace(/\s+/g, ' ').trim().replace(/ \(\d+\)/, ''))).toEqual([
        'Organizadas',
        'Invitado',
        'Pendientes por responder',
      ]);
    });

    it('una vista inválida cae en «Organizadas»', async () => {
      await abrir('/mis-reservas?vista=otra', []);
      expect(actual()[0].textContent).toContain('Organizadas');
    });

    it('pulsar una pestaña cambia la URL (?vista=), mueve aria-current y pide su página', async () => {
      await abrir('/mis-reservas', [reserva(1, 1)]);
      await pulsar(pestana('Invitado'));
      expect(router.url).toBe('/mis-reservas?vista=invitado');
      const req = peticionPagina();
      expect(req.request.params.get('rol')).toBe('INVITADO');
      req.flush(pagina([reserva(3, 2)]));
      harness.detectChanges();
      expect(actual()[0].textContent).toContain('Invitado');
      expect(filas().length).toBe(1);
      // Cambiar de pestaña no repite los recuentos.
      expect(http.match((r) => esRecuento(r)).length).toBe(0);
    });
  });

  describe('una petición por pestaña', () => {
    for (const [vista, rol] of [
      ['', 'ORGANIZADA'],
      ['?vista=invitado', 'INVITADO'],
      ['?vista=pendientes', 'PENDIENTE'],
    ] as const) {
      it(`/mis-reservas${vista} pide mis=true&rol=${rol}, página 0 de 20`, async () => {
        await crear(`/mis-reservas${vista}`);
        http.expectOne('/api/salas').flush(SALAS);
        const req = peticionPagina();
        expect(req.request.params.get('rol')).toBe(rol);
        expect(req.request.params.get('page')).toBe('0');
        req.flush(pagina([]));
        responderRecuentos();
      });
    }

    it('«Invitado» muestra la columna Organizador', async () => {
      await abrir('/mis-reservas?vista=invitado', [reserva(3, 2)]);
      expect(el.querySelector('thead')?.textContent).toContain('Organizador');
      expect(filas()[0].textContent).toContain('Luis');
    });

    it('cada fila tiene un enlace «Ver» a su detalle', async () => {
      await abrir('/mis-reservas', [reserva(1, 1)]);
      expect(filas()[0].querySelector('a')?.getAttribute('href')).toBe('/reservas/1');
    });

    it('sin reservas organizadas lo dice y ofrece crear una', async () => {
      await abrir('/mis-reservas', []);
      expect(el.textContent).toContain('No organizas ninguna reserva');
      expect(el.querySelector('p a[href="/reservas/nueva"]')).not.toBeNull();
    });

    it('sin invitaciones aceptadas lo dice', async () => {
      await abrir('/mis-reservas?vista=invitado', []);
      expect(el.textContent).toContain('No has aceptado ninguna invitación');
    });
  });

  describe('contadores', () => {
    it('la pestaña visible usa el totalElements de su página y las otras dos se cuentan con size=1', async () => {
      await crear('/mis-reservas');
      http.expectOne('/api/salas').flush(SALAS);
      peticionPagina().flush(pagina(propias(20), 0, 45));
      expect(responderRecuentos().sort()).toEqual(['INVITADO', 'PENDIENTE']);
      harness.detectChanges();
      expect(pestana('Organizadas').textContent).toContain('(45)');
      expect(pestana('Invitado').textContent).toContain('(1)');
      expect(pestana('Pendientes').textContent).toContain('(1)');
    });

    it('si falla un recuento, esa pestaña queda sin número y la pantalla funciona', async () => {
      await crear('/mis-reservas');
      http.expectOne('/api/salas').flush(SALAS);
      peticionPagina().flush(pagina([reserva(1, 1)]));
      const recuentos = http.match((r) => esRecuento(r));
      recuentos[0].flush(null, { status: 500, statusText: 'Server Error' });
      recuentos[1].flush(pagina([], 0, 3, 1));
      harness.detectChanges();
      expect(filas().length).toBe(1);
      const sinNumero = pestanas().filter((a) => !/\(\d+\)/.test(a.textContent ?? ''));
      expect(sinNumero.length).toBe(1);
    });
  });

  describe('carga', () => {
    it('muestra «Cargando reservas…» hasta recibirlas', async () => {
      await crear('/mis-reservas');
      harness.detectChanges();
      expect(el.textContent).toContain('Cargando reservas');
      http.expectOne('/api/salas').flush(SALAS);
      peticionPagina().flush(pagina([]));
      responderRecuentos();
    });

    it('un error al cargar lo muestra', async () => {
      await crear('/mis-reservas');
      http.expectOne('/api/salas').flush(SALAS);
      peticionPagina().flush({ title: 'Error', status: 400, detail: 'Fallo de datos' }, { status: 400, statusText: 'Bad Request' });
      responderRecuentos();
      harness.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Fallo de datos');
    });

    it('no hay aviso de lista incompleta', async () => {
      await abrir('/mis-reservas', propias(20), 5000);
      expect(el.textContent).not.toContain('Solo se muestran');
    });
  });

  describe('paginación en el servidor', () => {
    it('con 45 organizadas muestra «Página 1 de 3 (45 reservas)»', async () => {
      await abrir('/mis-reservas', propias(20), 45);
      expect(filas().length).toBe(20);
      expect(el.querySelector('.paginacion-estado')?.textContent).toContain('Página 1 de 3 (45 reservas)');
      expect(boton('Anterior').disabled).toBeTrue();
      expect(boton('Siguiente').disabled).toBeFalse();
    });

    it('«Siguiente» va a ?page=2 y pide la página 1 de la pestaña; «Anterior» vuelve sin page', async () => {
      await abrir('/mis-reservas', propias(20), 45);
      await pulsar(boton('Siguiente'));
      expect(router.url).toBe('/mis-reservas?page=2');
      let req = peticionPagina();
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('rol')).toBe('ORGANIZADA');
      req.flush(pagina(propias(20, 120), 1, 45));
      harness.detectChanges();
      expect(filas()[0].textContent).toContain('Motivo 120');
      expect(el.querySelector('.paginacion-estado')?.textContent).toContain('Página 2 de 3');
      await pulsar(boton('Anterior'));
      expect(router.url).toBe('/mis-reservas');
      req = peticionPagina();
      expect(req.request.params.get('page')).toBe('0');
      req.flush(pagina(propias(20), 0, 45));
    });

    it('?page=3 pide la página 2 (base 0)', async () => {
      await crear('/mis-reservas?vista=invitado&page=3');
      http.expectOne('/api/salas').flush(SALAS);
      const req = peticionPagina();
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('rol')).toBe('INVITADO');
      req.flush(pagina(propias(5), 2, 45));
      responderRecuentos();
    });

    it('una página vacía fuera de rango retrocede a la última con datos', async () => {
      await crear('/mis-reservas?page=99');
      http.expectOne('/api/salas').flush(SALAS);
      peticionPagina().flush(pagina([], 98, 45));
      responderRecuentos();
      await harness.fixture.whenStable();
      expect(router.url).toBe('/mis-reservas?page=3');
      const req = peticionPagina();
      expect(req.request.params.get('page')).toBe('2');
      req.flush(pagina(propias(5), 2, 45));
      harness.detectChanges();
      expect(filas().length).toBe(5);
    });

    it('una página no válida (texto) cae en la primera', async () => {
      await crear('/mis-reservas?page=abc');
      http.expectOne('/api/salas').flush(SALAS);
      const req = peticionPagina();
      expect(req.request.params.get('page')).toBe('0');
      req.flush(pagina([]));
      responderRecuentos();
    });

    it('con una sola página no hay controles de paginación', async () => {
      await abrir('/mis-reservas', propias(20), 20);
      expect(el.querySelector('nav[aria-label="Paginación de mis reservas"]')).toBeNull();
      expect(el.querySelector('.paginacion-estado')?.textContent).toContain('Página 1 de 1 (20 reservas)');
    });

    it('con una sola reserva el estado va en singular', async () => {
      await abrir('/mis-reservas', propias(1));
      expect(el.querySelector('.paginacion-estado')?.textContent).toContain('(1 reserva)');
    });
  });

  describe('Pendientes por responder (rol=PENDIENTE)', () => {
    it('muestra las invitaciones de la página, no la tabla, y no pide /pendientes por su cuenta', async () => {
      await abrir('/mis-reservas?vista=pendientes', [pendiente(4, 40)]);
      expect(el.querySelector('table')).toBeNull();
      expect(el.querySelector('h2')?.textContent).toContain('Pendientes de responder');
      expect(el.querySelector('section.bloque li')?.textContent).toContain('Motivo 4');
      // Solo el recuento de la cabecera (sesión), no una carga propia de la sección.
      expect(http.match(PENDIENTES).length).toBeLessThanOrEqual(1);
    });

    it('las no vistas se marcan con el texto «Nueva» y se guardan como vistas sin olvidar las de otras páginas', async () => {
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`, '[99]');
      await abrir('/mis-reservas?vista=pendientes', [pendiente(4, 40)]);
      expect(el.querySelector('.marca-nueva')?.textContent).toContain('Nueva');
      const guardado = JSON.parse(localStorage.getItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`) ?? '[]') as number[];
      expect(guardado.sort()).toEqual([40, 99]);
    });

    it('las ya vistas no llevan marca', async () => {
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`, '[40]');
      await abrir('/mis-reservas?vista=pendientes', [pendiente(4, 40), pendiente(5, 41)]);
      const items = Array.from(el.querySelectorAll('section.bloque li'));
      expect(items.filter((f) => f.querySelector('.marca-nueva')).length).toBe(1);
      expect(items.find((f) => f.querySelector('.marca-nueva'))?.textContent).toContain('Motivo 5');
    });

    it('aceptar usa miInvitacion.id, avisa y recarga en silencio solo la página visible y los otros contadores', async () => {
      await abrir('/mis-reservas?vista=pendientes', [pendiente(4, 40)]);
      boton('Aceptar').click();
      const post = http.expectOne('/api/invitaciones/40/aceptar');
      expect(post.request.method).toBe('POST');
      post.flush(null, { status: 204, statusText: 'No Content' });
      harness.detectChanges();
      expect(el.textContent).not.toContain('Cargando reservas');
      const req = peticionPagina();
      expect(req.request.params.get('rol')).toBe('PENDIENTE');
      req.flush(pagina([]));
      expect(responderRecuentos({ ORGANIZADA: 2, INVITADO: 2, PENDIENTE: 0 }).sort()).toEqual([
        'INVITADO',
        'ORGANIZADA',
      ]);
      harness.detectChanges();
      expect(el.textContent).toContain(AVISO_INVITACION_ACEPTADA);
      expect(pestana('Invitado').textContent).toContain('(2)');
      expect(pestana('Pendientes').textContent).toContain('(0)');
      expect(el.textContent).toContain('No tienes invitaciones pendientes');
    });

    it('tras paginar, el foco va al título de la lista de pendientes', async () => {
      const pagina0 = Array.from({ length: 20 }, (_, i) => pendiente(200 + i, 500 + i));
      await abrir('/mis-reservas?vista=pendientes', pagina0, 25);
      document.body.appendChild(harness.fixture.nativeElement as HTMLElement);
      await pulsar(boton('Siguiente'));
      const req = peticionPagina();
      expect(req.request.params.get('rol')).toBe('PENDIENTE');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pagina([pendiente(300, 600)], 1, 25));
      harness.detectChanges();
      await harness.fixture.whenStable();
      expect(document.activeElement?.id).toBe('titulo-invitaciones-pendientes');
      (harness.fixture.nativeElement as HTMLElement).remove();
    });

    it('rechazar usa miInvitacion.id', async () => {
      await abrir('/mis-reservas?vista=pendientes', [pendiente(4, 40)]);
      boton('Rechazar').click();
      http.expectOne('/api/invitaciones/40/rechazar').flush(null, { status: 204, statusText: 'No Content' });
      peticionPagina().flush(pagina([]));
      responderRecuentos();
    });

    it('si falla la recarga silenciosa conserva los datos y avisa', async () => {
      await abrir('/mis-reservas?vista=pendientes', [pendiente(4, 40), pendiente(5, 41)]);
      boton('Aceptar').click();
      http.expectOne('/api/invitaciones/40/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      peticionPagina().flush(null, { status: 400, statusText: 'Bad Request' });
      responderRecuentos();
      harness.detectChanges();
      expect(el.querySelector('.aviso')?.textContent).toContain('No se han podido actualizar tus reservas');
      expect(el.querySelectorAll('section.bloque li').length).toBe(1);
    });
  });
});
