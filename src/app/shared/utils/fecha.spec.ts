import { diaSiguiente, fechaIso } from './fecha';

describe('fecha utils', () => {
  it('fechaIso rellena con ceros', () => {
    expect(fechaIso(new Date(2026, 0, 5, 3, 4))).toBe('2026-01-05');
  });
  it('fechaIso con fecha de dos dígitos', () => {
    expect(fechaIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  describe('diaSiguiente', () => {
    it('día normal', () => {
      expect(fechaIso(diaSiguiente(new Date(2026, 9, 1, 12, 30)))).toBe('2026-10-02');
    });
    it('fin de mes', () => {
      expect(fechaIso(diaSiguiente(new Date(2026, 8, 30)))).toBe('2026-10-01');
    });
    it('fin de año', () => {
      expect(fechaIso(diaSiguiente(new Date(2026, 11, 31, 23, 59)))).toBe('2027-01-01');
    });
    it('febrero de año bisiesto y no bisiesto', () => {
      expect(fechaIso(diaSiguiente(new Date(2028, 1, 28)))).toBe('2028-02-29');
      expect(fechaIso(diaSiguiente(new Date(2027, 1, 28)))).toBe('2027-03-01');
    });
    it('conserva la hora y no muta la fecha original', () => {
      const origen = new Date(2026, 9, 1, 12, 30);
      const sig = diaSiguiente(origen);
      expect(sig.getHours()).toBe(12);
      expect(sig.getMinutes()).toBe(30);
      expect(fechaIso(origen)).toBe('2026-10-01');
    });
    it('sin argumento devuelve mañana', () => {
      const m = new Date();
      m.setDate(m.getDate() + 1);
      expect(fechaIso(diaSiguiente())).toBe(fechaIso(m));
    });
  });
});
