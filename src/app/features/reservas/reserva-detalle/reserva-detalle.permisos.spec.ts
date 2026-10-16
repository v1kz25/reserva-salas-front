import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Usuario } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { MENSAJE_CANCELACION_SIN_PERMISO } from '../reserva-cancelacion';
import { ReservaDetalleComponent } from './reserva-detalle.component';
import { descartarPeticionesDeFondo } from '../../../testing/peticiones-de-fondo';

const SALAS = [{ id: 2, nombre: 'Sala Sur', capacidad: 4, planta: -1 }];
const RESERVA = { id: 10, salaId: 2, fecha: '2026-10-05', horaInicio: '09:00', horaFin: '10:30', detalle: 'COMPLETO', usuarioId: 1, responsable: 'Ana', motivo: 'Daily' };

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const LUIS: Usuario = { id: 2, email: 'luis@example.com', nombre: 'Luis', rol: 'USER' };
const ADMIN: Usuario = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

describe('ReservaDetalleComponent: permisos de cancelación', () => {
  let fixture: ComponentFixture<ReservaDetalleComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  function crear(usuario: Usuario | undefined): void {
    TestBed.configureTestingModule({
      imports: [ReservaDetalleComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '10' })) } },
      ],
    });
    const sesion = TestBed.inject(SesionService);
    if (usuario) {
      sesion.establecer(usuario);
    } else {
      sesion.limpiar();
    }
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReservaDetalleComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
    http.expectOne('/api/reservas/10').flush(RESERVA);
    http.expectOne('/api/salas').flush(SALAS);
    fixture.detectChanges();
  }

  afterEach(() => {
    descartarPeticionesDeFondo(http);
    http.verify();
    el.remove();
  });

  const cancelar = () =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Cancelar reserva'));

  it('muestra el responsable', () => {
    crear(ANA);
    const dt = Array.from(el.querySelectorAll('dt')).map((d) => d.textContent?.trim());
    const dd = Array.from(el.querySelectorAll('dd')).map((d) => d.textContent?.trim());
    expect(dd[dt.indexOf('Responsable')]).toBe('Ana');
  });

  it('el propietario ve «Cancelar reserva»', () => {
    crear(ANA);
    expect(cancelar()).toBeDefined();
  });

  it('el administrador ve «Cancelar reserva» en una reserva ajena', () => {
    crear(ADMIN);
    expect(cancelar()).toBeDefined();
  });

  it('otro usuario normal no ve «Cancelar reserva», pero sí los datos y el enlace al listado', () => {
    crear(LUIS);
    expect(cancelar()).toBeUndefined();
    expect(el.textContent).toContain('Sala Sur');
    expect(el.querySelector('a[href="/reservas"]')).not.toBeNull();
  });

  it('sin sesión no se ofrece cancelar', () => {
    crear(undefined);
    expect(cancelar()).toBeUndefined();
  });

  it('403 al cancelar: muestra su mensaje en pantalla y la reserva sigue visible', async () => {
    crear(ANA);
    cancelar()?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    (Array.from(el.querySelectorAll('dialog button')).find((b) => b.textContent?.includes('Sí, cancelar')) as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'DELETE').flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(el.querySelector('.error-general')?.textContent).toContain(MENSAJE_CANCELACION_SIN_PERMISO);
    expect(el.textContent).toContain('Sala Sur');
    expect((el.querySelector('dialog') as HTMLDialogElement).open).toBeFalse();
  });
});
