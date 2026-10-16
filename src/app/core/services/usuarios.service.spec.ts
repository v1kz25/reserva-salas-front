import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ERRORES_PROPIOS } from '../http/errores-propios';
import { UsuarioAdmin } from '../models/usuario.model';
import { UsuariosService } from './usuarios.service';

const USUARIO: UsuarioAdmin = {
  id: 4,
  email: 'ana@example.com',
  nombre: 'Ana',
  rol: 'USER',
  activo: true,
  fechaCreacion: '2026-10-01T10:00:00+02:00',
};

describe('UsuariosService', () => {
  let http: HttpTestingController;
  let service: UsuariosService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(UsuariosService);
  });

  afterEach(() => http.verify());

  it('listar hace GET /api/usuarios y no declara errores propios', () => {
    let resultado: unknown;
    service.listar().subscribe((u) => (resultado = u));
    const req = http.expectOne('/api/usuarios');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([]);
    req.flush([USUARIO]);
    expect(resultado).toEqual([USUARIO]);
  });

  it('obtener hace GET /api/usuarios/{id} y no declara errores propios', () => {
    let resultado: unknown;
    service.obtener(4).subscribe((u) => (resultado = u));
    const req = http.expectOne('/api/usuarios/4');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([]);
    req.flush(USUARIO);
    expect(resultado).toEqual(USUARIO);
  });

  it('crear hace POST /api/usuarios con el cuerpo y gestiona 400 y 409', () => {
    const cuerpo = { email: 'ana@example.com', nombre: 'Ana', password: 'secreta123', rol: 'USER' as const };
    service.crear(cuerpo).subscribe();
    const req = http.expectOne('/api/usuarios');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400, 409]);
    req.flush(USUARIO);
  });

  it('modificar hace PUT /api/usuarios/{id} con el cuerpo y gestiona 400, 404 y 409', () => {
    const cuerpo = { nombre: 'Ana B', rol: 'ADMIN' as const, activo: false };
    service.modificar(4, cuerpo).subscribe();
    const req = http.expectOne('/api/usuarios/4');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400, 404, 409]);
    req.flush({ ...USUARIO, ...cuerpo });
  });

  it('cambiarPassword hace PUT /api/usuarios/{id}/password con { password } y gestiona 400 y 404', () => {
    let completado = false;
    service.cambiarPassword(4, 'nueva-clave-1').subscribe({ complete: () => (completado = true) });
    const req = http.expectOne('/api/usuarios/4/password');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ password: 'nueva-clave-1' });
    expect(req.request.context.get(ERRORES_PROPIOS)).toEqual([400, 404]);
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(completado).toBeTrue();
  });

  it('los errores propios (409) llegan a quien llama', () => {
    let status = 0;
    service.crear({ email: 'a@b.es', nombre: 'A', password: '12345678' }).subscribe({
      error: (e: { status: number }) => (status = e.status),
    });
    http.expectOne('/api/usuarios').flush({ title: 'Conflicto', status: 409 }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
  });
});
