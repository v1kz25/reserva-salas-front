import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { FiltroReservas, Reserva, ReservaRequest } from '../models/reserva.model';

/**
 * ReservasService — acceso a los endpoints de reservas de la API.
 */
@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly http = inject(HttpClient);

  private readonly url = '/api/reservas';

  /**
   * Lista las reservas, filtradas opcionalmente por sala y rango de fechas (`GET /api/reservas`).
   *
   * @param filtro Filtros opcionales; los que no vienen no se envían.
   */
  listar(filtro: FiltroReservas = {}): Observable<Reserva[]> {
    let params = new HttpParams();
    if (filtro.salaId !== undefined) {
      params = params.set('salaId', filtro.salaId);
    }
    if (filtro.fechaDesde) {
      params = params.set('fechaDesde', filtro.fechaDesde);
    }
    if (filtro.fechaHasta) {
      params = params.set('fechaHasta', filtro.fechaHasta);
    }
    return this.http.get<Reserva[]>(this.url, { params });
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
   *
   * @param id Identificador de la reserva.
   */
  cancelar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
