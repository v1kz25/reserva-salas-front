import { TestBed } from '@angular/core/testing';

import { SesionService } from './sesion.service';

describe('SesionService.actualizarDatos', () => {
  let sesion: SesionService;

  beforeEach(() => {
    sesion = TestBed.inject(SesionService);
  });

  it('actualiza el nombre del usuario en sesión sin cambiar la generación', () => {
    sesion.establecer({ id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' });
    const generacion = sesion.generacion();
    sesion.actualizarDatos({ id: 9, email: 'admin@example.com', nombre: 'Admin Nuevo', rol: 'ADMIN' });
    expect(sesion.usuario()?.nombre).toBe('Admin Nuevo');
    expect(sesion.generacion()).toBe(generacion);
    expect(sesion.esAdmin()).toBeTrue();
  });

  it('solo copia los campos de Usuario (no arrastra activo ni fechaCreacion)', () => {
    sesion.establecer({ id: 9, email: 'a@e.es', nombre: 'A', rol: 'ADMIN' });
    sesion.actualizarDatos({
      id: 9, email: 'a@e.es', nombre: 'B', rol: 'ADMIN', activo: true, fechaCreacion: '2026-01-01T00:00:00Z',
    } as never);
    expect(sesion.usuario()).toEqual({ id: 9, email: 'a@e.es', nombre: 'B', rol: 'ADMIN' });
  });

  it('si el usuario es otro, no hace nada', () => {
    sesion.establecer({ id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' });
    sesion.actualizarDatos({ id: 3, email: 'otro@example.com', nombre: 'Otro', rol: 'USER' });
    expect(sesion.usuario()).toEqual({ id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' });
  });

  it('sin sesión, no crea una', () => {
    sesion.limpiar();
    sesion.actualizarDatos({ id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' });
    expect(sesion.usuario()).toBeUndefined();
  });
});
