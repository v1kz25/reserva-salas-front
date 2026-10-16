import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InvitacionRecibida } from '../../../core/models/invitacion.model';
import { Usuario } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { AVISO_INVITACION_ACEPTADA, AVISO_INVITACION_RECHAZADA } from '../../invitaciones/invitaciones-mensajes';
import { ReservaListComponent } from './reserva-list.component';

const SALAS = [{ id: 1, nombre: 'Sala Norte', capacidad: 10, planta: 1 }];
const PENDIENTES = '/api/invitaciones/pendientes';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const ADMIN: Usuario = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

const PROPIA = { id: 10, salaId: 1, fecha: '2026-10-05', horaInicio: '09:00', horaFin: '10:00', detalle: 'COMPLETO', usuarioId: 1, responsable: 'Ana', motivo: 'Daily' };
const OCUPADA = { id: 12, salaId: 1, fecha: '2026-10-07', horaInicio: '15:00', horaFin: '16:00', detalle: 'OCUPADA' };

const recibida = (id: number): InvitacionRecibida => ({
  id,
  reserva: { id: 50 + id, salaId: 1, fecha: '2026-10-20', horaInicio: '11:00', horaFin: '12:00', detalle: 'COMPLETO', usuarioId: 2, responsable: 'Luis', motivo: 'Planificación' },
});

const pagina = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0, number: 0, size: 20 });

describe('ReservaListComponent: invitaciones y reservas ocupadas', () => {
  let fixture: ComponentFixture<ReservaListComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  function crear(usuario: Usuario, reservas: unknown[], pendientes: InvitacionRecibida[] = []): void {
    TestBed.configureTestingModule({
      imports: [ReservaListComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(SesionService).establecer(usuario);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReservaListComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/salas').flush(SALAS);
    http.expectOne((r) => r.url === '/api/reservas').flush(pagina(reservas));
    flushPendientes(pendientes);
    fixture.detectChanges();
  }

  /** Responde a todas las peticiones de pendientes abiertas (recuento de cabecera y de la sección). */
  function flushPendientes(pendientes: InvitacionRecibida[]): void {
    http.match(PENDIENTES).forEach((r) => r.flush(pendientes));
  }

  afterEach(() => {
    http.match(PENDIENTES);
    http.verify();
    el.remove();
  });

  const filas = () => Array.from(el.querySelectorAll('tbody tr'));
  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(texto)) as HTMLButtonElement;

  describe('reservas OCUPADA', () => {
    it('muestra sala, fecha y franja, con «Ocupada», sin datos privados', () => {
      crear(ANA, [PROPIA, OCUPADA]);
      const fila = filas()[1];
      const texto = fila.textContent ?? '';
      expect(texto).toContain('Sala Norte');
      expect(texto).toContain('07/10/2026');
      expect(texto).toContain('15:00');
      expect(texto).toContain('16:00');
      expect(texto).toContain('Ocupada');
      expect(texto).not.toContain('Ana');
      expect(texto).not.toContain('undefined');
    });

    it('no ofrece «Ver» ni «Cancelar» en las filas ocupadas, y sí en las propias', () => {
      crear(ANA, [PROPIA, OCUPADA]);
      expect(filas()[0].querySelector('a')).not.toBeNull();
      expect(filas()[0].querySelector('button')).not.toBeNull();
      expect(filas()[1].querySelector('a')).toBeNull();
      expect(filas()[1].querySelector('button')).toBeNull();
    });

    it('ni siquiera un administrador ve acciones en una fila ocupada', () => {
      crear(ADMIN, [OCUPADA]);
      expect(filas()[0].querySelector('a, button')).toBeNull();
    });

    it('un solo «Ocupada» ocupa las columnas de responsable y motivo (colspan=2)', () => {
      crear(ANA, [OCUPADA]);
      const ocupadas = filas()[0].querySelectorAll('.texto-ocupada');
      expect(ocupadas.length).toBe(1);
      expect(ocupadas[0].closest('td')?.getAttribute('colspan')).toBe('2');
      expect(filas()[0].querySelectorAll('td').length).toBe(6);
    });

    it('la celda de «Ocupada» tiene un texto accesible oculto', () => {
      crear(ANA, [OCUPADA]);
      const oculto = filas()[0].querySelector('.visualmente-oculto');
      expect(oculto).not.toBeNull();
      expect(oculto?.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('no usa solo el color: el texto «Ocupada» está en el DOM', () => {
      crear(ANA, [OCUPADA]);
      expect(Array.from(filas()[0].querySelectorAll('.texto-ocupada')).every((e) => e.textContent?.trim() === 'Ocupada')).toBeTrue();
    });
  });

  describe('Pendientes de responder', () => {
    it('sin invitaciones pendientes la sección no se muestra', () => {
      crear(ANA, [PROPIA], []);
      expect(el.textContent).not.toContain('Pendientes de responder');
    });

    it('con invitaciones muestra la sección con su número, sala, franja y organizador', () => {
      crear(ANA, [PROPIA], [recibida(1), recibida(2)]);
      const seccion = el.querySelector('section.bloque') as HTMLElement;
      expect(seccion.querySelector('h2')?.textContent).toContain('Pendientes de responder');
      expect(seccion.querySelector('h2')?.textContent).toContain('(2)');
      expect(seccion.querySelectorAll('li').length).toBe(2);
      expect(seccion.textContent).toContain('Sala Norte');
      expect(seccion.textContent).toContain('20/10/2026');
      expect(seccion.textContent).toContain('Luis');
      expect(seccion.textContent).toContain('Planificación');
    });

    it('cada invitación tiene «Aceptar» y «Rechazar»', () => {
      crear(ANA, [PROPIA], [recibida(1)]);
      expect(boton('Aceptar')).toBeDefined();
      expect(boton('Rechazar')).toBeDefined();
    });

    it('aceptar envía el POST, quita la invitación, avisa y recarga pendientes y listado', () => {
      crear(ANA, [PROPIA], [recibida(1), recibida(2)]);
      boton('Aceptar').click();
      const post = http.expectOne('/api/invitaciones/1/aceptar');
      expect(post.request.method).toBe('POST');
      post.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(el.querySelectorAll('section.bloque li').length).toBe(1);
      expect(el.querySelector('[role="status"]')?.textContent).toContain(AVISO_INVITACION_ACEPTADA);
      // Recarga del listado sin refrescar la página, que ahora incluye la reserva aceptada.
      const recargaListado = http.expectOne((r) => r.url === '/api/reservas');
      flushPendientes([recibida(2)]);
      recargaListado.flush(pagina([PROPIA, { ...recibida(1).reserva }]));
      fixture.detectChanges();
      expect(filas().length).toBe(2);
      expect(el.querySelectorAll('section.bloque li').length).toBe(1);
    });

    it('aceptar la última pendiente deja la lista vacía y mantiene el aviso', () => {
      crear(ANA, [PROPIA], [recibida(1)]);
      boton('Aceptar').click();
      http.expectOne('/api/invitaciones/1/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne((r) => r.url === '/api/reservas').flush(pagina([PROPIA]));
      flushPendientes([]);
      fixture.detectChanges();
      expect(el.querySelectorAll('section.bloque li').length).toBe(1);
      expect(el.querySelector('section.bloque li')?.textContent).toContain('No tienes invitaciones pendientes');
      expect(el.textContent).toContain(AVISO_INVITACION_ACEPTADA);
    });

    it('rechazar envía el POST, quita la invitación y recarga el listado', () => {
      crear(ANA, [PROPIA], [recibida(1)]);
      boton('Rechazar').click();
      const post = http.expectOne('/api/invitaciones/1/rechazar');
      expect(post.request.method).toBe('POST');
      post.flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne((r) => r.url === '/api/reservas').flush(pagina([PROPIA, OCUPADA]));
      flushPendientes([]);
      fixture.detectChanges();
      expect(el.textContent).toContain(AVISO_INVITACION_RECHAZADA);
      expect(el.querySelector('section.bloque li')?.textContent).toContain('No tienes invitaciones pendientes');
      // La reserva rechazada pasa a verse como ocupada.
      expect(filas()[1].textContent).toContain('Ocupada');
    });

    it('un 409 al aceptar muestra el mensaje, quita la invitación y recarga', () => {
      crear(ANA, [PROPIA], [recibida(1)]);
      boton('Aceptar').click();
      http.expectOne('/api/invitaciones/1/aceptar').flush({ title: 'Conflicto', status: 409, detail: 'La reserva ya ha pasado' }, { status: 409, statusText: 'Conflict' });
      http.expectOne((r) => r.url === '/api/reservas').flush(pagina([PROPIA]));
      flushPendientes([]);
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain('La reserva ya ha pasado');
    });

    it('un 404 al rechazar indica que la invitación ya no existe', () => {
      crear(ANA, [PROPIA], [recibida(1)]);
      boton('Rechazar').click();
      http.expectOne('/api/invitaciones/1/rechazar').flush(null, { status: 404, statusText: 'Not Found' });
      http.expectOne((r) => r.url === '/api/reservas').flush(pagina([PROPIA]));
      flushPendientes([]);
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain('ya no existe');
    });

    it('mientras hay una respuesta en curso se ignoran las demás', () => {
      crear(ANA, [PROPIA], [recibida(1), recibida(2)]);
      boton('Aceptar').click();
      const botones = el.querySelectorAll('button');
      (Array.from(botones).filter((b) => b.textContent?.includes('Rechazar'))[1] as HTMLButtonElement).click();
      http.expectOne('/api/invitaciones/1/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      http.expectNone('/api/invitaciones/2/rechazar');
      http.match((r) => r.url === '/api/reservas');
    });

    it('marca como «Nueva» con texto las invitaciones no vistas', () => {
      localStorage.clear();
      crear(ANA, [PROPIA], [recibida(1)]);
      expect(el.querySelector('.marca-nueva')?.textContent).toContain('Nueva');
      localStorage.clear();
    });
  });
});
