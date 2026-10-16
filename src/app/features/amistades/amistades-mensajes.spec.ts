import { textoPendientes } from './amistades-mensajes';

describe('textoPendientes', () => {
  it('usa el singular con 1', () => {
    expect(textoPendientes(1)).toBe('(1 solicitud pendiente)');
  });

  it('usa el plural con 0 y con más de 1', () => {
    expect(textoPendientes(0)).toBe('(0 solicitudes pendientes)');
    expect(textoPendientes(3)).toBe('(3 solicitudes pendientes)');
  });
});
