import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Sala } from '../models/sala.model';

/**
 * SalasService — acceso a los endpoints de salas de la API.
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
}
