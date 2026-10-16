import { ParamMap, Params } from '@angular/router';

import { FiltroReservas } from '../../../core/models/reserva.model';

/**
 * Estado del listado de reservas que se guarda en la query de la URL: los filtros y la página.
 */
export interface EstadoListado extends FiltroReservas {
  /** Página actual, empezando en 0 (en la URL va en base 1). */
  pagina: number;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ENTERO = /^\d+$/;

/**
 * Lee el estado del listado de la query de la URL. Los valores que no son válidos se ignoran:
 * `page` debe ser un entero mayor o igual que 1 (base 1), `salaId` un entero y las fechas
 * deben tener el formato `yyyy-MM-dd`.
 *
 * @param params Parámetros de la query.
 */
export function leerEstadoDeUrl(params: ParamMap): EstadoListado {
  const page = entero(params.get('page'));
  const fechaDesde = params.get('fechaDesde') ?? '';
  const fechaHasta = params.get('fechaHasta') ?? '';
  return {
    salaId: entero(params.get('salaId')),
    fechaDesde: FECHA.test(fechaDesde) ? fechaDesde : undefined,
    fechaHasta: FECHA.test(fechaHasta) ? fechaHasta : undefined,
    pagina: page !== undefined && page >= 1 ? page - 1 : 0,
  };
}

/**
 * Convierte el estado del listado en los parámetros de la query. Los que no aplican van a
 * `null` para que `queryParamsHandling: 'merge'` los quite de la URL; la primera página
 * tampoco se escribe.
 *
 * @param estado Estado del listado.
 */
export function estadoAQueryParams(estado: EstadoListado): Params {
  return {
    page: estado.pagina > 0 ? estado.pagina + 1 : null,
    salaId: estado.salaId ?? null,
    fechaDesde: estado.fechaDesde ?? null,
    fechaHasta: estado.fechaHasta ?? null,
  };
}

/**
 * Indica si dos estados del listado son iguales.
 *
 * @param a Primer estado.
 * @param b Segundo estado.
 */
export function mismoEstado(a: EstadoListado, b: EstadoListado): boolean {
  return (
    a.pagina === b.pagina &&
    a.salaId === b.salaId &&
    a.fechaDesde === b.fechaDesde &&
    a.fechaHasta === b.fechaHasta
  );
}

function entero(valor: string | null): number | undefined {
  if (valor === null || !ENTERO.test(valor)) {
    return undefined;
  }
  const numero = Number(valor);
  return Number.isSafeInteger(numero) ? numero : undefined;
}
