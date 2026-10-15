import { FormControl, FormGroup } from '@angular/forms';

import { rangoFechasValidator } from './reserva-list.validators';

function grupo(desde: string | null, hasta: string | null): FormGroup {
  return new FormGroup({ fechaDesde: new FormControl(desde), fechaHasta: new FormControl(hasta) });
}

describe('rangoFechasValidator', () => {
  it('hasta anterior a desde es error', () => {
    expect(rangoFechasValidator(grupo('2026-10-05', '2026-10-04'))).toEqual({ rangoFechasInvalido: true });
  });
  it('fechas iguales es válido', () => {
    expect(rangoFechasValidator(grupo('2026-10-05', '2026-10-05'))).toBeNull();
  });
  it('hasta posterior a desde es válido', () => {
    expect(rangoFechasValidator(grupo('2026-10-05', '2026-10-06'))).toBeNull();
  });
  it('invertido entre meses y años es error', () => {
    expect(rangoFechasValidator(grupo('2027-01-01', '2026-12-31'))).toEqual({ rangoFechasInvalido: true });
  });
  it('solo desde informado es válido', () => {
    expect(rangoFechasValidator(grupo('2026-10-05', ''))).toBeNull();
  });
  it('solo hasta informado es válido', () => {
    expect(rangoFechasValidator(grupo('', '2026-10-05'))).toBeNull();
  });
  it('ambas vacías o nulas es válido', () => {
    expect(rangoFechasValidator(grupo('', ''))).toBeNull();
    expect(rangoFechasValidator(grupo(null, null))).toBeNull();
  });
});
