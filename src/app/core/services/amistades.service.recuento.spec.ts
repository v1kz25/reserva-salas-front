import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SolicitudAmistad } from '../models/amistad.model';
import { Usuario } from '../models/usuario.model';
import { AHORA } from '../tokens/ahora.token';
import { AmistadesService, INTERVALO_RECUENTO_MS } from './amistades.service';
import { SesionService } from './sesion.service';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const LUIS: Usuario = { id: 2, email: 'luis@example.com', nombre: 'Luis', rol: 'USER' };
const RECIBIDAS = '/api/amistades/solicitudes/recibidas';

const solicitud = (id: number): SolicitudAmistad => ({
  id,
  usuario: { id: id + 100, nombre: `Persona ${id}` },
  fecha: '2026-10-01T10:00:00Z',
});

describe('AmistadesService: petición compartida y recuento al volver a la pestaña', () => {
  let http: HttpTestingController;
  let service: AmistadesService;
  let sesion: SesionService;
  let ms: number;
  let visibilidad: jasmine.Spy;

  beforeEach(() => {
    ms = new Date(2026, 9, 16, 12, 0, 0).getTime();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AHORA, useValue: () => new Date(ms) }],
    });
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    service = TestBed.inject(AmistadesService);
    visibilidad = spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
  });

  afterEach(() => http.verify());

  const volver = () => document.dispatchEvent(new Event('visibilitychange'));

  describe('petición compartida', () => {
    it('listarRecibidas con el recuento de inicio de sesión en curso hace un solo GET', () => {
      sesion.establecer(ANA);
      TestBed.tick(); // lanza el recuento
      let resultado: SolicitudAmistad[] | undefined;
      service.listarRecibidas().subscribe((r) => (resultado = r));
      const reqs = http.match(RECIBIDAS);
      expect(reqs.length).toBe(1);
      reqs[0].flush([solicitud(1), solicitud(2)]);
      expect(resultado?.length).toBe(2);
      expect(service.pendientes()).toBe(2);
    });

    it('terminada la petición, una nueva llamada lanza otro GET', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      http.expectOne(RECIBIDAS).flush([]);
      service.listarRecibidas().subscribe();
      http.expectOne(RECIBIDAS).flush([solicitud(1)]);
      expect(service.pendientes()).toBe(1);
    });

    it('no se comparte entre sesiones distintas', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      const deAna = http.expectOne(RECIBIDAS);
      sesion.establecer(LUIS); // cambia la sesión antes de que el efecto lance su recuento
      service.listarRecibidas().subscribe();
      const reqs = http.match(RECIBIDAS);
      expect(reqs.length).toBe(1);
      expect(reqs[0]).not.toBe(deAna);
      deAna.flush([solicitud(1), solicitud(2), solicitud(3)]);
      expect(service.pendientes()).toBe(0);
      reqs[0].flush([solicitud(9)]);
      expect(service.pendientes()).toBe(1);
      TestBed.tick();
      http.match(RECIBIDAS).forEach((r) => r.flush([solicitud(9)]));
    });

    it('si la petición compartida falla, listarRecibidas la repite', () => {
      sesion.establecer(ANA);
      TestBed.tick();
      const recuento = http.expectOne(RECIBIDAS);
      let resultado: SolicitudAmistad[] | undefined;
      service.listarRecibidas().subscribe((r) => (resultado = r));
      recuento.flush(null, { status: 500, statusText: 'Server Error' });
      http.expectOne(RECIBIDAS).flush([solicitud(1)]);
      expect(resultado?.length).toBe(1);
    });
  });

  describe('visibilitychange', () => {
    function conSesionYRecuentoInicial(): void {
      sesion.establecer(ANA);
      TestBed.tick();
      http.expectOne(RECIBIDAS).flush([]);
    }

    it('sin sesión no recuenta', () => {
      ms += 10 * INTERVALO_RECUENTO_MS;
      volver();
      http.expectNone(RECIBIDAS);
    });

    it('con sesión y pasados 30 s recuenta al volver a visible', () => {
      conSesionYRecuentoInicial();
      ms += INTERVALO_RECUENTO_MS;
      volver();
      http.expectOne(RECIBIDAS).flush([solicitud(1)]);
      expect(service.pendientes()).toBe(1);
    });

    it('antes de 30 s desde el último recuento no recuenta', () => {
      conSesionYRecuentoInicial();
      ms += INTERVALO_RECUENTO_MS - 1;
      volver();
      http.expectNone(RECIBIDAS);
    });

    it('el intervalo se cuenta desde el último recuento, también el hecho al volver', () => {
      conSesionYRecuentoInicial();
      ms += INTERVALO_RECUENTO_MS;
      volver();
      http.expectOne(RECIBIDAS).flush([]);
      ms += INTERVALO_RECUENTO_MS - 1;
      volver();
      http.expectNone(RECIBIDAS);
      ms += 1;
      volver();
      http.expectOne(RECIBIDAS).flush([]);
    });

    it('al ocultarse la pestaña no recuenta', () => {
      conSesionYRecuentoInicial();
      ms += INTERVALO_RECUENTO_MS * 2;
      visibilidad.and.returnValue('hidden');
      volver();
      http.expectNone(RECIBIDAS);
    });

    it('tras cerrar la sesión no recuenta', () => {
      conSesionYRecuentoInicial();
      sesion.limpiar();
      TestBed.tick();
      ms += INTERVALO_RECUENTO_MS * 2;
      volver();
      http.expectNone(RECIBIDAS);
    });

    it('un fallo del recuento al volver no es visible y deja el número como estaba', () => {
      conSesionYRecuentoInicial();
      ms += INTERVALO_RECUENTO_MS;
      volver();
      http.expectOne(RECIBIDAS).flush(null, { status: 500, statusText: 'Server Error' });
      expect(service.pendientes()).toBe(0);
    });
  });
});
