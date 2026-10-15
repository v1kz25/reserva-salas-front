import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import { conErroresPropios } from '../http/errores-propios';
import { LoginRequest, Usuario } from '../models/usuario.model';
import { EstadoSesion, SesionService } from './sesion.service';

/**
 * AuthService — acceso a los endpoints de autenticación (`/api/auth/**`) y
 * actualización del estado de la sesión en `SesionService`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionService);

  private readonly url = '/api/auth';

  /**
   * Pide la cookie `XSRF-TOKEN` (`GET /api/auth/csrf`). Angular la lee y la repite en la
   * cabecera `X-XSRF-TOKEN` de los `POST`, `PUT` y `DELETE`. Los errores no se propagan
   * ni los gestiona el interceptor: si falla, la petición protegida dará su propio error.
   */
  obtenerCsrf(): Observable<void> {
    return this.http.get<void>(`${this.url}/csrf`, { context: conErroresPropios('todos') }).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /**
   * Comprueba si hay sesión (`GET /api/auth/me`) y actualiza `SesionService`. Nunca falla:
   * devuelve el estado resultante. Si no hay sesión, pide además el token CSRF para el login.
   * Si el servidor no responde, el estado sigue siendo `desconocido`.
   */
  restaurarSesion(): Observable<EstadoSesion> {
    return this.http.get<Usuario>(`${this.url}/me`, { context: conErroresPropios('todos') }).pipe(
      tap((usuario) => this.sesion.establecer(usuario)),
      map((): EstadoSesion => 'autenticado'),
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.sesion.limpiar();
          return this.obtenerCsrf().pipe(map((): EstadoSesion => 'anonimo'));
        }
        return of<EstadoSesion>('desconocido');
      }),
    );
  }

  /**
   * Inicia sesión (`POST /api/auth/login`), pidiendo antes un token CSRF actualizado.
   * El `401` (credenciales no válidas) y el `400` los gestiona quien llama.
   *
   * @param credenciales Email y contraseña.
   */
  login(credenciales: LoginRequest): Observable<Usuario> {
    return this.obtenerCsrf().pipe(
      switchMap(() =>
        this.http.post<Usuario>(`${this.url}/login`, credenciales, { context: conErroresPropios([400, 401]) }),
      ),
      tap((usuario) => this.sesion.establecer(usuario)),
    );
  }

  /**
   * Cierra la sesión (`POST /api/auth/logout`). Pase lo que pase (`204`, `401`, `403` de
   * CSRF, sin red, `5xx`), limpia el usuario y pide un token CSRF nuevo para el siguiente
   * login: quien pulsa «Salir» siempre acaba fuera. El interceptor no actúa sobre sus errores.
   * Nunca falla.
   */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, null, { context: conErroresPropios('todos') }).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      tap(() => this.sesion.limpiar()),
      switchMap(() => this.obtenerCsrf()),
    );
  }
}
