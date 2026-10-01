import { ErrorGrave } from './problem-detail';

/** Nombre del query param con la URL de origen para «Reintentar». */
export const PARAM_RETURN_URL = 'returnUrl';

/** Ruta a la que se vuelve si no hay URL de origen válida. */
export const RUTA_INICIO = '/reservas';

/** Ruta de la página propia de cada tipo de error grave. */
export const RUTA_ERROR: Readonly<Record<ErrorGrave, string>> = {
  'no-disponible': '/error/no-disponible',
  inesperado: '/error/inesperado',
  'sin-permiso': '/error/sin-permiso',
};

/** Ruta de la página de «no encontrado». */
export const RUTA_NO_ENCONTRADO = '/no-encontrado';

/**
 * Indica si una URL interna corresponde a una página de error (incluida «no encontrado»).
 *
 * @param url URL interna, por ejemplo `/error/no-disponible?returnUrl=%2Freservas`.
 */
export function esRutaDeError(url: string): boolean {
  const ruta = url.split(/[?#]/, 1)[0];
  return ruta === '/error' || ruta.startsWith('/error/') || ruta === RUTA_NO_ENCONTRADO;
}

/**
 * Valida una URL de origen: solo se aceptan rutas internas de la aplicación
 * (empiezan por una única `/`, sin esquema ni host) que no sean páginas de error.
 *
 * @param valor Valor recibido (por ejemplo, del query param `returnUrl`).
 * @returns La ruta si es válida o `undefined` si no lo es.
 */
export function rutaInternaSegura(valor: string | null | undefined): string | undefined {
  if (!valor || !valor.startsWith('/')) {
    return undefined;
  }
  if (valor.startsWith('//') || valor.includes('\\') || tieneCaracteresDeControl(valor)) {
    return undefined;
  }
  if (esRutaDeError(valor)) {
    return undefined;
  }
  return valor;
}

function tieneCaracteresDeControl(valor: string): boolean {
  return Array.from(valor).some((caracter) => caracter.charCodeAt(0) < 0x20 || caracter.charCodeAt(0) === 0x7f);
}
