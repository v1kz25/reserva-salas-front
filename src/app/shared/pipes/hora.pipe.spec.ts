import { HoraPipe } from './hora.pipe';

describe('HoraPipe', () => {
  const pipe = new HoraPipe();

  it('deja HH:mm igual', () => expect(pipe.transform('09:30')).toBe('09:30'));
  it('recorta los segundos', () => expect(pipe.transform('09:30:00')).toBe('09:30'));
  it('devuelve vacío sin valor', () => {
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
  });
});
