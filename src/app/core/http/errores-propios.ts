import { HttpContext, HttpContextToken, HttpRequest } from '@angular/common/http';

/**
 * Estados HTTP de error que gestiona quien hace la petición, en lugar del
 * interceptor de errores. Con `'todos'`, el interceptor no actúa sobre ningún error.
 *
 * Por defecto es una lista vacía: el interceptor gestiona `0`, `401`, `403` y `5xx`.
 */
export const ERRORES_PROPIOS = new HttpContextToken<readonly number[] | 'todos'>(() => []);

/**
 * Crea un contexto HTTP que indica al interceptor de errores qué estados gestiona el llamador.
 *
 * @param estados Estados HTTP que gestiona el llamador, o `'todos'`.
 */
export function conErroresPropios(estados: readonly number[] | 'todos'): HttpContext {
  return new HttpContext().set(ERRORES_PROPIOS, estados);
}

/**
 * Indica si el llamador de una petición gestiona un estado de error concreto.
 *
 * @param req Petición original.
 * @param estado Estado HTTP de la respuesta de error.
 */
export function esErrorPropio(req: HttpRequest<unknown>, estado: number): boolean {
  const propios = req.context.get(ERRORES_PROPIOS);
  return propios === 'todos' || propios.includes(estado);
}
