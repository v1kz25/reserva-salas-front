import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ReservaListComponent } from './reserva-list.component';

const SALAS = [
  { id: 1, nombre: 'Sala Norte', capacidad: 10, planta: 1 },
  { id: 2, nombre: 'Sala Sur', capacidad: 4, planta: -1 },
];
const RESERVAS = [
  { id: 10, salaId: 2, fecha: '2026-10-05', horaInicio: '09:00:00', horaFin: '10:30', responsable: 'Ana', motivo: 'Daily' },
];

describe('ReservaListComponent', () => {
  let fixture: ComponentFixture<ReservaListComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const reservasReqs = () => http.match((r) => r.url === '/api/reservas');
  const ultimaReservas = (): TestRequest => {
    const reqs = reservasReqs();
    return reqs[reqs.length - 1];
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservaListComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReservaListComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function cargar(reservas: unknown[] = RESERVAS, salas: unknown[] = SALAS): void {
    http.expectOne('/api/salas').flush(salas);
    http.expectOne((r) => r.url === '/api/reservas').flush(reservas);
    fixture.detectChanges();
  }

  function elegirOpcion(select: HTMLSelectElement, texto: string): void {
    const opcion = Array.from(select.options).find((o) => o.textContent?.includes(texto));
    if (!opcion) {
      throw new Error(`No existe la opción «${texto}»`);
    }
    select.value = opcion.value;
    select.dispatchEvent(new Event('change'));
  }

  function cambiarFecha(valor: string, id = 'filtro-fecha-desde'): void {
    const fecha = el.querySelector(`#${id}`) as HTMLInputElement;
    fecha.value = valor;
    fecha.dispatchEvent(new Event('input'));
  }

  it('muestra "Cargando" mientras espera', () => {
    expect(el.textContent).toContain('Cargando reservas');
    http.expectOne('/api/salas').flush([]);
    http.expectOne((r) => r.url === '/api/reservas').flush([]);
  });

  it('muestra el nombre de la sala, no su id, y las horas en HH:mm', () => {
    cargar();
    const fila = el.querySelector('tbody tr') as HTMLElement;
    expect(fila.textContent).toContain('Sala Sur');
    const celdas = Array.from(fila.querySelectorAll('td')).map((c) => c.textContent?.trim());
    expect(celdas[0]).toBe('Sala Sur');
    expect(celdas[2]).toBe('09:00');
    expect(celdas[3]).toBe('10:30');
    expect(celdas[4]).toBe('Ana');
  });

  it('si la sala no se conoce muestra una etiqueta con el id', () => {
    cargar(RESERVAS, []);
    expect(el.querySelector('tbody td')?.textContent).toContain('Sala 2');
  });

  it('muestra estado vacío', () => {
    cargar([]);
    expect(el.textContent).toContain('No hay reservas');
  });

  it('muestra error si falla la carga de reservas', () => {
    http.expectOne('/api/salas').flush(SALAS);
    http.expectOne((r) => r.url === '/api/reservas').flush(null, { status: 0, statusText: '' });
    fixture.detectChanges();
    expect(el.querySelector('p.error')?.textContent).toContain('No se ha podido conectar');
    expect(el.querySelector('table')).toBeNull();
  });

  it('avisa si fallan las salas pero sigue listando', () => {
    http.expectOne('/api/salas').flush({ title: 'x', status: 500, detail: 'Fallo salas' }, { status: 500, statusText: 'e' });
    http.expectOne((r) => r.url === '/api/reservas').flush(RESERVAS);
    fixture.detectChanges();
    expect(el.querySelector('.aviso')?.textContent).toContain('Fallo salas');
    expect(el.querySelector('tbody tr')).not.toBeNull();
  });

  it('el selector de sala se carga con las salas de GET /api/salas', () => {
    cargar();
    const opciones = Array.from(el.querySelectorAll('#filtro-sala option')).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Todas las salas', 'Sala Norte', 'Sala Sur']);
  });

  it('la petición inicial no lleva filtros', () => {
    http.expectOne('/api/salas').flush(SALAS);
    const req = http.expectOne((r) => r.url === '/api/reservas');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('filtrar por sala y rango de fechas recarga con los parámetros', () => {
    cargar();
    const select = el.querySelector('#filtro-sala') as HTMLSelectElement;
    elegirOpcion(select, 'Sala Sur');
    let req = ultimaReservas();
    expect(req.request.params.get('salaId')).toBe('2');
    req.flush([]);

    cambiarFecha('2026-10-05');
    req = ultimaReservas();
    expect(req.request.params.get('salaId')).toBe('2');
    expect(req.request.params.get('fechaDesde')).toBe('2026-10-05');
    expect(req.request.params.has('fechaHasta')).toBeFalse();
    req.flush([]);

    cambiarFecha('2026-10-05', 'filtro-fecha-hasta');
    req = ultimaReservas();
    expect(req.request.params.get('fechaDesde')).toBe('2026-10-05');
    expect(req.request.params.get('fechaHasta')).toBe('2026-10-05');
    req.flush(RESERVAS);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('limpiar filtros vuelve a pedir sin parámetros', () => {
    cargar();
    cambiarFecha('2026-10-05');
    ultimaReservas().flush([]);
    (el.querySelector('button') as HTMLButtonElement).click();
    const req = ultimaReservas();
    expect(req.request.params.keys()).toEqual([]);
    req.flush(RESERVAS);
  });

  it('el botón "Nueva reserva" enlaza a /reservas/nueva', () => {
    cargar();
    const enlace = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('Nueva reserva'));
    expect(enlace?.getAttribute('href')).toBe('/reservas/nueva');
  });

  it('dos cambios rápidos de filtro: se cancela la primera petición y solo se pinta la última', () => {
    cargar();
    cambiarFecha('2026-10-05');
    cambiarFecha('2026-10-06');
    const reqs = reservasReqs();
    expect(reqs.length).toBe(2);
    expect(reqs[0].cancelled).toBeTrue();
    expect(reqs[1].cancelled).toBeFalse();
    expect(reqs[1].request.params.get('fechaDesde')).toBe('2026-10-06');
    reqs[1].flush(RESERVAS);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.textContent).toContain('Ana');
  });

  it('tras un error de reservas, cambiar el filtro vuelve a listar', () => {
    http.expectOne('/api/salas').flush(SALAS);
    http.expectOne((r) => r.url === '/api/reservas').flush(null, { status: 0, statusText: '' });
    fixture.detectChanges();
    expect(el.querySelector('p.error')).not.toBeNull();
    cambiarFecha('2026-10-05');
    fixture.detectChanges();
    expect(el.querySelector('p.error')).toBeNull();
    ultimaReservas().flush(RESERVAS);
    fixture.detectChanges();
    expect(el.querySelector('p.error')).toBeNull();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('muestra «—» mientras las salas no responden y el nombre después', () => {
    http.expectOne((r) => r.url === '/api/reservas').flush(RESERVAS);
    fixture.detectChanges();
    expect(el.querySelector('tbody td')?.textContent?.trim()).toBe('—');
    http.expectOne('/api/salas').flush(SALAS);
    fixture.detectChanges();
    expect(el.querySelector('tbody td')?.textContent?.trim()).toBe('Sala Sur');
  });

  describe('rango de fechas y selector de sala', () => {
    const selectSala = () => el.querySelector('#filtro-sala') as HTMLSelectElement;
    const textoSeleccionado = () => selectSala().selectedOptions[0]?.textContent?.trim();

    it('«Todas las salas» está seleccionada en el DOM al cargar', () => {
      cargar();
      expect(selectSala().selectedIndex).toBe(0);
      expect(textoSeleccionado()).toBe('Todas las salas');
    });

    it('«Todas las salas» vuelve a estar seleccionada en el DOM tras «Limpiar filtros»', () => {
      cargar();
      elegirOpcion(selectSala(), 'Sala Sur');
      ultimaReservas().flush([]);
      fixture.detectChanges();
      expect(textoSeleccionado()).toBe('Sala Sur');

      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Limpiar')) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(selectSala().selectedIndex).toBe(0);
      expect(textoSeleccionado()).toBe('Todas las salas');
      const req = ultimaReservas();
      expect(req.request.params.keys()).toEqual([]);
      req.flush([]);
    });

    it('«Limpiar filtros» vacía también las fechas en el DOM', () => {
      cargar();
      cambiarFecha('2026-10-05');
      cambiarFecha('2026-10-07', 'filtro-fecha-hasta');
      reservasReqs().forEach((r) => !r.cancelled && r.flush([]));
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Limpiar')) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect((el.querySelector('#filtro-fecha-desde') as HTMLInputElement).value).toBe('');
      expect((el.querySelector('#filtro-fecha-hasta') as HTMLInputElement).value).toBe('');
      ultimaReservas().flush([]);
    });

    it('elegir de nuevo «Todas las salas» quita salaId de la petición', () => {
      cargar();
      elegirOpcion(selectSala(), 'Sala Norte');
      ultimaReservas().flush([]);
      elegirOpcion(selectSala(), 'Todas las salas');
      const req = ultimaReservas();
      expect(req.request.params.has('salaId')).toBeFalse();
      req.flush([]);
    });

    it('solo fechaHasta: envía únicamente fechaHasta', () => {
      cargar();
      cambiarFecha('2026-10-09', 'filtro-fecha-hasta');
      const req = ultimaReservas();
      expect(req.request.params.keys()).toEqual(['fechaHasta']);
      expect(req.request.params.get('fechaHasta')).toBe('2026-10-09');
      req.flush([]);
    });

    it('solo fechaDesde: envía únicamente fechaDesde', () => {
      cargar();
      cambiarFecha('2026-10-05');
      const req = ultimaReservas();
      expect(req.request.params.keys()).toEqual(['fechaDesde']);
      req.flush([]);
    });

    it('sala + desde + hasta: envía los tres parámetros', () => {
      cargar();
      elegirOpcion(selectSala(), 'Sala Norte');
      ultimaReservas().flush([]);
      cambiarFecha('2026-10-05');
      ultimaReservas().flush([]);
      cambiarFecha('2026-10-07', 'filtro-fecha-hasta');
      const req = ultimaReservas();
      expect(req.request.params.get('salaId')).toBe('1');
      expect(req.request.params.get('fechaDesde')).toBe('2026-10-05');
      expect(req.request.params.get('fechaHasta')).toBe('2026-10-07');
      req.flush([]);
    });

    it('vaciar una fecha la quita de la petición', () => {
      cargar();
      cambiarFecha('2026-10-05');
      ultimaReservas().flush([]);
      cambiarFecha('');
      const req = ultimaReservas();
      expect(req.request.params.has('fechaDesde')).toBeFalse();
      req.flush([]);
    });

    it('rango invertido: no lanza petición y muestra el error', () => {
      cargar();
      cambiarFecha('2026-10-10');
      ultimaReservas().flush([]);
      cambiarFecha('2026-10-05', 'filtro-fecha-hasta');
      fixture.detectChanges();
      expect(reservasReqs().length).toBe(0);
      expect(el.querySelector('#filtro-fechas-error .error')?.textContent).toContain('no puede ser anterior');
      expect((el.querySelector('#filtro-fecha-hasta') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
    });

    it('petición en vuelo y rango invertido: se cancela y su respuesta no se pinta', () => {
      cargar([]);
      cambiarFecha('2026-10-10');
      const enVuelo = ultimaReservas();
      cambiarFecha('2026-10-05', 'filtro-fecha-hasta');
      fixture.detectChanges();
      expect(enVuelo.cancelled).toBeTrue();
      expect(reservasReqs().length).toBe(0);
      expect(el.textContent).not.toContain('Cargando reservas');
      expect(el.textContent).not.toContain('Ana');
      expect(el.querySelector('#filtro-fechas-error .error')?.textContent).toContain('no puede ser anterior');
    });

    it('al corregir el rango invertido se lanza la petición y desaparece el error', () => {
      cargar();
      cambiarFecha('2026-10-10');
      ultimaReservas().flush([]);
      cambiarFecha('2026-10-05', 'filtro-fecha-hasta');
      expect(reservasReqs().length).toBe(0);
      cambiarFecha('2026-10-12', 'filtro-fecha-hasta');
      fixture.detectChanges();
      const req = ultimaReservas();
      expect(req.request.params.get('fechaDesde')).toBe('2026-10-10');
      expect(req.request.params.get('fechaHasta')).toBe('2026-10-12');
      req.flush([]);
      fixture.detectChanges();
      expect(el.querySelector('#filtro-fechas-error .error')).toBeNull();
    });

    it('rango con fechas iguales sí lanza la petición', () => {
      cargar();
      cambiarFecha('2026-10-05');
      ultimaReservas().flush([]);
      cambiarFecha('2026-10-05', 'filtro-fecha-hasta');
      expect(ultimaReservas()).toBeDefined();
      http.match((r) => r.url === '/api/reservas');
    });

    it('rango inválido y «Limpiar filtros»: vuelve a pedir sin parámetros', () => {
      cargar();
      cambiarFecha('2026-10-10');
      ultimaReservas().flush([]);
      cambiarFecha('2026-10-05', 'filtro-fecha-hasta');
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Limpiar')) as HTMLButtonElement).click();
      const req = ultimaReservas();
      expect(req.request.params.keys()).toEqual([]);
      req.flush([]);
    });

    it('el min de «Fecha hasta» es la fecha desde y se actualiza', () => {
      cargar();
      const hasta = el.querySelector('#filtro-fecha-hasta') as HTMLInputElement;
      expect(hasta.min).toBe('');
      cambiarFecha('2026-10-05');
      fixture.detectChanges();
      expect(hasta.min).toBe('2026-10-05');
      cambiarFecha('2026-10-20');
      fixture.detectChanges();
      expect(hasta.min).toBe('2026-10-20');
      cambiarFecha('');
      fixture.detectChanges();
      expect(hasta.min).toBe('');
      http.match((r) => r.url === '/api/reservas');
    });
  });
});
