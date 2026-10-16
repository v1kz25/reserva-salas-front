import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { conErroresPropios } from '../http/errores-propios';
import {
  FiltroReservas,
  PaginaReservas,
  Reserva,
  ReservaRequest,
  TAMANO_PAGINA_RESERVAS,
} from '../models/reserva.model';

/**
 * ReservasService — acceso a los endpoints de reservas de la API.
 */
@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly http = inject(HttpClient);

  private readonly url = '/api/reservas';

  /**
   * Lista una página de reservas, filtradas opcionalmente por sala y rango de fechas
   * (`GET /api/reservas`). Siempre envía `page` y `size`.
   *
   * @param filtro Filtros opcionales; los que no vienen no se envían.
   * @param pagina Página que se pide, empezando en 0.
   * @param tamano Número de reservas por página (la API admite hasta 100).
   */
  listar(
    filtro: FiltroReservas = {},
    pagina = 0,
    tamano = TAMANO_PAGINA_RESERVAS,
  ): Observable<PaginaReservas> {
    let params = new HttpParams().set('page', pagina).set('size', tamano);
    if (filtro.salaId !== undefined) {
      params = params.set('salaId', filtro.salaId);
    }
    if (filtro.fechaDesde) {
      params = params.set('fechaDesde', filtro.fechaDesde);
    }
    if (filtro.fechaHasta) {
      params = params.set('fechaHasta', filtro.fechaHasta);
    }
    return this.http.get<PaginaReservas>(this.url, { params });
  }

  /**
   * Crea una reserva (`POST /api/reservas`).
   *
   * @param reserva Datos de la reserva.
   */
  crear(reserva: ReservaRequest): Observable<Reserva> {
    return this.http.post<Reserva>(this.url, reserva);
  }

  /**
   * Obtiene una reserva por su id (`GET /api/reservas/{id}`).
   *
   * @param id Identificador de la reserva.
   */
  obtener(id: number): Observable<Reserva> {
    return this.http.get<Reserva>(`${this.url}/${id}`);
  }

  /**
   * Cancela (elimina) una reserva y deja libre su franja (`DELETE /api/reservas/{id}`).
   * El `403` (la reserva es de otro usuario) lo gestiona quien llama, con un mensaje en
   * la propia pantalla, en lugar de llevar a la página de «sin permiso».
   *
   * @param id Identificador de la reserva.
   */
  cancelar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { context: conErroresPropios([403]) });
  }
}
