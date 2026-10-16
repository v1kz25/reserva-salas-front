import { HttpTestingController } from '@angular/common/http/testing';

/** URLs de las peticiones que se lanzan en segundo plano y que muchos specs no comprueban. */
const URLS_DE_FONDO: readonly string[] = [
  '/api/invitaciones/pendientes',
  '/api/config/zona-horaria',
  '/api/amistades/solicitudes/recibidas',
  '/api/amistades',
];

/**
 * Descarta (sin responder) las peticiones de fondo abiertas: el recuento de invitaciones
 * pendientes y de solicitudes de amistad recibidas y la zona horaria que se piden al haber
 * sesión, y la lista de
 * amigos del selector de invitaciones. Sirve para los specs que no las comprueban y terminan
 * con `http.verify()` o `http.expectNone(() => true)`.
 *
 * @param http Controlador de peticiones de prueba.
 * @param urls URLs que se descartan (por defecto, todas las de fondo).
 */
export function descartarPeticionesDeFondo(http: HttpTestingController, urls: readonly string[] = URLS_DE_FONDO): void {
  http.match((req) => req.method === 'GET' && urls.includes(req.url));
}

/** Solo el recuento de invitaciones pendientes. */
export const SOLO_INVITACIONES_PENDIENTES: readonly string[] = ['/api/invitaciones/pendientes'];

/** Peticiones que lanza la cabecera al haber sesión, salvo las de amistades: invitaciones pendientes y zona horaria. */
export const PETICIONES_DE_SESION: readonly string[] = ['/api/invitaciones/pendientes', '/api/config/zona-horaria'];
