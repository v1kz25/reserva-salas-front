import {
  diaSiguienteIso,
  esZonaValida,
  fechaIso,
  fechaIsoEnZona,
  fechaLegible,
  horaEnZona,
  zonaNavegador,
} from './fecha';

describe('fecha utils', () => {
  it('fechaIso rellena con ceros', () => {
    expect(fechaIso(new Date(2026, 0, 5, 3, 4))).toBe('2026-01-05');
  });
  it('fechaIso con fecha de dos dígitos', () => {
    expect(fechaIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('fecha utils con zona horaria', () => {
  const utc = (iso: string) => new Date(iso);
  const manana = (iso: string, zona?: string) => diaSiguienteIso(fechaIsoEnZona(utc(iso), zona));

  describe('esZonaValida', () => {
    it('acepta identificadores IANA', () => {
      expect(esZonaValida('Europe/Madrid')).toBeTrue();
      expect(esZonaValida('UTC')).toBeTrue();
      expect(esZonaValida('America/Argentina/Buenos_Aires')).toBeTrue();
    });
    it('rechaza vacío, undefined y basura', () => {
      expect(esZonaValida(undefined)).toBeFalse();
      expect(esZonaValida('')).toBeFalse();
      expect(esZonaValida('Mars/Olympus')).toBeFalse();
      expect(esZonaValida('no es una zona')).toBeFalse();
    });
  });

  it('zonaNavegador devuelve una zona válida', () => {
    expect(esZonaValida(zonaNavegador())).toBeTrue();
  });

  describe('fechaIsoEnZona', () => {
    it('cruza el día: Madrid ya es 16 y Nueva York sigue en 15', () => {
      const instante = utc('2026-10-15T23:30:00Z');
      expect(fechaIsoEnZona(instante, 'Europe/Madrid')).toBe('2026-10-16');
      expect(fechaIsoEnZona(instante, 'America/New_York')).toBe('2026-10-15');
      expect(fechaIsoEnZona(instante, 'UTC')).toBe('2026-10-15');
    });
    it('Tokio adelanta el día; Nueva York lo retrasa', () => {
      expect(fechaIsoEnZona(utc('2026-10-15T15:00:00Z'), 'Asia/Tokyo')).toBe('2026-10-16');
      expect(fechaIsoEnZona(utc('2026-10-15T14:59:00Z'), 'Asia/Tokyo')).toBe('2026-10-15');
      expect(fechaIsoEnZona(utc('2026-10-15T01:00:00Z'), 'Asia/Tokyo')).toBe('2026-10-15');
      expect(fechaIsoEnZona(utc('2026-10-15T01:00:00Z'), 'America/New_York')).toBe('2026-10-14');
    });
    it('rellena con ceros mes y día', () => {
      expect(fechaIsoEnZona(utc('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
    });
    it('sin zona o con zona no válida usa la del navegador', () => {
      const fecha = new Date(2026, 9, 15, 12, 0);
      expect(fechaIsoEnZona(fecha)).toBe('2026-10-15');
      expect(fechaIsoEnZona(fecha, 'Mars/Olympus')).toBe('2026-10-15');
      expect(fechaIsoEnZona(fecha, '')).toBe('2026-10-15');
    });
    it('cambio de hora de octubre en Madrid (25/10/2026)', () => {
      // Antes del cambio: UTC+2. Después: UTC+1.
      expect(fechaIsoEnZona(utc('2026-10-24T21:59:00Z'), 'Europe/Madrid')).toBe('2026-10-24');
      expect(fechaIsoEnZona(utc('2026-10-24T22:00:00Z'), 'Europe/Madrid')).toBe('2026-10-25');
      // Hora repetida (02:30 CEST y 02:30 CET): sigue siendo día 25.
      expect(fechaIsoEnZona(utc('2026-10-25T00:30:00Z'), 'Europe/Madrid')).toBe('2026-10-25');
      expect(fechaIsoEnZona(utc('2026-10-25T01:30:00Z'), 'Europe/Madrid')).toBe('2026-10-25');
      // Tras el cambio la medianoche llega a las 23:00Z, no a las 22:00Z.
      expect(fechaIsoEnZona(utc('2026-10-25T22:59:00Z'), 'Europe/Madrid')).toBe('2026-10-25');
      expect(fechaIsoEnZona(utc('2026-10-25T23:00:00Z'), 'Europe/Madrid')).toBe('2026-10-26');
    });
  });

  describe('diaSiguienteIso', () => {
    it('día normal', () => expect(diaSiguienteIso('2026-10-15')).toBe('2026-10-16'));
    it('fin de mes', () => {
      expect(diaSiguienteIso('2026-09-30')).toBe('2026-10-01');
      expect(diaSiguienteIso('2026-01-31')).toBe('2026-02-01');
    });
    it('fin de año', () => expect(diaSiguienteIso('2026-12-31')).toBe('2027-01-01'));
    it('febrero bisiesto y no bisiesto', () => {
      expect(diaSiguienteIso('2028-02-28')).toBe('2028-02-29');
      expect(diaSiguienteIso('2028-02-29')).toBe('2028-03-01');
      expect(diaSiguienteIso('2027-02-28')).toBe('2027-03-01');
    });
    it('no depende del cambio de hora', () => {
      expect(diaSiguienteIso('2026-10-25')).toBe('2026-10-26');
      expect(diaSiguienteIso('2026-03-29')).toBe('2026-03-30');
    });
  });

  describe('cálculo de «mañana» por zona con reloj fijo', () => {
    it('2026-10-15T23:30Z: Madrid → 17, Nueva York → 16', () => {
      expect(manana('2026-10-15T23:30:00Z', 'Europe/Madrid')).toBe('2026-10-17');
      expect(manana('2026-10-15T23:30:00Z', 'America/New_York')).toBe('2026-10-16');
    });
    it('2026-10-15T01:00Z con Tokio → 16 (ya es 10:00 del 15)', () => {
      expect(manana('2026-10-15T01:00:00Z', 'Asia/Tokyo')).toBe('2026-10-16');
    });
    it('2026-10-15T16:00Z con Tokio → 17 (ya es 01:00 del 16)', () => {
      expect(manana('2026-10-15T16:00:00Z', 'Asia/Tokyo')).toBe('2026-10-17');
    });
    it('cambio de hora en Madrid: 25/10 23:30 local → mañana 26', () => {
      expect(manana('2026-10-25T22:30:00Z', 'Europe/Madrid')).toBe('2026-10-26');
      expect(manana('2026-10-25T23:30:00Z', 'Europe/Madrid')).toBe('2026-10-27');
    });
    it('fin de año según la zona', () => {
      expect(manana('2026-12-31T23:30:00Z', 'Europe/Madrid')).toBe('2027-01-02');
      expect(manana('2026-12-31T23:30:00Z', 'America/New_York')).toBe('2027-01-01');
    });
  });

  describe('fechaLegible', () => {
    it('convierte a dd/MM/yyyy', () => {
      expect(fechaLegible('2026-10-05')).toBe('05/10/2026');
    });
  });
});

describe('horaEnZona', () => {
  // 2026-10-10T23:30:00Z: en Kiritimati (UTC+14) ya es el 11 a las 13:30; en Los Ángeles (UTC-7), el 10 a las 16:30.
  const instante = new Date('2026-10-10T23:30:00Z');

  it('devuelve la hora HH:mm en una zona por delante de UTC, cruzando al día siguiente', () => {
    expect(horaEnZona(instante, 'Pacific/Kiritimati')).toBe('13:30');
    expect(fechaIsoEnZona(instante, 'Pacific/Kiritimati')).toBe('2026-10-11');
  });

  it('devuelve la hora HH:mm en una zona por detrás de UTC', () => {
    expect(horaEnZona(instante, 'America/Los_Angeles')).toBe('16:30');
    expect(fechaIsoEnZona(instante, 'America/Los_Angeles')).toBe('2026-10-10');
  });

  it('la medianoche se escribe 00:00, no 24:00', () => {
    expect(horaEnZona(new Date('2026-10-10T00:00:00Z'), 'UTC')).toBe('00:00');
  });

  it('rellena con ceros horas y minutos', () => {
    expect(horaEnZona(new Date('2026-10-10T07:05:00Z'), 'UTC')).toBe('07:05');
  });

  it('sin zona, o con una zona no válida, usa la del navegador', () => {
    const local = new Date(2026, 9, 10, 9, 7);
    expect(horaEnZona(local)).toBe('09:07');
    expect(horaEnZona(local, 'No/Existe')).toBe('09:07');
  });
});
