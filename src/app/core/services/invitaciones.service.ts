import { HttpClient, HttpContext } from '@angular/common/http';
import { DOCUMENT, DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, catchError, finalize, share, tap } from 'rxjs';

import { conErroresPropios } from '../http/errores-propios';
import { Invitacion, InvitacionRecibida, InvitacionRequest } from '../models/invitacion.model';
import { AHORA } from '../tokens/ahora.token';
import { INTERVALO_RECUENTO_MS } from './amistades.service';
import { SesionService } from './sesion.service';

/** Prefijo de la clave de `localStorage` con las invitaciones pendientes ya vistas por cada usuario. */
export const CLAVE_INVITACIONES_VISTAS = 'reserva-salas.invitaciones-vistas.';

/** Invitaciones pendientes recibidas, ligadas a la sesión en la que se obtuvieron. */
interface PendientesDeSesion {
  /** Generación de la sesión en la que se pidieron. */
  generacion: number;
  /** Invitaciones pendientes. */
  invitaciones: InvitacionRecibida[];
}

/**
 * InvitacionesService — acceso a los endpoints de invitaciones a reservas.
 *
 * Guarda además las invitaciones pendientes recibidas, para el indicador de la cabecera y
 * para separar en «Mis reservas» las invitaciones aceptadas de las pendientes. Igual que las
 * solicitudes de amistad, se piden una vez en cuanto hay sesión, al volver a la pestaña (como
 * mucho una vez cada 30 s) y se actualizan al listarlas y al aceptar o rechazar una. Se
 * descartan si cambia la sesión. Si ya hay una petición de pendientes en curso, se comparte.
 *
 * También recuerda (en `localStorage`, por usuario) qué invitaciones pendientes ha visto ya
 * el usuario, para marcar como «nuevas» las demás.
 */
@Injectable({ providedIn: 'root' })
export class InvitacionesService {
  /** Últimas invitaciones pendientes conocidas. */
  private readonly _pendientes = signal<PendientesDeSesion | undefined>(undefined);

  /** Ids de las invitaciones pendientes ya vistas y usuario al que pertenecen (se leen al usarlas). */
  private vistasDe?: { usuarioId: number; ids: ReadonlySet<number> };

  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionService);
  private readonly document = inject(DOCUMENT);
  private readonly ahora = inject(AHORA);

  /** Invitaciones pendientes de la sesión actual; `undefined` si aún no se conocen. */
  readonly pendientes = computed(() => {
    const pendientes = this._pendientes();
    return pendientes?.generacion === this.sesion.generacion() ? pendientes.invitaciones : undefined;
  });

  /** Número de invitaciones pendientes de la sesión actual (0 si no se conoce). */
  readonly numeroPendientes = computed(() => this.pendientes()?.length ?? 0);

  private readonly urlReservas = '/api/reservas';

  private readonly urlInvitaciones = '/api/invitaciones';

  /** Petición de pendientes en curso y sesión en la que se lanzó. */
  private pendientesEnCurso?: { generacion: number; peticion: Observable<InvitacionRecibida[]> };

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
      untracked(() => {
        // Las vistas se vuelven a leer de `localStorage` en cada sesión (pueden venir de otra pestaña).
        this.vistasDe = undefined;
        this.contarPendientes();
      });
    });
  }

  /**
   * Invita a un amigo a una reserva (`POST /api/reservas/{id}/invitaciones`). El `400` (a ti
   * mismo), el `403` (no eres el organizador) y el `409` (no es tu amigo, ya está invitado, se
   * supera el aforo o la reserva ya ha pasado) los gestiona quien llama.
   *
   * @param reservaId Reserva a la que se invita.
   * @param usuarioId Amigo al que se invita.
   */
  invitar(reservaId: number, usuarioId: number): Observable<Invitacion> {
    const cuerpo: InvitacionRequest = { usuarioId };
    return this.http.post<Invitacion>(`${this.urlReservas}/${reservaId}/invitaciones`, cuerpo, {
      context: conErroresPropios([400, 403, 409]),
    });
  }

  /**
   * Retira una invitación (`DELETE /api/reservas/{id}/invitaciones/{invitacionId}`). El `403`
   * (no eres el organizador) y el `404` (ya no existe) los gestiona quien llama.
   *
   * @param reservaId Reserva de la invitación.
   * @param invitacionId Invitación que se retira.
   */
  retirar(reservaId: number, invitacionId: number): Observable<void> {
    return this.http.delete<void>(`${this.urlReservas}/${reservaId}/invitaciones/${invitacionId}`, {
      context: conErroresPropios([403, 404]),
    });
  }

  /**
   * Lista las invitaciones pendientes recibidas, ordenadas por fecha de la reserva
   * (`GET /api/invitaciones/pendientes`), y actualiza las guardadas.
   *
   * Si ya hay una petición en curso (por ejemplo, el recuento lanzado al iniciar la sesión u
   * otra pantalla), se reutiliza su respuesta; si esa falla, se repite la petición con la
   * gestión de errores habitual del interceptor.
   */
  listarPendientes(): Observable<InvitacionRecibida[]> {
    const enCurso = this.peticionEnCurso();
    if (enCurso) {
      return enCurso.pipe(catchError(() => this.pedirPendientes()));
    }
    return this.pedirPendientes();
  }

  /**
   * Acepta una invitación pendiente (`POST /api/invitaciones/{id}/aceptar`). El `404` (no
   * existe o no es tuya) y el `409` (ya no está pendiente o la reserva ya ha pasado) los
   * gestiona quien llama.
   *
   * @param id Identificador de la invitación.
   */
  aceptar(id: number): Observable<void> {
    const generacion = this.sesion.generacion();
    return this.http
      .post<void>(`${this.urlInvitaciones}/${id}/aceptar`, null, { context: conErroresPropios([404, 409]) })
      .pipe(tap(() => this.quitarPendiente(id, generacion)));
  }

  /**
   * Rechaza una invitación pendiente o deja de asistir a una ya aceptada
   * (`POST /api/invitaciones/{id}/rechazar`). El `404` (no existe o no es tuya) y el `409` (ya
   * estaba rechazada o la reserva ya ha pasado) los gestiona quien llama.
   *
   * @param id Identificador de la invitación.
   */
  rechazar(id: number): Observable<void> {
    const generacion = this.sesion.generacion();
    return this.http
      .post<void>(`${this.urlInvitaciones}/${id}/rechazar`, null, { context: conErroresPropios([404, 409]) })
      .pipe(tap(() => this.quitarPendiente(id, generacion)));
  }

  /**
   * Indica si una invitación pendiente es nueva: el usuario aún no la ha visto en ninguna lista.
   *
   * @param id Identificador de la invitación.
   */
  esNueva(id: number): boolean {
    return !this.vistas().has(id);
  }

  /**
   * Marca como vistas las invitaciones pendientes indicadas. Con `podar`, olvida las demás (se
   * conoce la lista completa de pendientes y las que faltan ya no lo están); sin él, las añade a
   * las ya vistas (por ejemplo, si solo se conoce una página). Se guarda en `localStorage` por
   * usuario; si no está disponible, solo dura lo que la pestaña.
   *
   * @param ids Invitaciones pendientes que el usuario ha visto.
   * @param podar Si `ids` es la lista completa de pendientes y se olvidan las demás.
   */
  marcarVistas(ids: readonly number[], podar = true): void {
    const usuario = this.sesion.usuario();
    if (!usuario) {
      return;
    }
    const vistas = new Set(podar ? ids : [...this.vistas(), ...ids]);
    this.vistasDe = { usuarioId: usuario.id, ids: vistas };
    const clave = this.claveVistas();
    if (!clave) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.setItem(clave, JSON.stringify([...vistas]));
    } catch {
      // Sin almacenamiento (modo privado, cuota…): la marca solo dura lo que la pestaña.
    }
  }

  /**
   * Lanza la petición de pendientes y la deja como petición en curso compartida. La respuesta
   * solo actualiza las pendientes guardadas si la sesión no ha cambiado desde que se pidió.
   *
   * @param context Contexto HTTP (por ejemplo, para que el interceptor no actúe).
   */
  private pedirPendientes(context?: HttpContext): Observable<InvitacionRecibida[]> {
    const generacion = this.sesion.generacion();
    this.ultimoRecuento = this.ahora().getTime();
    const peticion: Observable<InvitacionRecibida[]> = this.http
      .get<InvitacionRecibida[]>(`${this.urlInvitaciones}/pendientes`, { context })
      .pipe(
        tap((invitaciones) => this.fijarPendientes(invitaciones, generacion)),
        finalize(() => {
          if (this.pendientesEnCurso?.peticion === peticion) {
            this.pendientesEnCurso = undefined;
          }
        }),
        share(),
      );
    this.pendientesEnCurso = { generacion, peticion };
    return peticion;
  }

  /** Petición de pendientes en curso lanzada en la sesión actual, si la hay. */
  private peticionEnCurso(): Observable<InvitacionRecibida[]> | undefined {
    const enCurso = this.pendientesEnCurso;
    return enCurso?.generacion === this.sesion.generacion() ? enCurso.peticion : undefined;
  }

  /**
   * Pide las pendientes solo para actualizar el indicador, reutilizando la petición en curso si
   * la hay. Si falla no hace nada visible: el interceptor no actúa sobre ningún error.
   */
  private contarPendientes(): void {
    const peticion = this.peticionEnCurso() ?? this.pedirPendientes(conErroresPropios('todos'));
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

  private fijarPendientes(invitaciones: InvitacionRecibida[], generacion: number): void {
    if (generacion === this.sesion.generacion()) {
      this._pendientes.set({ generacion, invitaciones });
    }
  }

  private quitarPendiente(id: number, generacion: number): void {
    const pendientes = this.pendientes();
    if (pendientes) {
      this.fijarPendientes(
        pendientes.filter((invitacion) => invitacion.id !== id),
        generacion,
      );
    }
  }

  /** Invitaciones vistas del usuario en sesión; se leen de `localStorage` la primera vez. */
  private vistas(): ReadonlySet<number> {
    const usuario = this.sesion.usuario();
    if (!usuario) {
      return new Set();
    }
    if (this.vistasDe?.usuarioId !== usuario.id) {
      this.vistasDe = { usuarioId: usuario.id, ids: this.leerVistas() };
    }
    return this.vistasDe.ids;
  }

  private claveVistas(): string | undefined {
    const usuario = this.sesion.usuario();
    return usuario ? `${CLAVE_INVITACIONES_VISTAS}${usuario.id}` : undefined;
  }

  private leerVistas(): ReadonlySet<number> {
    const clave = this.claveVistas();
    if (!clave) {
      return new Set();
    }
    try {
      const valor: unknown = JSON.parse(this.document.defaultView?.localStorage.getItem(clave) ?? '[]');
      return new Set(Array.isArray(valor) ? valor.filter((id): id is number => Number.isSafeInteger(id)) : []);
    } catch {
      return new Set();
    }
  }
}
