import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { SesionService } from '../../../core/services/sesion.service';
import { AVISO_RESERVA_CANCELADA } from '../reserva-cancelacion';
import { ReservaDetalleComponent } from './reserva-detalle.component';
import { descartarPeticionesDeFondo } from '../../../testing/peticiones-de-fondo';

const SALAS = [{ id: 2, nombre: 'Sala Sur', capacidad: 4, planta: -1 }];
const RESERVA = { id: 10, salaId: 2, fecha: '2026-10-05', horaInicio: '09:00:00', horaFin: '10:30', detalle: 'COMPLETO', usuarioId: 1, responsable: 'Ana', motivo: 'Daily' };

describe('ReservaDetalleComponent', () => {
  let fixture: ComponentFixture<ReservaDetalleComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  async function crear(id: string | null): Promise<void> {
    params = new BehaviorSubject(convertToParamMap(id === null ? {} : { id }));
    await TestBed.configureTestingModule({
      imports: [ReservaDetalleComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    }).compileComponents();
    TestBed.inject(SesionService).establecer({ id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ReservaDetalleComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  afterEach(() => {
    descartarPeticionesDeFondo(http);
    http.verify();
    el.remove();
  });

  async function cargada(): Promise<void> {
    await crear('10');
    http.expectOne('/api/reservas/10').flush(RESERVA);
    http.expectOne('/api/salas').flush(SALAS);
    fixture.detectChanges();
    descartarPeticionesDeFondo(http);
  }

  /** Diálogo de cancelación (la sección «Asistentes» tiene otro, el de retirar invitaciones). */
  const dialogoCancelar = () =>
    Array.from(el.querySelectorAll('dialog')).find((d) => d.textContent?.includes('Cancelar reserva')) ?? null;

  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

  async function abrirDialogo(): Promise<void> {
    boton('Cancelar reserva').click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('muestra "Cargando" y luego los datos con el nombre de sala y horas en HH:mm', async () => {
    await crear('10');
    expect(el.textContent).toContain('Cargando reserva');
    http.expectOne('/api/reservas/10').flush(RESERVA);
    http.expectOne('/api/salas').flush(SALAS);
    fixture.detectChanges();
    const dd = Array.from(el.querySelectorAll('dd')).map((d) => d.textContent?.trim());
    expect(dd).toEqual(['Sala Sur', '05/10/2026', '09:00', '10:30', 'Ana', 'Daily']);
  });

  it('si no se resuelven las salas, muestra «Sala <id>»', async () => {
    await crear('10');
    http.expectOne('/api/reservas/10').flush(RESERVA);
    http.expectOne('/api/salas').flush(null, { status: 500, statusText: 'e' });
    fixture.detectChanges();
    expect(el.querySelector('dd')?.textContent?.trim()).toBe('Sala 2');
  });

  it('404 al cargar: muestra «La reserva no existe» con enlace al listado', async () => {
    await crear('10');
    http.expectOne('/api/reservas/10').flush({ title: 'x', status: 404 }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('La reserva no existe');
    expect(el.querySelector('a[href="/reservas"]')).not.toBeNull();
    expect(el.querySelector('dl')).toBeNull();
    http.expectNone('/api/salas');
  });

  for (const id of ['abc', '0', '-3', '1.5', '', '99999999999999999999']) {
    it(`id inválido «${id}»: no hace peticiones y muestra «La reserva no existe»`, async () => {
      await crear(id);
      fixture.detectChanges();
      expect(el.textContent).toContain('La reserva no existe');
      http.expectNone(() => true);
      http.expectNone('/api/salas');
    });
  }

  it('sin parámetro id: muestra «La reserva no existe» sin peticiones', async () => {
    await crear(null);
    expect(el.textContent).toContain('La reserva no existe');
    http.expectNone(() => true);
  });

  it('otros errores al cargar muestran el mensaje, no «no existe»', async () => {
    await crear('10');
    http.expectOne('/api/reservas/10').flush(null, { status: 0, statusText: '' });
    fixture.detectChanges();
    expect(el.querySelector('p.error')?.textContent).toContain('No se ha podido conectar');
    expect(el.textContent).not.toContain('La reserva no existe');
  });

  it('«Cancelar reserva» abre el diálogo sin enviar nada', async () => {
    await cargada();
    await abrirDialogo();
    expect(dialogoCancelar()?.open).toBeTrue();
    expect(dialogoCancelar()?.textContent).toContain('Sala Sur');
    http.expectNone(() => true);
  });

  it('«No, mantenerla» cierra el diálogo y no envía DELETE', async () => {
    await cargada();
    await abrirDialogo();
    boton('No, mantenerla').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialogoCancelar()?.open).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });

  it('confirmar envía DELETE y navega al listado con el aviso', async () => {
    await cargada();
    await abrirDialogo();
    boton('Sí, cancelar').click();
    const req = http.expectOne('/api/reservas/10');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(router.navigate).toHaveBeenCalledOnceWith(['/reservas'], { state: { aviso: AVISO_RESERVA_CANCELADA } });
  });

  it('doble clic en confirmar envía un solo DELETE', async () => {
    await cargada();
    await abrirDialogo();
    const confirmar = boton('Sí, cancelar');
    confirmar.click();
    fixture.detectChanges();
    confirmar.click();
    const reqs = http.match('/api/reservas/10');
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.method).toBe('DELETE');
    reqs[0].flush(null, { status: 204, statusText: 'No Content' });
  });

  it('404 al cancelar: muestra «La reserva no existe» y no navega', async () => {
    await cargada();
    await abrirDialogo();
    boton('Sí, cancelar').click();
    http.expectOne('/api/reservas/10').flush({ title: 'x', status: 404 }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.textContent).toContain('La reserva no existe');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('error 409 al cancelar: muestra el error, mantiene la ficha y no navega', async () => {
    await cargada();
    await abrirDialogo();
    boton('Sí, cancelar').click();
    http
      .expectOne('/api/reservas/10')
      .flush({ title: 'Conflicto', status: 409, detail: 'Fallo al cancelar' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.querySelector('.error-general')?.textContent).toContain('Fallo al cancelar');
    expect(el.querySelector('dl')).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('tras un error se puede volver a intentar la cancelación', async () => {
    await cargada();
    await abrirDialogo();
    boton('Sí, cancelar').click();
    http.expectOne('/api/reservas/10').flush({ title: 'E', status: 409, detail: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    await abrirDialogo();
    boton('Sí, cancelar').click();
    http.expectOne('/api/reservas/10').flush(null, { status: 204, statusText: 'No Content' });
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('tras cancelar bien, cancelando sigue a true y un segundo clic no lanza otro DELETE', async () => {
    await cargada();
    let resolver: (v: boolean) => void = () => undefined;
    (router.navigate as jasmine.Spy).and.returnValue(new Promise<boolean>((r) => (resolver = r)));
    await abrirDialogo();
    boton('Sí, cancelar').click();
    http.expectOne('/api/reservas/10').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    const comp = fixture.componentInstance as unknown as { cancelando: () => boolean; confirmarCancelacion(): void };
    expect(comp.cancelando()).toBeTrue();
    comp.confirmarCancelacion();
    http.expectNone('/api/reservas/10');
    resolver(true);
    await fixture.whenStable();
    expect(comp.cancelando()).toBeTrue();
  });

  it('si la navegación devuelve false, cancelando vuelve a false', async () => {
    await cargada();
    (router.navigate as jasmine.Spy).and.resolveTo(false);
    await abrirDialogo();
    boton('Sí, cancelar').click();
    http.expectOne('/api/reservas/10').flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    const comp = fixture.componentInstance as unknown as { cancelando: () => boolean };
    expect(comp.cancelando()).toBeFalse();
  });

  it('un cambio de id en la misma instancia recarga y reinicia el estado', async () => {
    await cargada();
    await abrirDialogo();
    params.next(convertToParamMap({ id: '11' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Cargando reserva');
    expect(el.querySelector('dl')).toBeNull();
    expect(dialogoCancelar()?.open).toBeFalse();
    http.expectOne('/api/reservas/11').flush({ ...RESERVA, id: 11, responsable: 'Luis' });
    http.expectOne('/api/salas').flush(SALAS);
    fixture.detectChanges();
    expect(el.textContent).toContain('Luis');
    expect(el.textContent).not.toContain('Ana');
  });

  it('un cambio a un id inválido tras una carga correcta muestra «no existe»', async () => {
    await cargada();
    params.next(convertToParamMap({ id: 'abc' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('La reserva no existe');
    expect(el.querySelector('dl')).toBeNull();
  });
});
