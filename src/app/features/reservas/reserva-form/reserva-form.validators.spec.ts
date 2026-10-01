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
