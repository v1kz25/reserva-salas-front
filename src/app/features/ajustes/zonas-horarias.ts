/**
 * Zonas horarias que se muestran destacadas al principio del selector, en este orden.
 */
export const ZONAS_COMUNES: readonly string[] = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Argentina/Buenos_Aires',
  'Asia/Tokyo',
];

/** Lista corta de respaldo si el navegador no ofrece `Intl.supportedValuesOf('timeZone')`. */
const ZONAS_RESPALDO: readonly string[] = [
  ...ZONAS_COMUNES,
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Lima',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Brussels',
  'Europe/Dublin',
  'Europe/Moscow',
  'Europe/Warsaw',
  'Pacific/Auckland',
];

/** Zonas del selector, separadas en las comunes (destacadas) y el resto. */
export interface GruposZonas {
  /** Zonas destacadas al principio. */
  comunes: string[];
  /** Resto de zonas, en orden alfabético. */
  resto: string[];
}

/**
 * Indica si el servidor admite un identificador de zona: `UTC` o uno con forma
 * Región/Ciudad, sin los prefijos `Etc/` ni `SystemV/` (se descartan también alias
 * como `GMT0` o `EST5EDT`).
 *
 * @param zona Identificador IANA.
 */
export function esZonaAdmitida(zona: string): boolean {
  if (zona === 'UTC') {
    return true;
  }
  return zona.includes('/') && !zona.startsWith('Etc/') && !zona.startsWith('SystemV/');
}

/**
 * Devuelve las zonas horarias IANA que admite el navegador y el servidor o, si no puede
 * saberlo, una lista corta de respaldo.
 */
export function zonasDisponibles(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const zonas = Intl.supportedValuesOf('timeZone').filter(esZonaAdmitida);
      if (zonas.length > 0) {
        return zonas;
      }
    }
  } catch {
    // Navegador sin soporte: se usa la lista de respaldo.
  }
  return [...ZONAS_RESPALDO];
}

/**
 * Separa las zonas en comunes y resto, sin repetidas. La zona actual se añade a las
 * comunes si no está en ninguna de las dos listas (por ejemplo, un alias que el
 * navegador no incluye).
 *
 * @param todas Zonas disponibles.
 * @param actual Zona configurada actualmente.
 */
export function agruparZonas(todas: readonly string[], actual?: string): GruposZonas {
  const comunes = [...ZONAS_COMUNES];
  const resto = [...new Set(todas)].filter((zona) => !comunes.includes(zona)).sort((a, b) => a.localeCompare(b));
  if (actual && !comunes.includes(actual) && !resto.includes(actual)) {
    comunes.unshift(actual);
  }
  return { comunes, resto };
}
