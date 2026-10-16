import { Injectable, computed, signal } from '@angular/core';

import { Usuario } from '../models/usuario.model';

/**
 * Estado de la sesión en el cliente:
 *
 * - `desconocido`: aún no se ha comprobado o la comprobación falló (sin red, 5xx…).
 * - `anonimo`: el servidor ha confirmado que no hay sesión (`401`).
 * - `autenticado`: hay un usuario en sesión.
 */
export type EstadoSesion = 'desconocido' | 'anonimo' | 'autenticado';

/**
 * SesionService — guarda en memoria el usuario de la sesión actual. No hace peticiones:
 * las hace `AuthService`, y el interceptor de errores lo limpia ante un `401`.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  /** Usuario autenticado, si lo hay. */
  private readonly _usuario = signal<Usuario | undefined>(undefined);

  /** Indica si el servidor ya ha respondido a la comprobación de la sesión. */
  private readonly _comprobada = signal(false);

  /** Contador que cambia cada vez que se establece o se limpia la sesión. */
  private readonly _generacion = signal(0);

  /** Usuario autenticado (solo lectura). */
  readonly usuario = this._usuario.asReadonly();

  /** Indica si hay un usuario en sesión. */
  readonly autenticado = computed(() => this._usuario() !== undefined);

  /** Indica si el usuario en sesión es administrador. */
  readonly esAdmin = computed(() => this._usuario()?.rol === 'ADMIN');

  /**
   * Generación de la sesión: cambia en cada `establecer` y `limpiar`. Sirve para saber si
   * un `401` llega de una petición lanzada con una sesión anterior.
   */
  readonly generacion = this._generacion.asReadonly();

  /** Estado de la sesión (ver `EstadoSesion`). */
  readonly estado = computed<EstadoSesion>(() => {
    if (this._usuario()) {
      return 'autenticado';
    }
    return this._comprobada() ? 'anonimo' : 'desconocido';
  });

  /**
   * Guarda el usuario autenticado.
   *
   * @param usuario Usuario devuelto por el servidor.
   */
  establecer(usuario: Usuario): void {
    this._usuario.set(usuario);
    this._comprobada.set(true);
    this._generacion.update((n) => n + 1);
  }

  /**
   * Actualiza los datos del usuario en sesión (por ejemplo, su nombre tras editarlo en la
   * gestión de usuarios) sin cambiar de sesión: no altera la generación. Si no hay sesión
   * o el usuario es otro, no hace nada.
   *
   * @param usuario Datos actualizados del usuario.
   */
  actualizarDatos(usuario: Usuario): void {
    const actual = this._usuario();
    if (actual?.id === usuario.id) {
      this._usuario.set({ id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol });
    }
  }

  /**
   * Borra el usuario: el servidor ha confirmado que no hay sesión.
   */
  limpiar(): void {
    this._usuario.set(undefined);
    this._comprobada.set(true);
    this._generacion.update((n) => n + 1);
  }

  /**
   * Indica si el usuario puede gestionar un recurso: si es suyo o si es administrador. Si no
   * se conoce el propietario (por ejemplo, una reserva vista como «Ocupada»), devuelve `false`.
   *
   * @param usuarioId Usuario propietario del recurso.
   */
  puedeGestionar(usuarioId?: number): boolean {
    const usuario = this._usuario();
    return (
      usuario !== undefined && usuarioId !== undefined && (usuario.rol === 'ADMIN' || usuario.id === usuarioId)
    );
  }

  /**
   * Indica si el usuario en sesión es el indicado (por ejemplo, el organizador de una reserva).
   *
   * @param usuarioId Usuario con el que se compara.
   */
  esUsuario(usuarioId?: number): boolean {
    return usuarioId !== undefined && this._usuario()?.id === usuarioId;
  }
}
