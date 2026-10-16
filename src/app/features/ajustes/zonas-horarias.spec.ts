import { ZONAS_COMUNES, agruparZonas, esZonaAdmitida, zonasDisponibles } from './zonas-horarias';

describe('zonas horarias', () => {
  describe('zonasDisponibles', () => {
    it('devuelve una lista no vacía de zonas válidas', () => {
      const zonas = zonasDisponibles();
      expect(zonas.length).toBeGreaterThan(0);
      expect(zonas).toContain('Europe/Madrid');
    });
    it('usa la lista de respaldo si el navegador no ofrece supportedValuesOf', () => {
      const original = Intl.supportedValuesOf;
      (Intl as unknown as Record<string, unknown>)['supportedValuesOf'] = undefined;
      try {
        const zonas = zonasDisponibles();
        expect(zonas).toContain('Europe/Madrid');
        expect(zonas).toContain('Asia/Tokyo');
        expect(zonas).toContain('Australia/Sydney');
      } finally {
        (Intl as unknown as Record<string, unknown>)['supportedValuesOf'] = original;
      }
    });
    it('usa el respaldo si supportedValuesOf lanza', () => {
      const original = Intl.supportedValuesOf;
      (Intl as unknown as Record<string, unknown>)['supportedValuesOf'] = () => {
        throw new RangeError('no soportado');
      };
      try {
        expect(zonasDisponibles()).toContain('Europe/London');
      } finally {
        (Intl as unknown as Record<string, unknown>)['supportedValuesOf'] = original;
      }
    });
  });

  describe('filtro de zonas admitidas por el servidor', () => {
    function conZonas(zonas: string[], prueba: () => void): void {
      const original = Intl.supportedValuesOf;
      (Intl as unknown as Record<string, unknown>)['supportedValuesOf'] = () => zonas;
      try {
        prueba();
      } finally {
        (Intl as unknown as Record<string, unknown>)['supportedValuesOf'] = original;
      }
    }

    it('Etc/GMT+1 no aparece', () => {
      expect(zonasDisponibles()).not.toContain('Etc/GMT+1');
      conZonas(['Etc/GMT+1', 'Europe/Madrid'], () => {
        expect(zonasDisponibles()).not.toContain('Etc/GMT+1');
      });
    });
    it('solo quedan las Región/Ciudad y UTC', () => {
      conZonas(['Etc/GMT+1', 'Etc/UTC', 'SystemV/AST4', 'GMT0', 'EST5EDT', 'UTC', 'Europe/Madrid'], () => {
        expect(zonasDisponibles()).toEqual(['UTC', 'Europe/Madrid']);
      });
    });
    it('ninguna zona del navegador queda fuera del filtro', () => {
      expect(zonasDisponibles().every(esZonaAdmitida)).toBeTrue();
    });
    it('si el filtro deja la lista vacía usa el respaldo', () => {
      conZonas(['Etc/GMT+1', 'GMT0'], () => {
        expect(zonasDisponibles()).toContain('Europe/Madrid');
      });
    });
    it('esZonaAdmitida', () => {
      expect(esZonaAdmitida('UTC')).toBeTrue();
      expect(esZonaAdmitida('America/Argentina/Buenos_Aires')).toBeTrue();
      expect(esZonaAdmitida('Etc/GMT-3')).toBeFalse();
      expect(esZonaAdmitida('SystemV/EST5')).toBeFalse();
      expect(esZonaAdmitida('GMT0')).toBeFalse();
    });
  });

  describe('agruparZonas', () => {
    it('las comunes incluyen UTC, Madrid, Londres, Nueva York y Tokio', () => {
      for (const zona of ['UTC', 'Europe/Madrid', 'Europe/London', 'America/New_York', 'Asia/Tokyo']) {
        expect(agruparZonas([], 'Europe/Madrid').comunes).toContain(zona);
      }
    });
    it('sin duplicados entre comunes y resto, ni dentro del resto', () => {
      const { comunes, resto } = agruparZonas(['UTC', 'Europe/Madrid', 'Africa/Cairo', 'Africa/Cairo', 'Asia/Tokyo']);
      expect(resto).toEqual(['Africa/Cairo']);
      expect(new Set(comunes).size).toBe(comunes.length);
      expect(comunes.filter((z) => resto.includes(z))).toEqual([]);
    });
    it('el resto va en orden alfabético', () => {
      const { resto } = agruparZonas(['Pacific/Auckland', 'Africa/Cairo', 'Asia/Dubai']);
      expect(resto).toEqual(['Africa/Cairo', 'Asia/Dubai', 'Pacific/Auckland']);
    });
    it('las comunes mantienen su orden', () => {
      expect(agruparZonas([], 'UTC').comunes).toEqual([...ZONAS_COMUNES]);
    });
    it('añade la zona actual desconocida al principio de las comunes', () => {
      const { comunes, resto } = agruparZonas(['Africa/Cairo'], 'Antarctica/Troll');
      expect(comunes[0]).toBe('Antarctica/Troll');
      expect(resto).not.toContain('Antarctica/Troll');
    });
    it('no duplica la zona actual si ya está en comunes o en el resto', () => {
      const enComunes = agruparZonas(['Africa/Cairo'], 'Asia/Tokyo');
      expect(enComunes.comunes.filter((z) => z === 'Asia/Tokyo').length).toBe(1);
      const enResto = agruparZonas(['Africa/Cairo'], 'Africa/Cairo');
      expect(enResto.comunes).not.toContain('Africa/Cairo');
      expect(enResto.resto).toEqual(['Africa/Cairo']);
    });
    it('sin zona actual no añade nada', () => {
      expect(agruparZonas([]).comunes.length).toBe(ZONAS_COMUNES.length);
    });
  });
});
