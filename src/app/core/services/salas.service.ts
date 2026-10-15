import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { conErroresPropios } from '../http/errores-propios';
import { Sala, SalaRequest } from '../models/sala.model';

/**
 * SalasService — acceso a los endpoints de salas de la API. Crear, modificar y eliminar
 * solo están permitidos a administradores.
 */
@Injectable({ providedIn: 'root' })
export class SalasService {
  private readonly http = inject(HttpClient);

  private readonly url = '/api/salas';

  /**
   * Lista todas las salas, ordenadas por nombre (`GET /api/salas`).
   */
  listar(): Observable<Sala[]> {
    return this.http.get<Sala[]>(this.url);
  }

  /**
   * Obtiene una sala por su id (`GET /api/salas/{id}`). El `404` lo gestiona quien llama.
   *
   * @param id Identificador de la sala.
   */
  obtener(id: number): Observable<Sala> {
    return this.http.get<Sala>(`${this.url}/${id}`);
  }

  /**
   * Crea una sala (`POST /api/salas`). El `400` (datos no válidos) y el `409` (nombre
   * repetido) los gestiona quien llama, en el propio formulario.
   *
   * @param sala Datos de la sala.
   */
  crear(sala: SalaRequest): Observable<Sala> {
    return this.http.post<Sala>(this.url, sala, { context: conErroresPropios([400, 409]) });
  }

  /**
   * Modifica una sala (`PUT /api/salas/{id}`). El `400` (datos no válidos), el `404` (la
   * sala ya no existe) y el `409` (nombre repetido) los gestiona quien llama.
   *
   * @param id Identificador de la sala.
   * @param sala Datos nuevos de la sala.
   */
  modificar(id: number, sala: SalaRequest): Observable<Sala> {
    return this.http.put<Sala>(`${this.url}/${id}`, sala, { context: conErroresPropios([400, 404, 409]) });
  }

  /**
   * Elimina una sala (`DELETE /api/salas/{id}`). El `404` (ya no existía) y el `409` (tiene
   * reservas futuras) los gestiona quien llama, con un mensaje en el propio listado.
   *
   * @param id Identificador de la sala.
   */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`, { context: conErroresPropios([404, 409]) });
  }
}
