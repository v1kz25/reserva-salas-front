import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ERRORES_PROPIOS } from '../http/errores-propios';
import { SolicitudAmistad } from '../models/amistad.model';
import { Usuario } from '../models/usuario.model';
import { AmistadesService } from './amistades.service';
import { SesionService } from './sesion.service';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const LUIS: Usuario = { id: 2, email: 'luis@example.com', nombre: 'Luis', rol: 'USER' };

const solicitud = (id: number): SolicitudAmistad => ({
  id,
  usuario: { id: id + 100, nombre: `Persona ${id}` },
  fecha: '2026-10-01T10:00:00Z',
});

describe('AmistadesService', () => {
  let http: HttpTestingController;
  let service: AmistadesService;
  let sesion: SesionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    service = TestBed.inject(AmistadesService);
  });

  afterEach(() => http.verify());

  describe('endpoints', () => {
    it('buscarUsuarios hace GET /api/usuarios/buscar?q= y gestiona el 400', () => {
      let res: unknown;
      service.buscarUsuarios('ma ría').subscribe((r) => (res = r));
      const req = http.expectOne((r) => r.url === '/api/usuarios/buscar');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('q')).toBe('ma ría');
      expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400]);
      req.flush([{ id: 5, nombre: 'María' }]);
      expect(res).toEqual([{ id: 5, nombre: 'María' }]);
    });

    it('listarAmigos hace GET /api/amistades', () => {
      service.listarAmigos().subscribe();
      const req = http.expectOne('/api/amistades');
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([]);
      req.flush([]);
    });

    it('eliminarAmistad hace DELETE /api/amistades/{usuarioId} y gestiona el 404', () => {
      service.eliminarAmistad(7).subscribe();
      const req = http.expectOne('/api/amistades/7');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([404]);
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('enviarSolicitud hace POST /api/amistades/solicitudes con {usuarioId} y gestiona 400, 404 y 409', () => {
      service.enviarSolicitud(4).subscribe();
      const req = http.expectOne('/api/amistades/solicitudes');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ usuarioId: 4 });
      expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400, 404, 409]);
      req.flush(solicitud(1), { status: 201, statusText: 'Created' });
    });

    it('listarEnviadas hace GET /api/amistades/solicitudes/enviadas', () => {
      service.listarEnviadas().subscribe();
      const req = http.expectOne('/api/amistades/solicitudes/enviadas');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('retirarSolicitud hace DELETE /api/amistades/solicitudes/{id} y gestiona el 404', () => {
      service.retirarSolicitud(3).subscribe();
      const req = http.expectOne('/api/amistades/solicitudes/3');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([404]);
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('aceptarSolicitud hace POST .../{id}/aceptar y gestiona el 404', () => {
      service.aceptarSolicitud(3).subscribe();
      const req = http.expectOne('/api/amistades/solicitudes/3/aceptar');
      expect(req.request.method).toBe('POST');
      expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([404]);
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('rechazarSolicitud hace POST .../{id}/rechazar y gestiona el 404', () => {
      service.rechazarSolicitud(3).subscribe();
      const req = http.expectOne('/api/amistades/solicitudes/3/rechazar');
      expect(req.request.method).toBe('POST');
      expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([404]);
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('pendientes', () => {
    const recibidas = () => http.match('/api/amistades/solicitudes/recibidas');

    it('empieza en 0 sin sesión y no hace peticiones', () => {
      TestBed.tick();
      expect(service.pendientes()).toBe(0);
      http.expectNone(() => true);
    });

    it('listarRecibidas fija el número de pendientes', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      recibidas().forEach((r) => r.flush([]));
      service.listarRecibidas().subscribe();
      http.expectOne('/api/amistades/solicitudes/recibidas').flush([solicitud(1), solicitud(2), solicitud(3)]);
      expect(service.pendientes()).toBe(3);
    });

    it('aceptar y rechazar bajan el número en uno, sin pasar de 0', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      recibidas()[0].flush([solicitud(1), solicitud(2)]);
      expect(service.pendientes()).toBe(2);

      service.aceptarSolicitud(1).subscribe();
      http.expectOne('/api/amistades/solicitudes/1/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      expect(service.pendientes()).toBe(1);

      service.rechazarSolicitud(2).subscribe();
      http.expectOne('/api/amistades/solicitudes/2/rechazar').flush(null, { status: 204, statusText: 'No Content' });
      expect(service.pendientes()).toBe(0);

      service.rechazarSolicitud(9).subscribe();
      http.expectOne('/api/amistades/solicitudes/9/rechazar').flush(null, { status: 204, statusText: 'No Content' });
      expect(service.pendientes()).toBe(0);
    });

    it('un 404 al aceptar no baja el número', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      recibidas()[0].flush([solicitud(1)]);
      service.aceptarSolicitud(1).subscribe({ error: () => undefined });
      http.expectOne('/api/amistades/solicitudes/1/aceptar').flush(null, { status: 404, statusText: 'Not Found' });
      expect(service.pendientes()).toBe(1);
    });

    it('al iniciar sesión carga las recibidas con todos los errores como propios', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      const reqs = recibidas();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.method).toBe('GET');
      expect(reqs[0].request.context.get(ERRORES_PROPIOS)).toBe('todos');
      reqs[0].flush([solicitud(1)]);
      expect(service.pendientes()).toBe(1);
    });

    it('la carga se hace una sola vez por sesión', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      recibidas()[0].flush([solicitud(1)]);
      TestBed.tick();
      service.listarRecibidas().subscribe();
      http.expectOne('/api/amistades/solicitudes/recibidas').flush([solicitud(1)]);
      TestBed.tick();
      http.expectNone('/api/amistades/solicitudes/recibidas');
      expect(service.pendientes()).toBe(1);
    });

    it('si falla la carga inicial no hay error visible y el número sigue en 0', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      recibidas()[0].flush(null, { status: 500, statusText: 'Server Error' });
      expect(service.pendientes()).toBe(0);
    });

    it('al cerrar la sesión el número vuelve a 0', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      recibidas()[0].flush([solicitud(1), solicitud(2)]);
      expect(service.pendientes()).toBe(2);
      sesion.limpiar();
      TestBed.tick();
      expect(service.pendientes()).toBe(0);
      http.expectNone('/api/amistades/solicitudes/recibidas');
    });

    it('al cambiar de usuario se reinicia y se vuelve a cargar', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      recibidas()[0].flush([solicitud(1), solicitud(2)]);
      sesion.establecer(LUIS);
      expect(service.pendientes()).toBe(0);
      TestBed.tick();
      const reqs = recibidas();
      expect(reqs.length).toBe(1);
      reqs[0].flush([solicitud(5)]);
      expect(service.pendientes()).toBe(1);
    });

    it('ignora la respuesta de una sesión anterior', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      const antigua = recibidas()[0];
      sesion.establecer(LUIS);
      TestBed.tick();
      const nueva = recibidas()[0];
      antigua.flush([solicitud(1), solicitud(2), solicitud(3)]);
      expect(service.pendientes()).toBe(0);
      nueva.flush([solicitud(7)]);
      expect(service.pendientes()).toBe(1);
    });

    it('ignora la respuesta si la sesión se cerró mientras tanto', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      const req = recibidas()[0];
      sesion.limpiar();
      req.flush([solicitud(1)]);
      expect(service.pendientes()).toBe(0);
    });
  });
});
