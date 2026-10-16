import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { conErroresPropios } from '../http/errores-propios';
import { ZonaHoraria } from '../models/configuracion.model';

/**
 * ConfiguracionService — acceso a la configuración de la aplicación. Guarda la zona
 * horaria del servidor en una signal compartida, para que otras pantallas (el formulario
 * de reservas) usen la actual sin repetir la petición.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  /** Última zona horaria conocida del servidor; `undefined` si aún no se ha obtenido. */
  private readonly _zonaHoraria = signal<string | undefined>(undefined);

  private readonly http = inject(HttpClient);

  /** Zona horaria del servidor (solo lectura); `undefined` si aún no se ha obtenido. */
  readonly zonaHoraria = this._zonaHoraria.asReadonly();

  private readonly url = '/api/config/zona-horaria';

  /**
   * Obtiene la zona horaria de la aplicación (`GET /api/config/zona-horaria`) y la guarda
   * en la signal compartida.
   *
   * @param conRespaldo Si es `true`, quien llama gestiona todos los errores (usa una zona
   *   de respaldo) y el interceptor no redirige a las páginas de error.
   */
  obtenerZonaHoraria(conRespaldo = false): Observable<ZonaHoraria> {
    const context = conRespaldo ? conErroresPropios('todos') : new HttpContext();
    return this.http
      .get<ZonaHoraria>(this.url, { context })
      .pipe(tap((zona) => this._zonaHoraria.set(zona.zonaHoraria)));
  }

  /**
   * Cambia la zona horaria (`PUT /api/config/zona-horaria`, solo `ADMIN`) y actualiza la
   * signal compartida. El `400` (identificador IANA no válido) lo gestiona quien llama.
   *
   * @param zonaHoraria Identificador IANA de la nueva zona.
   */
  cambiarZonaHoraria(zonaHoraria: string): Observable<ZonaHoraria> {
    return this.http
      .put<ZonaHoraria>(this.url, { zonaHoraria }, { context: conErroresPropios([400]) })
      .pipe(tap((zona) => this._zonaHoraria.set(zona.zonaHoraria)));
  }
}
