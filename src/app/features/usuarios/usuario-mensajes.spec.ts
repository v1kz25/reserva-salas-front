import { etiquetaCampo } from './usuario-mensajes';

describe('etiquetaCampo', () => {
  it('devuelve la etiqueta legible de cada campo conocido', () => {
    expect(etiquetaCampo('email')).toBe('Email');
    expect(etiquetaCampo('nombre')).toBe('Nombre');
    expect(etiquetaCampo('password')).toBe('Contraseña');
    expect(etiquetaCampo('rol')).toBe('Rol');
    expect(etiquetaCampo('activo')).toBe('Estado');
  });

  it('un campo desconocido se devuelve sin cambios', () => {
    expect(etiquetaCampo('otro')).toBe('otro');
    expect(etiquetaCampo('')).toBe('');
  });

  it('no confunde propiedades heredadas de Object con campos', () => {
    expect(etiquetaCampo('constructor')).toBe('constructor');
    expect(etiquetaCampo('toString')).toBe('toString');
  });
});
