import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ERRORES_PROPIOS } from '../../../core/http/errores-propios';
import { InvitacionRecibida } from '../../../core/models/invitacion.model';
import { CLAVE_INVITACIONES_VISTAS } from '../../../core/services/invitaciones.service';
import { SesionService } from '../../../core/services/sesion.service';
import { AVISO_INVITACION_ACEPTADA, AVISO_INVITACION_RECHAZADA } from '../invitaciones-mensajes';
import { InvitacionesPendientesComponent } from './invitaciones-pendientes.component';

const ANA = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' as const };
const PENDIENTES = '/api/invitaciones/pendientes';

const recibida = (id: number, reservaId: number): InvitacionRecibida => ({
  id,
  reserva: {
    id: reservaId,
    salaId: 1,
    fecha: '2026-10-20',
    horaInicio: '09:00',
    horaFin: '10:00',
    detalle: 'COMPLETO',
    usuarioId: 2,
    responsable: 'Luis',
    motivo: `Motivo ${reservaId}`,
    miInvitacion: { id, estado: 'PENDIENTE' },
  },
});

describe('InvitacionesPendientesComponent', () => {
  let fixture: ComponentFixture<InvitacionesPendientesComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let respondidas: number;

  function crear(datos?: InvitacionRecibida[]): void {
    TestBed.configureTestingModule({
      imports: [InvitacionesPendientesComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(SesionService).establecer(ANA);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InvitacionesPendientesComponent);
    fixture.componentRef.setInput('salas', [{ id: 1, nombre: 'Sala Norte', capacidad: 8, planta: 0 }]);
    if (datos) {
      fixture.componentRef.setInput('datos', datos);
    }
    respondidas = 0;
    fixture.componentInstance.respondida.subscribe(() => respondidas++);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  /**
   * Peticiones de pendientes que lanza el propio componente. El recuento de la sesión (que el
   * servicio lanza al haber sesión) va sin que el interceptor actúe (`'todos'`) y se excluye.
   */
  const peticionesPendientes = () =>
    http.match((r) => r.url === PENDIENTES && r.context.get(ERRORES_PROPIOS) !== 'todos');

  const boton = (txt: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(txt)) as HTMLButtonElement;
  const items = () => Array.from(el.querySelectorAll('li'));

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    http.match((r) => r.url === PENDIENTES && r.context.get(ERRORES_PROPIOS) === 'todos');
    http.verify();
    el.remove();
    localStorage.clear();
  });

  describe('con el input datos', () => {
    it('muestra esas invitaciones sin hacer ninguna petición', () => {
      crear([recibida(40, 4), recibida(41, 5)]);
      // El recuento de la sesión lo lanza la cabecera, no este componente.
      expect(peticionesPendientes().length).toBe(0);
      expect(items().length).toBe(2);
      expect(items()[0].textContent).toContain('Sala Norte');
      expect(items()[0].textContent).toContain('Motivo 4');
      expect(el.textContent).not.toContain('Cargando invitaciones');
    });

    it('aceptar envía POST con el id de la invitación, avisa, emite respondida y no recarga por su cuenta', () => {
      crear([recibida(40, 4)]);
      boton('Aceptar').click();
      http.expectOne('/api/invitaciones/40/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(respondidas).toBe(1);
      expect(el.querySelector('[role="status"]')?.textContent).toContain(AVISO_INVITACION_ACEPTADA);
      expect(items()[0].textContent).toContain('No tienes invitaciones pendientes');
      expect(peticionesPendientes().length).toBe(0);
    });

    it('rechazar envía POST y emite respondida', () => {
      crear([recibida(40, 4)]);
      boton('Rechazar').click();
      http.expectOne('/api/invitaciones/40/rechazar').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(respondidas).toBe(1);
      expect(el.textContent).toContain(AVISO_INVITACION_RECHAZADA);
    });

    it('un 409 al responder también emite respondida (para recargar) y muestra el error', () => {
      crear([recibida(40, 4)]);
      boton('Aceptar').click();
      http
        .expectOne('/api/invitaciones/40/aceptar')
        .flush({ title: 'Conflict', status: 409, detail: 'La reserva ya ha pasado' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(respondidas).toBe(1);
      expect(el.querySelector('.error-general')?.textContent).toContain('La reserva ya ha pasado');
    });

    it('al cambiar datos (la pantalla recarga) muestra la nueva lista y conserva el aviso', () => {
      crear([recibida(40, 4), recibida(41, 5)]);
      boton('Aceptar').click();
      http.expectOne('/api/invitaciones/40/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      fixture.componentRef.setInput('datos', [recibida(41, 5), recibida(42, 6)]);
      fixture.detectChanges();
      expect(items().map((i) => i.textContent).join()).toContain('Motivo 6');
      expect(items().length).toBe(2);
      expect(el.textContent).toContain(AVISO_INVITACION_ACEPTADA);
    });

    it('marca como «Nueva» las no vistas y las guarda como vistas sin olvidar otras', () => {
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`, '[99, 41]');
      crear([recibida(40, 4), recibida(41, 5)]);
      const nuevas = items().filter((i) => i.querySelector('.marca-nueva'));
      expect(nuevas.length).toBe(1);
      expect(nuevas[0].textContent).toContain('Motivo 4');
      const guardado = JSON.parse(localStorage.getItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`) ?? '[]') as number[];
      expect(guardado.sort((a, b) => a - b)).toEqual([40, 41, 99]);
    });

    it('enfocarTitulo lleva el foco al título de la lista', () => {
      crear([recibida(40, 4)]);
      fixture.componentInstance.enfocarTitulo();
      expect(document.activeElement?.id).toBe('titulo-invitaciones-pendientes');
    });
  });

  describe('sin el input datos', () => {
    it('pide las pendientes por su cuenta y, tras responder, las vuelve a pedir', () => {
      crear();
      http.expectOne(PENDIENTES).flush([recibida(40, 4)]);
      fixture.detectChanges();
      expect(items().length).toBe(1);
      boton('Aceptar').click();
      http.expectOne('/api/invitaciones/40/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne(PENDIENTES).flush([]);
      fixture.detectChanges();
      expect(respondidas).toBe(1);
    });
  });
});
