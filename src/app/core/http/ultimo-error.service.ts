import { Injectable, signal } from '@angular/core';

import { ProblemDetail } from '../models/problem-detail.model';

/**
 * UltimoErrorService — guarda el último error grave con `ProblemDetail` para que
 * la página de error inesperado pueda mostrar su título y detalle.
 */
@Injectable({ providedIn: 'root' })
export class UltimoErrorService {
  /** Último `ProblemDetail` de un error inesperado, si lo hay. */
  readonly problema = signal<ProblemDetail | undefined>(undefined);
}
