import { Rol } from '../../core/models/usuario.model';

/** Ruta del listado de usuarios de administración. */
export const RUTA_USUARIOS_ADMIN = '/admin/usuarios';

/** Texto visible de cada rol. */
export const NOMBRE_ROL: Readonly<Record<Rol, string>> = {
  USER: 'Usuario',
  ADMIN: 'Administrador',
};

/** Formato de la fecha de alta en el listado (por ejemplo, «15 oct 2026»). */
const FORMATO_FECHA_ALTA = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/**
 * Fecha de alta de un usuario en formato legible, en la zona horaria del navegador.
 * Si el valor no es una fecha válida, lo devuelve sin cambios.
 *
 * @param fechaCreacion Momento del alta (ISO 8601).
 */
export function formatearFechaAlta(fechaCreacion: string): string {
  const fecha = new Date(fechaCreacion);
  return Number.isNaN(fecha.getTime()) ? fechaCreacion : FORMATO_FECHA_ALTA.format(fecha);
}

/**
 * Aviso que se muestra en el listado tras crear un usuario.
 *
 * @param nombre Nombre del usuario creado.
 */
export function avisoUsuarioCreado(nombre: string): string {
  return `Usuario «${nombre}» creado.`;
}

/**
 * Aviso que se muestra en el listado tras modificar un usuario.
 *
 * @param nombre Nombre del usuario modificado.
 */
export function avisoUsuarioModificado(nombre: string): string {
  return `Usuario «${nombre}» guardado.`;
}

/**
 * Aviso que se muestra en el listado tras activar o desactivar un usuario.
 *
 * @param nombre Nombre del usuario.
 * @param activo Estado nuevo del usuario.
 */
export function avisoUsuarioActivado(nombre: string, activo: boolean): string {
  return activo
    ? `Usuario «${nombre}» activado: ya puede iniciar sesión.`
    : `Usuario «${nombre}» desactivado: ya no puede iniciar sesión y se han cerrado sus sesiones abiertas.`;
}

/** Aviso tras cambiar la contraseña de un usuario. */
export const AVISO_PASSWORD_CAMBIADA = 'Contraseña cambiada.';

/** Mensaje en el campo email si ya hay otro usuario con ese email (`409`). */
export const MENSAJE_EMAIL_REPETIDO = 'Ya existe un usuario con ese email.';

/** Mensaje si la contraseña supera los 72 caracteres o los 72 bytes en UTF-8. */
export const MENSAJE_PASSWORD_LARGA =
  'La contraseña es demasiado larga: admite hasta 72 caracteres, menos si lleva tildes, eñes u otros símbolos.';

/** Mensaje en la confirmación si no coincide con la contraseña. */
export const MENSAJE_PASSWORD_NO_COINCIDE = 'Las contraseñas no coinciden.';

/** Mensaje si el usuario ya no existe al editarlo o cambiar su contraseña (`404`). */
export const MENSAJE_USUARIO_NO_EXISTE = 'El usuario no existe: puede que se haya eliminado entretanto.';

/** Explicación de por qué un administrador no puede desactivarse a sí mismo. */
export const MENSAJE_NO_DESACTIVARSE = 'No puedes desactivar tu propia cuenta.';

/** Explicación de por qué un administrador no puede quitarse el rol a sí mismo. */
export const MENSAJE_NO_QUITARSE_ADMIN = 'No puedes quitarte el rol de administrador a ti mismo.';

/** Mensaje si el servidor rechaza un cambio sobre uno mismo (`409`) y no trae detalle. */
export const MENSAJE_CAMBIO_PROPIO_RECHAZADO =
  'Un administrador no puede desactivarse ni quitarse el rol de administrador a sí mismo.';

/** Mensaje si el usuario ya no existe al modificarlo desde el listado (`404`). */
export const MENSAJE_USUARIO_YA_NO_EXISTE =
  'El usuario ya no existe: puede que se haya eliminado entretanto. Se ha actualizado el listado.';

/** Aviso si no se ha podido actualizar el listado tras un cambio (se conservan los usuarios mostrados). */
export const MENSAJE_RECARGA_FALLIDA =
  'No se ha podido actualizar el listado de usuarios: puede que no esté al día. Recarga la página para verlo actualizado.';
