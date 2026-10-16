import { HttpContext, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ERRORES_PROPIOS } from '../http/errores-propios';
import { Invitacion, InvitacionRecibida } from '../models/invitacion.model';
import { Usuario } from '../models/usuario.model';
import { AHORA } from '../tokens/ahora.token';
import { INTERVALO_RECUENTO_MS } from './amistades.service';
import { CLAVE_INVITACIONES_VISTAS, InvitacionesService } from './invitaciones.service';
import { SesionService } from './sesion.service';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const LUIS: Usuario = { id: 2, email: 'luis@example.com', nombre: 'Luis', rol: 'USER' };
const PENDIENTES = '/api/invitaciones/pendientes';

const recibida = (id: number): InvitacionRecibida => ({
  id,
  reserva: { id: id + 100, salaId: 1, fecha: '2026-10-20', horaInicio: '09:00', horaFin: '10:00', detalle: 'COMPLETO', responsable: 'Luis', motivo: 'Demo' },
});

/** Códigos de estado que la petición declara que gestiona quien llama. */
function propios(contexto: HttpContext): number[] | 'todos' {
  return contexto.get(ERRORES_PROPIOS) as number[] | 'todos';
}

describe('InvitacionesService', () => {
  let http: HttpTestingController;
  let service: InvitacionesService;
  let sesion: SesionService;
  let ms: number;

  beforeEach(() => {
    localStorage.clear();
    ms = new Date(2026, 9, 16, 12, 0, 0).getTime();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AHORA, useValue: () => new Date(ms) }],
    });
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    service = TestBed.inject(InvitacionesService);
  });

  afterEach(() => {
    http.match(PENDIENTES);
    http.verify();
    localStorage.clear();
  });

  const volver = () => document.dispatchEvent(new Event('visibilitychange'));

  /** Inicia sesión y responde al recuento inicial. */
  function conSesion(usuario: Usuario, pendientes: InvitacionRecibida[] = []): void {
    sesion.establecer(usuario);
    TestBed.tick();
    http.expectOne(PENDIENTES).flush(pendientes);
  }

  describe('verbos y URLs', () => {
    it('invitar hace POST a /api/reservas/{id}/invitaciones con el usuarioId y gestiona 400, 403 y 409', () => {
      const creada: Invitacion = { id: 7, reservaId: 10, usuarioId: 5, nombre: 'Eva', estado: 'PENDIENTE' };
      let resultado: Invitacion | undefined;
      service.invitar(10, 5).subscribe((i) => (resultado = i));
      const req = http.expectOne('/api/reservas/10/invitaciones');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ usuarioId: 5 });
      expect(propios(req.request.context)).toEqual([400, 403, 409]);
      req.flush(creada, { status: 201, statusText: 'Created' });
      expect(resultado).toEqual(creada);
    });

    it('retirar hace DELETE a /api/reservas/{id}/invitaciones/{invitacionId} y gestiona 403 y 404', () => {
      let terminado = false;
      service.retirar(10, 7).subscribe({ complete: () => (terminado = true) });
      const req = http.expectOne('/api/reservas/10/invitaciones/7');
      expect(req.request.method).toBe('DELETE');
      expect(propios(req.request.context)).toEqual([403, 404]);
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(terminado).toBeTrue();
    });

    it('aceptar hace POST a /api/invitaciones/{id}/aceptar y gestiona 404 y 409', () => {
      service.aceptar(7).subscribe();
      const req = http.expectOne('/api/invitaciones/7/aceptar');
      expect(req.request.method).toBe('POST');
      expect(propios(req.request.context)).toEqual([404, 409]);
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('rechazar hace POST a /api/invitaciones/{id}/rechazar y gestiona 404 y 409', () => {
      service.rechazar(7).subscribe();
      const req = http.expectOne('/api/invitaciones/7/rechazar');
      expect(req.request.method).toBe('POST');
      expect(propios(req.request.context)).toEqual([404, 409]);
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('listarPendientes hace GET a /api/invitaciones/pendientes', () => {
      let resultado: InvitacionRecibida[] | undefined;
      service.listarPendientes().subscribe((r) => (resultado = r));
      const req = http.expectOne(PENDIENTES);
      expect(req.request.method).toBe('GET');
      req.flush([recibida(1)]);
      expect(resultado?.length).toBe(1);
      expect(service.pendientes()?.length).toBe(1);
    });

    it('propaga un 409 de invitar al suscriptor', () => {
      let status: number | undefined;
      service.invitar(10, 5).subscribe({ error: (e) => (status = e.status) });
      http.expectOne('/api/reservas/10/invitaciones').flush({ detail: 'No es tu amigo' }, { status: 409, statusText: 'Conflict' });
      expect(status).toBe(409);
    });
  });

  describe('pendientes', () => {
    it('sin sesión no se piden y no se conocen', () => {
      TestBed.tick();
      http.expectNone(PENDIENTES);
      expect(service.pendientes()).toBeUndefined();
      expect(service.numeroPendientes()).toBe(0);
    });

    it('al iniciar sesión se piden una vez y se cuentan', () => {
      conSesion(ANA, [recibida(1), recibida(2)]);
      expect(service.numeroPendientes()).toBe(2);
      TestBed.tick();
      http.expectNone(PENDIENTES);
    });

    it('listarPendientes con el recuento inicial en curso hace un solo GET', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      let resultado: InvitacionRecibida[] | undefined;
      service.listarPendientes().subscribe((r) => (resultado = r));
      const reqs = http.match(PENDIENTES);
      expect(reqs.length).toBe(1);
      reqs[0].flush([recibida(1)]);
      expect(resultado?.length).toBe(1);
    });

    it('si la petición compartida falla, listarPendientes la repite', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      const recuento = http.expectOne(PENDIENTES);
      let resultado: InvitacionRecibida[] | undefined;
      service.listarPendientes().subscribe((r) => (resultado = r));
      recuento.flush(null, { status: 500, statusText: 'Server Error' });
      http.expectOne(PENDIENTES).flush([recibida(3)]);
      expect(resultado?.[0].id).toBe(3);
    });

    it('un fallo del recuento inicial no rompe nada y deja 0', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      http.expectOne(PENDIENTES).flush(null, { status: 500, statusText: 'Server Error' });
      expect(service.numeroPendientes()).toBe(0);
    });

    it('al cambiar la sesión se descartan las pendientes anteriores', () => {
      conSesion(ANA, [recibida(1), recibida(2)]);
      sesion.establecer(LUIS);
      expect(service.pendientes()).toBeUndefined();
      expect(service.numeroPendientes()).toBe(0);
      TestBed.tick();
      http.expectOne(PENDIENTES).flush([recibida(9)]);
      expect(service.numeroPendientes()).toBe(1);
    });

    it('una respuesta de la sesión anterior que llega tarde se ignora', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      const deAna = http.expectOne(PENDIENTES);
      sesion.establecer(LUIS);
      deAna.flush([recibida(1), recibida(2), recibida(3)]);
      expect(service.numeroPendientes()).toBe(0);
    });

    it('tras cerrar la sesión no se conocen', () => {
      conSesion(ANA, [recibida(1)]);
      sesion.limpiar();
      expect(service.pendientes()).toBeUndefined();
    });

    it('aceptar y rechazar quitan la invitación de las pendientes', () => {
      conSesion(ANA, [recibida(1), recibida(2), recibida(3)]);
      service.aceptar(1).subscribe();
      http.expectOne('/api/invitaciones/1/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      expect(service.pendientes()?.map((i) => i.id)).toEqual([2, 3]);
      service.rechazar(3).subscribe();
      http.expectOne('/api/invitaciones/3/rechazar').flush(null, { status: 204, statusText: 'No Content' });
      expect(service.pendientes()?.map((i) => i.id)).toEqual([2]);
      expect(service.numeroPendientes()).toBe(1);
    });

    it('si aceptar falla, la invitación sigue pendiente', () => {
      conSesion(ANA, [recibida(1)]);
      service.aceptar(1).subscribe({ error: () => undefined });
      http.expectOne('/api/invitaciones/1/aceptar').flush(null, { status: 409, statusText: 'Conflict' });
      expect(service.numeroPendientes()).toBe(1);
    });
  });

  describe('recuento al volver a la pestaña', () => {
    let visibilidad: jasmine.Spy;

    beforeEach(() => {
      visibilidad = spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
    });

    it('sin sesión no recuenta', () => {
      ms += 10 * INTERVALO_RECUENTO_MS;
      volver();
      http.expectNone(PENDIENTES);
    });

    it('con sesión y pasados 30 s recuenta al volver a visible', () => {
      conSesion(ANA);
      ms += INTERVALO_RECUENTO_MS;
      volver();
      http.expectOne(PENDIENTES).flush([recibida(1)]);
      expect(service.numeroPendientes()).toBe(1);
    });

    it('antes de 30 s no recuenta', () => {
      conSesion(ANA);
      ms += INTERVALO_RECUENTO_MS - 1;
      volver();
      http.expectNone(PENDIENTES);
    });

    it('el intervalo se cuenta desde el último recuento', () => {
      conSesion(ANA);
      ms += INTERVALO_RECUENTO_MS;
      volver();
      http.expectOne(PENDIENTES).flush([]);
      ms += INTERVALO_RECUENTO_MS - 1;
      volver();
      http.expectNone(PENDIENTES);
      ms += 1;
      volver();
      http.expectOne(PENDIENTES).flush([]);
    });

    it('un listarPendientes también reinicia el intervalo', () => {
      conSesion(ANA);
      ms += INTERVALO_RECUENTO_MS - 1;
      service.listarPendientes().subscribe();
      http.expectOne(PENDIENTES).flush([]);
      ms += 1;
      volver();
      http.expectNone(PENDIENTES);
    });

    it('con la pestaña oculta no recuenta', () => {
      conSesion(ANA);
      ms += 2 * INTERVALO_RECUENTO_MS;
      visibilidad.and.returnValue('hidden');
      volver();
      http.expectNone(PENDIENTES);
    });

    it('si ya hay un recuento en curso, no lanza otro', () => {
      conSesion(ANA);
      ms += INTERVALO_RECUENTO_MS;
      volver();
      volver();
      expect(http.match(PENDIENTES).length).toBe(1);
    });

    it('tras cerrar la sesión no recuenta', () => {
      conSesion(ANA);
      sesion.limpiar();
      TestBed.tick();
      ms += 2 * INTERVALO_RECUENTO_MS;
      volver();
      http.expectNone(PENDIENTES);
    });

    it('un fallo del recuento al volver deja el número como estaba', () => {
      conSesion(ANA, [recibida(1)]);
      ms += INTERVALO_RECUENTO_MS;
      volver();
      http.expectOne(PENDIENTES).flush(null, { status: 500, statusText: 'Server Error' });
      expect(service.numeroPendientes()).toBe(1);
    });
  });

  describe('marca «nueva» en localStorage', () => {
    it('sin nada guardado, toda invitación es nueva', () => {
      conSesion(ANA);
      expect(service.esNueva(5)).toBeTrue();
    });

    it('marcarVistas guarda solo los ids, bajo la clave del usuario', () => {
      conSesion(ANA, [recibida(5), recibida(6)]);
      service.marcarVistas([5, 6]);
      expect(service.esNueva(5)).toBeFalse();
      expect(service.esNueva(7)).toBeTrue();
      const guardado = localStorage.getItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`);
      expect(JSON.parse(guardado ?? 'null')).toEqual([5, 6]);
      expect(guardado).not.toContain('Luis');
      expect(guardado).not.toContain('Demo');
      expect(guardado).not.toContain(ANA.email);
    });

    it('marcarVistas olvida los ids que ya no están pendientes', () => {
      conSesion(ANA);
      service.marcarVistas([5, 6]);
      service.marcarVistas([6]);
      expect(JSON.parse(localStorage.getItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`) ?? '[]')).toEqual([6]);
      expect(service.esNueva(5)).toBeTrue();
    });

    it('marcarVistas(ids, false) añade a las ya vistas sin olvidar ninguna', () => {
      conSesion(ANA);
      service.marcarVistas([5, 6]);
      service.marcarVistas([7], false);
      expect(service.esNueva(5)).toBeFalse();
      expect(service.esNueva(6)).toBeFalse();
      expect(service.esNueva(7)).toBeFalse();
      const guardado = JSON.parse(localStorage.getItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`) ?? '[]') as number[];
      expect(guardado.sort()).toEqual([5, 6, 7]);
    });

    it('marcarVistas(ids, false) parte de lo guardado en localStorage aunque aún no se haya leído', () => {
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`, '[3]');
      conSesion(ANA);
      service.marcarVistas([4], false);
      const guardado = JSON.parse(localStorage.getItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`) ?? '[]') as number[];
      expect(guardado.sort()).toEqual([3, 4]);
    });

    it('marcarVistas(ids, false) con un id repetido no lo duplica', () => {
      conSesion(ANA);
      service.marcarVistas([5]);
      service.marcarVistas([5], false);
      expect(JSON.parse(localStorage.getItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`) ?? '[]')).toEqual([5]);
    });

    it('al iniciar sesión lee las vistas guardadas de ese usuario', () => {
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`, '[5]');
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${LUIS.id}`, '[6]');
      conSesion(ANA);
      expect(service.esNueva(5)).toBeFalse();
      expect(service.esNueva(6)).toBeTrue();
    });

    it('cada usuario tiene sus propias vistas', () => {
      conSesion(ANA);
      service.marcarVistas([5]);
      sesion.establecer(LUIS);
      TestBed.tick();
      http.expectOne(PENDIENTES).flush([]);
      expect(service.esNueva(5)).toBeTrue();
      expect(localStorage.getItem(`${CLAVE_INVITACIONES_VISTAS}${LUIS.id}`)).toBeNull();
    });

    it('ignora un contenido guardado que no es una lista de enteros', () => {
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`, '{"a":1}');
      conSesion(ANA);
      expect(service.esNueva(1)).toBeTrue();
    });

    it('ignora un JSON corrupto', () => {
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`, 'no-es-json');
      conSesion(ANA);
      expect(service.esNueva(1)).toBeTrue();
    });

    it('descarta de la lista guardada lo que no es un id entero', () => {
      localStorage.setItem(`${CLAVE_INVITACIONES_VISTAS}${ANA.id}`, '[5,"x",null,1.5,6]');
      conSesion(ANA);
      expect(service.esNueva(5)).toBeFalse();
      expect(service.esNueva(6)).toBeFalse();
      expect(service.esNueva(1)).toBeTrue();
    });

    it('con localStorage.setItem lanzando una excepción, marcarVistas no rompe y la marca dura la pestaña', () => {
      conSesion(ANA);
      spyOn(Storage.prototype, 'setItem').and.throwError('cuota');
      expect(() => service.marcarVistas([5])).not.toThrow();
      expect(service.esNueva(5)).toBeFalse();
    });

    it('con localStorage.getItem lanzando una excepción, el inicio de sesión no rompe', () => {
      spyOn(Storage.prototype, 'getItem').and.throwError('denegado');
      expect(() => conSesion(ANA, [recibida(1)])).not.toThrow();
      expect(service.esNueva(1)).toBeTrue();
      expect(service.numeroPendientes()).toBe(1);
    });

    it('sin sesión, marcarVistas no escribe en localStorage', () => {
      service.marcarVistas([5]);
      expect(localStorage.length).toBe(0);
    });
  });
});
