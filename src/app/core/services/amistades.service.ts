import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { DOCUMENT, DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, catchError, finalize, share, tap } from 'rxjs';

import { conErroresPropios } from '../http/errores-propios';
import { Amigo, SolicitudAmistad, SolicitudAmistadRequest, UsuarioResumen } from '../models/amistad.model';
import { AHORA } from '../tokens/ahora.token';
import { SesionService } from './sesion.service';

/** Tiempo mínimo entre dos recuentos de pendientes al volver a la pestaña (30 s). */
export const INTERVALO_RECUENTO_MS = 30_000;

/** Número de solicitudes recibidas pendientes, ligado a la sesión en la que se obtuvo. */
interface PendientesDeSesion {
  /** Generación de la sesión en la que se contaron. */
  generacion: number;
  /** Número de solicitudes recibidas pendientes. */
  total: number;
}

/**
 * AmistadesService — acceso a los endpoints de amistades y a la búsqueda de usuarios.
 *
 * Guarda además el número de solicitudes recibidas pendientes para el indicador de la
 * cabecera: se pide una vez en cuanto hay sesión (login o comprobación al arrancar), al
 * volver a la pestaña (como mucho una vez cada 30 s) y se actualiza al listar las recibidas
 * y al aceptar o rechazar una. El número se descarta si cambia la sesión (otro login o
 * cierre de sesión). Si ya hay una petición de recibidas en curso, se comparte.
 */
@Injectable({ providedIn: 'root' })
export class AmistadesService {
  /** Último número de solicitudes recibidas pendientes conocido. */
  private readonly _pendientes = signal<PendientesDeSesion | undefined>(undefined);

  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionService);
  private readonly document = inject(DOCUMENT);
  private readonly ahora = inject(AHORA);

  /** Número de solicitudes recibidas pendientes de la sesión actual (0 si no se conoce). */
  readonly pendientes = computed(() => {
    const pendientes = this._pendientes();
    return pendientes?.generacion === this.sesion.generacion() ? pendientes.total : 0;
  });

  private readonly url = '/api/amistades';

  private readonly urlSolicitudes = `${this.url}/solicitudes`;

  /** Petición de recibidas en curso y sesión en la que se lanzó, compartida entre la pantalla y el recuento. */
  private recibidasEnCurso?: { generacion: number; peticion: Observable<SolicitudAmistad[]> };

  /** Momento (ms) del último recuento de pendientes pedido. */
  private ultimoRecuento = 0;

  constructor() {
    const alCambiarVisibilidad = (): void => this.recontarAlVolver();
    this.document.addEventListener('visibilitychange', alCambiarVisibilidad);
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('visibilitychange', alCambiarVisibilidad));

    effect(() => {
      if (this.sesion.estado() !== 'autenticado') {
        return;
      }
      // Una vez por sesión: el efecto solo se repite si cambia la generación o el estado.
      this.sesion.generacion();
      untracked(() => this.contarPendientes());
    });
  }

  /**
   * Busca usuarios por nombre (`GET /api/usuarios/buscar?q=`). Excluye al propio usuario y a
   * los desactivados; como máximo 20 resultados. El `400` (texto fuera de 2 a 100 caracteres)
   * lo gestiona quien llama.
   *
   * @param q Texto a buscar.
   */
  buscarUsuarios(q: string): Observable<UsuarioResumen[]> {
    return this.http.get<UsuarioResumen[]>('/api/usuarios/buscar', {
      params: new HttpParams().set('q', q),
      context: conErroresPropios([400]),
    });
  }

  /**
   * Lista los amigos del usuario en sesión, ordenados por nombre (`GET /api/amistades`).
   */
  listarAmigos(): Observable<Amigo[]> {
    return this.http.get<Amigo[]>(this.url);
  }

  /**
   * Elimina una amistad (`DELETE /api/amistades/{usuarioId}`). El `404` (ya no sois amigos)
   * lo gestiona quien llama.
   *
   * @param usuarioId Identificador del amigo.
   */
  eliminarAmistad(usuarioId: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${usuarioId}`, { context: conErroresPropios([404]) });
  }

  /**
   * Envía una solicitud de amistad (`POST /api/amistades/solicitudes`). El `400` (a ti mismo),
   * el `404` (el usuario no existe o está desactivado) y el `409` (ya sois amigos o ya hay una
   * solicitud pendiente entre vosotros) los gestiona quien llama.
   *
   * @param usuarioId Usuario al que se envía la solicitud.
   */
  enviarSolicitud(usuarioId: number): Observable<SolicitudAmistad> {
    const cuerpo: SolicitudAmistadRequest = { usuarioId };
    return this.http.post<SolicitudAmistad>(this.urlSolicitudes, cuerpo, {
      context: conErroresPropios([400, 404, 409]),
    });
  }

  /**
   * Lista las solicitudes pendientes recibidas, las más recientes primero
   * (`GET /api/amistades/solicitudes/recibidas`), y actualiza el número de pendientes.
   *
   * Si ya hay una petición en curso (por ejemplo, el recuento lanzado al iniciar la sesión),
   * se reutiliza su respuesta; si esa falla, se repite la petición con la gestión de errores
   * habitual del interceptor.
   */
  listarRecibidas(): Observable<SolicitudAmistad[]> {
    const enCurso = this.peticionEnCurso();
    if (enCurso) {
      return enCurso.pipe(catchError(() => this.pedirRecibidas()));
    }
    return this.pedirRecibidas();
  }

  /**
   * Lista las solicitudes pendientes enviadas, las más recientes primero
   * (`GET /api/amistades/solicitudes/enviadas`).
   */
  listarEnviadas(): Observable<SolicitudAmistad[]> {
    return this.http.get<SolicitudAmistad[]>(`${this.urlSolicitudes}/enviadas`);
  }

  /**
   * Retira una solicitud enviada (`DELETE /api/amistades/solicitudes/{id}`). El `404` (ya no
   * está pendiente) lo gestiona quien llama.
   *
   * @param id Identificador de la solicitud.
   */
  retirarSolicitud(id: number): Observable<void> {
    return this.http.delete<void>(`${this.urlSolicitudes}/${id}`, { context: conErroresPropios([404]) });
  }

  /**
   * Acepta una solicitud recibida (`POST /api/amistades/solicitudes/{id}/aceptar`). El `404`
   * (ya no está pendiente) lo gestiona quien llama.
   *
   * @param id Identificador de la solicitud.
   */
  aceptarSolicitud(id: number): Observable<void> {
    const generacion = this.sesion.generacion();
    return this.http
      .post<void>(`${this.urlSolicitudes}/${id}/aceptar`, null, { context: conErroresPropios([404]) })
      .pipe(tap(() => this.descontarPendiente(generacion)));
  }

  /**
   * Rechaza una solicitud recibida (`POST /api/amistades/solicitudes/{id}/rechazar`). El `404`
   * (ya no está pendiente) lo gestiona quien llama.
   *
   * @param id Identificador de la solicitud.
   */
  rechazarSolicitud(id: number): Observable<void> {
    const generacion = this.sesion.generacion();
    return this.http
      .post<void>(`${this.urlSolicitudes}/${id}/rechazar`, null, { context: conErroresPropios([404]) })
      .pipe(tap(() => this.descontarPendiente(generacion)));
  }

  /**
   * Lanza la petición de recibidas y la deja como petición en curso compartida. La respuesta
   * solo actualiza el número de pendientes si la sesión no ha cambiado desde que se pidió.
   *
   * @param context Contexto HTTP (por ejemplo, para que el interceptor no actúe).
   */
  private pedirRecibidas(context?: HttpContext): Observable<SolicitudAmistad[]> {
    const generacion = this.sesion.generacion();
    this.ultimoRecuento = this.ahora().getTime();
    const peticion: Observable<SolicitudAmistad[]> = this.http
      .get<SolicitudAmistad[]>(`${this.urlSolicitudes}/recibidas`, { context })
      .pipe(
        tap((solicitudes) => this.fijarPendientes(solicitudes.length, generacion)),
        finalize(() => {
          if (this.recibidasEnCurso?.peticion === peticion) {
            this.recibidasEnCurso = undefined;
          }
        }),
        share(),
      );
    this.recibidasEnCurso = { generacion, peticion };
    return peticion;
  }

  /** Petición de recibidas en curso lanzada en la sesión actual, si la hay. */
  private peticionEnCurso(): Observable<SolicitudAmistad[]> | undefined {
    const enCurso = this.recibidasEnCurso;
    return enCurso?.generacion === this.sesion.generacion() ? enCurso.peticion : undefined;
  }

  /**
   * Pide las recibidas solo para actualizar el indicador, reutilizando la petición en curso si
   * la hay. Si falla no hace nada visible: el interceptor no actúa sobre ningún error
   * (`'todos'`) y el error se descarta.
   */
  private contarPendientes(): void {
    const peticion = this.peticionEnCurso() ?? this.pedirRecibidas(conErroresPropios('todos'));
    peticion.subscribe({ error: () => undefined });
  }

  /** Al volver a la pestaña, con sesión, recuenta las pendientes si han pasado 30 s desde el último. */
  private recontarAlVolver(): void {
    if (
      this.document.visibilityState === 'visible' &&
      this.sesion.estado() === 'autenticado' &&
      this.ahora().getTime() - this.ultimoRecuento >= INTERVALO_RECUENTO_MS
    ) {
      this.contarPendientes();
    }
  }

  /**
   * Fija el número de pendientes, salvo que la sesión haya cambiado desde que se pidió.
   *
   * @param total Número de solicitudes recibidas pendientes.
   * @param generacion Generación de la sesión cuando se hizo la petición.
   */
  private fijarPendientes(total: number, generacion: number): void {
    if (generacion === this.sesion.generacion()) {
      this._pendientes.set({ generacion, total });
    }
  }

  private descontarPendiente(generacion: number): void {
    this.fijarPendientes(Math.max(0, this.pendientes() - 1), generacion);
  }
}
