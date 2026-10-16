import { FormControl, FormGroup } from '@angular/forms';

import { aPartirDeMananaValidator, horaFinPosteriorValidator } from './reserva-form.validators';

function grupo(fecha: string, horaInicio: string, horaFin = '23:59'): FormGroup {
  return new FormGroup({
    fecha: new FormControl(fecha),
    horaInicio: new FormControl(horaInicio),
    horaFin: new FormControl(horaFin),
  });
}

describe('horaFinPosteriorValidator', () => {
  it('fin posterior es válido', () => {
    expect(horaFinPosteriorValidator(grupo('', '09:00', '10:00'))).toBeNull();
  });
  it('fin igual a inicio es error', () => {
    expect(horaFinPosteriorValidator(grupo('', '09:00', '09:00'))).toEqual({ horaFinNoPosterior: true });
  });
  it('fin anterior a inicio es error', () => {
    expect(horaFinPosteriorValidator(grupo('', '10:00', '09:59'))).toEqual({ horaFinNoPosterior: true });
  });
  it('fin un minuto posterior es válido', () => {
    expect(horaFinPosteriorValidator(grupo('', '09:00', '09:01'))).toBeNull();
  });
  it('sin horas informadas no valida', () => {
    expect(horaFinPosteriorValidator(grupo('', '', ''))).toBeNull();
    expect(horaFinPosteriorValidator(grupo('', '09:00', ''))).toBeNull();
  });
});

describe('aPartirDeMananaValidator', () => {
  const ahora = () => new Date(2026, 9, 1, 12, 30);
  const validar = aPartirDeMananaValidator(ahora);
  const fecha = (valor: string) => new FormControl(valor);

  it('fecha anterior a hoy es error', () => {
    expect(validar(fecha('2026-09-30'))).toEqual({ fechaNoPosteriorAHoy: true });
  });
  it('hoy es error', () => {
    expect(validar(fecha('2026-10-01'))).toEqual({ fechaNoPosteriorAHoy: true });
  });
  it('mañana es válido', () => {
    expect(validar(fecha('2026-10-02'))).toBeNull();
  });
  it('sin fecha no valida', () => {
    expect(validar(fecha(''))).toBeNull();
  });
  it('por defecto usa el reloj real: ayer es error', () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const y = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
    expect(aPartirDeMananaValidator()(fecha(y))).toEqual({ fechaNoPosteriorAHoy: true });
  });
});

describe('aPartirDeMananaValidator con zona horaria', () => {
  const control = (valor: string) => new FormControl(valor);
  const validar = (valor: string, ahora: string, zona?: string) =>
    aPartirDeMananaValidator(
      () => new Date(ahora),
      () => zona,
    )(control(valor));

  it('2026-10-15T23:30Z en Madrid ya es día 16: el 16 no vale y el 17 sí', () => {
    expect(validar('2026-10-16', '2026-10-15T23:30:00Z', 'Europe/Madrid')).toEqual({ fechaNoPosteriorAHoy: true });
    expect(validar('2026-10-17', '2026-10-15T23:30:00Z', 'Europe/Madrid')).toBeNull();
  });
  it('2026-10-15T23:30Z en Nueva York es día 15: el 16 ya vale', () => {
    expect(validar('2026-10-15', '2026-10-15T23:30:00Z', 'America/New_York')).toEqual({ fechaNoPosteriorAHoy: true });
    expect(validar('2026-10-16', '2026-10-15T23:30:00Z', 'America/New_York')).toBeNull();
  });
  it('Tokio a 01:00Z: hoy es 15, el 16 vale', () => {
    expect(validar('2026-10-15', '2026-10-15T01:00:00Z', 'Asia/Tokyo')).toEqual({ fechaNoPosteriorAHoy: true });
    expect(validar('2026-10-16', '2026-10-15T01:00:00Z', 'Asia/Tokyo')).toBeNull();
  });
  it('cambio de hora en Madrid: 23:30Z del 25/10 ya es día 26', () => {
    expect(validar('2026-10-26', '2026-10-25T23:30:00Z', 'Europe/Madrid')).toEqual({ fechaNoPosteriorAHoy: true });
    expect(validar('2026-10-27', '2026-10-25T23:30:00Z', 'Europe/Madrid')).toBeNull();
  });
  it('lee la zona en cada validación (cambia en caliente)', () => {
    let zona = 'Europe/Madrid';
    const v = aPartirDeMananaValidator(() => new Date('2026-10-15T23:30:00Z'), () => zona);
    expect(v(control('2026-10-16'))).not.toBeNull();
    zona = 'America/New_York';
    expect(v(control('2026-10-16'))).toBeNull();
  });
  it('zona no válida o ausente: usa la del navegador', () => {
    const ahora = new Date(2026, 9, 15, 12, 0);
    for (const zona of [undefined, 'Mars/Olympus']) {
      const v = aPartirDeMananaValidator(() => ahora, () => zona);
      expect(v(control('2026-10-15'))).not.toBeNull();
      expect(v(control('2026-10-16'))).toBeNull();
    }
  });
  it('valor vacío no se valida', () => {
    expect(validar('', '2026-10-15T23:30:00Z', 'Europe/Madrid')).toBeNull();
  });
});
