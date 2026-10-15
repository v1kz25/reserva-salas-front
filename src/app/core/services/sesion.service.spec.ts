import { TestBed } from '@angular/core/testing';

import { Usuario } from '../models/usuario.model';
import { SesionService } from './sesion.service';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const ADMIN: Usuario = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

describe('SesionService', () => {
  let sesion: SesionService;

  beforeEach(() => {
    sesion = TestBed.inject(SesionService);
  });

  it('al inicio no hay usuario y el estado es «desconocido»', () => {
    expect(sesion.usuario()).toBeUndefined();
    expect(sesion.autenticado()).toBeFalse();
    expect(sesion.esAdmin()).toBeFalse();
    expect(sesion.estado()).toBe('desconocido');
  });

  it('establecer() deja la sesión iniciada', () => {
    sesion.establecer(ANA);
    expect(sesion.usuario()).toEqual(ANA);
    expect(sesion.autenticado()).toBeTrue();
    expect(sesion.esAdmin()).toBeFalse();
    expect(sesion.estado()).toBe('autenticado');
  });

  it('esAdmin() solo es true con el rol ADMIN', () => {
    sesion.establecer(ADMIN);
    expect(sesion.esAdmin()).toBeTrue();
  });

  it('limpiar() confirma que no hay sesión: estado «anonimo»', () => {
    sesion.establecer(ANA);
    sesion.limpiar();
    expect(sesion.usuario()).toBeUndefined();
    expect(sesion.autenticado()).toBeFalse();
    expect(sesion.esAdmin()).toBeFalse();
    expect(sesion.estado()).toBe('anonimo');
  });

  it('limpiar() sin sesión previa también deja «anonimo»', () => {
    sesion.limpiar();
    expect(sesion.estado()).toBe('anonimo');
  });

  it('un nuevo establecer() sustituye al usuario anterior (cambio de usuario)', () => {
    sesion.establecer(ADMIN);
    sesion.establecer(ANA);
    expect(sesion.esAdmin()).toBeFalse();
    expect(sesion.usuario()?.id).toBe(1);
  });

  describe('puedeGestionar', () => {
    it('sin sesión: false', () => {
      expect(sesion.puedeGestionar(1)).toBeFalse();
    });

    it('sin sesión confirmada (anónimo): false', () => {
      sesion.limpiar();
      expect(sesion.puedeGestionar(1)).toBeFalse();
    });

    it('usuario normal: true solo con sus propios recursos', () => {
      sesion.establecer(ANA);
      expect(sesion.puedeGestionar(1)).toBeTrue();
      expect(sesion.puedeGestionar(2)).toBeFalse();
    });

    it('administrador: true con cualquier recurso', () => {
      sesion.establecer(ADMIN);
      expect(sesion.puedeGestionar(1)).toBeTrue();
      expect(sesion.puedeGestionar(9)).toBeTrue();
      expect(sesion.puedeGestionar(12345)).toBeTrue();
    });
  });
});
