import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Usuario } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { MENSAJE_CANCELACION_SIN_PERMISO } from '../reserva-cancelacion';
import { ReservaListComponent } from './reserva-list.component';
import { SOLO_INVITACIONES_PENDIENTES, descartarPeticionesDeFondo } from '../../../testing/peticiones-de-fondo';

const SALAS = [{ id: 1, nombre: 'Sala Norte', capacidad: 10, planta: 1 }];
const PROPIA = { id: 10, salaId: 1, fecha: '2026-10-05', horaInicio: '09:00', horaFin: '10:00', detalle: 'COMPLETO', usuarioId: 1, responsable: 'Ana', motivo: 'Daily' };
const AJENA = { id: 11, salaId: 1, fecha: '2026-10-06', horaInicio: '11:00', horaFin: '12:00', detalle: 'COMPLETO', usuarioId: 2, responsable: 'Luis', motivo: 'Demo' };

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const ADMIN: Usuario = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

/** Respuesta paginada de `GET /api/reservas` con las reservas indicadas en una sola página. */
const pagina = (content: unknown[], number = 0, totalPages = content.length > 0 ? 1 : 0, totalElements = content.length) => ({
  content,
  totalElements,
  totalPages,
  number,
  size: 20,
});

describe('ReservaListComponent: permisos de cancelación', () => {
  let fixture: ComponentFixture<ReservaListComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  function crear(usuario: Usuario | undefined, reservas: unknown[] = [PROPIA, AJENA]): void {
    TestBed.configureTestingModule({
      imports: [ReservaListComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const sesion = TestBed.inject(SesionService);
    if (usuario) {
      sesion.establecer(usuario);
    } else {
      sesion.limpiar();
    }
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReservaListComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
    http.expectOne('/api/salas').flush(SALAS);
    http.expectOne((r) => r.url === '/api/reservas').flush(pagina(reservas));
    fixture.detectChanges();
  }

  afterEach(() => {
    descartarPeticionesDeFondo(http, SOLO_INVITACIONES_PENDIENTES);
    http.verify();
    el.remove();
  });

  /** Filas: texto del responsable y si tienen botón Cancelar. */
  const filas = () =>
    Array.from(el.querySelectorAll('tbody tr')).map((tr) => ({
      responsable: tr.querySelectorAll('td')[4]?.textContent?.trim(),
      cancelar: tr.querySelector('button') !== null,
      ver: tr.querySelector('a') !== null,
    }));

  it('muestra el responsable de cada reserva', () => {
    crear(ANA);
    expect(filas().map((f) => f.responsable)).toEqual(['Ana', 'Luis']);
  });

  it('usuario normal: «Cancelar» solo en sus reservas; «Ver» en todas', () => {
    crear(ANA);
    expect(filas()).toEqual([
      { responsable: 'Ana', cancelar: true, ver: true },
      { responsable: 'Luis', cancelar: false, ver: true },
    ]);
  });

  it('administrador: «Cancelar» en todas las reservas', () => {
    crear(ADMIN);
    expect(filas().map((f) => f.cancelar)).toEqual([true, true]);
  });

  it('usuario sin reservas propias: ningún botón «Cancelar»', () => {
    crear(ANA, [AJENA]);
    expect(el.querySelectorAll('tbody button').length).toBe(0);
  });

  it('sin sesión: ningún botón «Cancelar»', () => {
    crear(undefined);
    expect(el.querySelectorAll('tbody button').length).toBe(0);
  });

  it('el id de usuario se compara por id, no por el nombre del responsable', () => {
    crear(ANA, [{ ...AJENA, responsable: 'Ana' }]);
    expect(filas()[0].cancelar).toBeFalse();
  });

  it('el admin cancela una reserva ajena: DELETE y aviso', async () => {
    crear(ADMIN);
    (el.querySelectorAll('tbody tr')[1].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    (Array.from(el.querySelectorAll('dialog button')).find((b) => b.textContent?.includes('Sí, cancelar')) as HTMLButtonElement).click();
    const req = http.expectOne((r) => r.method === 'DELETE');
    expect(req.request.url).toBe('/api/reservas/11');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne((r) => r.method === 'GET' && r.url === '/api/reservas').flush(pagina([PROPIA]));
  });

  it('403 al cancelar: muestra el mensaje en pantalla, cierra el diálogo y conserva la fila', async () => {
    crear(ANA);
    (el.querySelectorAll('tbody tr')[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    (Array.from(el.querySelectorAll('dialog button')).find((b) => b.textContent?.includes('Sí, cancelar')) as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'DELETE').flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(el.querySelector('.error-general')?.textContent).toContain(MENSAJE_CANCELACION_SIN_PERMISO);
    expect((el.querySelector('dialog') as HTMLDialogElement).open).toBeFalse();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });
});
