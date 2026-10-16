import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { erroresInterceptor } from '../http/errores.interceptor';
import { PaginaReservas } from '../models/reserva.model';
import { ReservasService } from './reservas.service';

const pagina = (totalElements: number): PaginaReservas => ({
  content: [],
  totalElements,
  totalPages: totalElements > 0 ? 1 : 0,
  number: 0,
  size: 1,
});

describe('ReservasService: mis reservas', () => {
  let http: HttpTestingController;
  let service: ReservasService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ReservasService);
  });

  afterEach(() => http.verify());

  describe('listarMias', () => {
    for (const rol of ['ORGANIZADA', 'INVITADO', 'PENDIENTE'] as const) {
      it(`hace GET con mis=true, rol=${rol}, page y size`, () => {
        service.listarMias(rol, 2, 50).subscribe();
        const req = http.expectOne((r) => r.url === '/api/reservas');
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('mis')).toBe('true');
        expect(req.request.params.get('rol')).toBe(rol);
        expect(req.request.params.get('page')).toBe('2');
        expect(req.request.params.get('size')).toBe('50');
        req.flush(pagina(0));
      });
    }

    it('por defecto pide la página 0 de 20', () => {
      service.listarMias('ORGANIZADA').subscribe();
      const req = http.expectOne((r) => r.url === '/api/reservas');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('20');
      req.flush(pagina(0));
    });

    it('listar no envía mis ni rol', () => {
      service.listar().subscribe();
      const req = http.expectOne((r) => r.url === '/api/reservas');
      expect(req.request.params.has('mis')).toBeFalse();
      expect(req.request.params.has('rol')).toBeFalse();
      req.flush(pagina(0));
    });
  });

  describe('contarMias', () => {
    it('pide una página de tamaño 1 del rol y devuelve su totalElements', () => {
      let total: number | undefined;
      service.contarMias('INVITADO').subscribe((t) => (total = t));
      const req = http.expectOne((r) => r.url === '/api/reservas');
      expect(req.request.params.get('mis')).toBe('true');
      expect(req.request.params.get('rol')).toBe('INVITADO');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('1');
      req.flush(pagina(37));
      expect(total).toBe(37);
    });

    it('un error no redirige a ninguna página de error: llega a quien llama', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate').and.resolveTo(true);
      let status: number | undefined;
      service.contarMias('PENDIENTE').subscribe({ error: (e) => (status = e.status) });
      http.expectOne((r) => r.url === '/api/reservas').flush(null, { status: 503, statusText: 'Unavailable' });
      expect(status).toBe(503);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
