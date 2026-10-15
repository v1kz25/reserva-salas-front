import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, share, switchMap, tap, throwError, timeout } from 'rxjs';

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

  /** Tiempo máximo de espera de `GET /api/auth/me`, para que la app no se quede en blanco al arrancar. */
  private readonly esperaMaximaMe = 5000;
  /** Comprobación de la sesión en curso, compartida por quienes la piden a la vez (p. ej. dos guards). */
  private restauracionEnCurso?: Observable<EstadoSesion>;

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
   * Si el servidor no responde (error o más de 5 s), el estado sigue siendo `desconocido`. Si ya hay una
   * comprobación en curso, se comparte en lugar de lanzar otra petición.
   */
  restaurarSesion(): Observable<EstadoSesion> {
    this.restauracionEnCurso ??= this.comprobarSesion().pipe(
      finalize(() => (this.restauracionEnCurso = undefined)),
      share(),
    );
    return this.restauracionEnCurso;
  }

  /**
   * Inicia sesión (`POST /api/auth/login`), pidiendo antes un token CSRF actualizado.
   * Si responde `403` (token CSRF no válido), renueva el token y reintenta una sola vez.
   * El `400`, el `401` (credenciales no válidas) y el `403` del reintento los gestiona quien llama.
   *
   * @param credenciales Email y contraseña.
   */
  login(credenciales: LoginRequest): Observable<Usuario> {
    const enviar = () => this.obtenerCsrf().pipe(switchMap(() => this.postLogin(credenciales)));
    return enviar().pipe(
      catchError((err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 403 ? enviar() : throwError(() => err),
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

  private postLogin(credenciales: LoginRequest): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.url}/login`, credenciales, {
      context: conErroresPropios([400, 401, 403]),
    });
  }

  /** Pide al servidor el usuario de la sesión y actualiza `SesionService` (ver `restaurarSesion`). */
  private comprobarSesion(): Observable<EstadoSesion> {
    return this.http.get<Usuario>(`${this.url}/me`, { context: conErroresPropios('todos') }).pipe(
      timeout(this.esperaMaximaMe),
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
}
