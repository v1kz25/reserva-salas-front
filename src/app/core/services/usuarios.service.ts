import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { conErroresPropios } from '../http/errores-propios';
import { UsuarioAdmin, UsuarioCambioRequest, UsuarioNuevoRequest } from '../models/usuario.model';

/**
 * UsuariosService — acceso a los endpoints de gestión de usuarios de la API (solo
 * administradores).
 */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  private readonly url = '/api/usuarios';

  /**
   * Lista todos los usuarios, ordenados por nombre (`GET /api/usuarios`).
   */
  listar(): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(this.url);
  }

  /**
   * Obtiene un usuario por su id (`GET /api/usuarios/{id}`). El `404` lo gestiona quien llama
   * (el interceptor no actúa sobre él).
   *
   * @param id Identificador del usuario.
   */
  obtener(id: number): Observable<UsuarioAdmin> {
    return this.http.get<UsuarioAdmin>(`${this.url}/${id}`);
  }

  /**
   * Crea un usuario (`POST /api/usuarios`). El `400` (datos no válidos) y el `409` (email
   * repetido) los gestiona quien llama, en el propio formulario.
   *
   * @param usuario Datos del usuario.
   */
  crear(usuario: UsuarioNuevoRequest): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(this.url, usuario, { context: conErroresPropios([400, 409]) });
  }

  /**
   * Modifica nombre, rol y estado de un usuario (`PUT /api/usuarios/{id}`). El `400` (datos
   * no válidos), el `404` (el usuario ya no existe) y el `409` (un administrador no puede
   * desactivarse ni quitarse el rol a sí mismo) los gestiona quien llama.
   *
   * @param id Identificador del usuario.
   * @param cambio Datos nuevos del usuario.
   */
  modificar(id: number, cambio: UsuarioCambioRequest): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(`${this.url}/${id}`, cambio, { context: conErroresPropios([400, 404, 409]) });
  }

  /**
   * Cambia la contraseña de un usuario (`PUT /api/usuarios/{id}/password`). El `400`
   * (contraseña no válida) y el `404` (el usuario ya no existe) los gestiona quien llama.
   *
   * @param id Identificador del usuario.
   * @param password Contraseña nueva.
   */
  cambiarPassword(id: number, password: string): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/password`, { password }, { context: conErroresPropios([400, 404]) });
  }
}
