import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { AHORA } from '../../../core/tokens/ahora.token';
import { ReservaFormComponent } from './reserva-form.component';

const URL = '/api/config/zona-horaria';
// En Madrid ya es 16/10 (01:30); en Nueva York todavía es 15/10 (19:30).
const INSTANTE = new Date('2026-10-15T23:30:00Z');

describe('ReservaFormComponent: «mañana» según la zona del servidor', () => {
  let http: HttpTestingController;
  let config: ConfiguracionService;
  let instante: Date;

  async function crear(precargada?: string): Promise<{ fixture: ComponentFixture<ReservaFormComponent>; el: HTMLElement }> {
    instante = INSTANTE;
    await TestBed.configureTestingModule({
      imports: [ReservaFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AHORA, useValue: () => instante },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    config = TestBed.inject(ConfiguracionService);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    if (precargada) {
      config.obtenerZonaHoraria().subscribe();
      http.expectOne(URL).flush({ zonaHoraria: precargada });
    }
    // El formulario siempre pide la zona al entrar: cada test responde a ese GET.
    const fixture = TestBed.createComponent(ReservaFormComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http.verify());

  const fecha = (el: HTMLElement) => el.querySelector('#fecha') as HTMLInputElement;
  const ayuda = (el: HTMLElement) => el.querySelector('#fecha-ayuda')?.textContent ?? '';

  function escribirFecha(fixture: ComponentFixture<ReservaFormComponent>, el: HTMLElement, valor: string): void {
    fecha(el).value = valor;
    fecha(el).dispatchEvent(new Event('input'));
    fecha(el).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  const errorFecha = (el: HTMLElement) => el.querySelector('#fecha-error')?.textContent ?? '';

  it('pide la zona al servidor al cargar y el min usa esa zona (Madrid → 17)', async () => {
    const { fixture, el } = await crear();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('GET');
    http.expectOne('/api/salas').flush([]);
    req.flush({ zonaHoraria: 'Europe/Madrid' });
    fixture.detectChanges();
    expect(fecha(el).min).toBe('2026-10-17');
    expect(ayuda(el)).toContain('17/10/2026');
    expect(ayuda(el)).toContain('Europe/Madrid');
  });

  it('con Nueva York el min es el 16', async () => {
    const { fixture, el } = await crear();
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush({ zonaHoraria: 'America/New_York' });
    fixture.detectChanges();
    expect(fecha(el).min).toBe('2026-10-16');
    expect(ayuda(el)).toContain('16/10/2026');
    expect(ayuda(el)).toContain('America/New_York');
  });

  it('el input de fecha enlaza la ayuda con aria-describedby', async () => {
    const { fixture, el } = await crear('Europe/Madrid');
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush({ zonaHoraria: 'Europe/Madrid' });
    fixture.detectChanges();
    const ids = (fecha(el).getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toContain('fecha-ayuda');
    expect(el.querySelector('#fecha-ayuda')).not.toBeNull();
  });

  it('siempre pide el GET aunque la signal ya tenga valor y, mientras llega, usa la zona guardada', async () => {
    const { fixture, el } = await crear('Asia/Tokyo');
    http.expectOne('/api/salas').flush([]);
    const req = http.expectOne(URL);
    // Tokio: ya es 16/10 08:30, mañana es el 17. Se ve antes de que llegue la respuesta.
    expect(fecha(el).min).toBe('2026-10-17');
    expect(ayuda(el)).toContain('Asia/Tokyo');
    req.flush({ zonaHoraria: 'America/New_York' });
    fixture.detectChanges();
    expect(fecha(el).min).toBe('2026-10-16');
    expect(ayuda(el)).toContain('America/New_York');
  });

  it('si el GET falla se mantiene la zona guardada', async () => {
    const { fixture, el } = await crear('Asia/Tokyo');
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(config.zonaHoraria()).toBe('Asia/Tokyo');
    expect(fecha(el).min).toBe('2026-10-17');
    expect(ayuda(el)).toContain('Asia/Tokyo');
    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  it('valida con la zona del servidor: el 16 es inválido en Madrid pero válido en Nueva York', async () => {
    const { fixture, el } = await crear();
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush({ zonaHoraria: 'Europe/Madrid' });
    fixture.detectChanges();
    escribirFecha(fixture, el, '2026-10-16');
    expect(errorFecha(el)).toContain('Solo se puede reservar a partir de mañana');
    escribirFecha(fixture, el, '2026-10-17');
    expect(errorFecha(el)).not.toContain('Solo se puede reservar');
  });

  it('revalida al cambiar la zona (signal) sin tocar el campo', async () => {
    const { fixture, el } = await crear('America/New_York');
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush({ zonaHoraria: 'America/New_York' });
    fixture.detectChanges();
    escribirFecha(fixture, el, '2026-10-16');
    expect(errorFecha(el)).not.toContain('Solo se puede reservar');
    expect(fecha(el).min).toBe('2026-10-16');

    config.cambiarZonaHoraria('Europe/Madrid').subscribe();
    http.expectOne(URL).flush({ zonaHoraria: 'Europe/Madrid' });
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    expect(fecha(el).min).toBe('2026-10-17');
    expect(ayuda(el)).toContain('Europe/Madrid');
    expect(errorFecha(el)).toContain('Solo se puede reservar a partir de mañana');

    // Volver a Nueva York elimina el error.
    config.cambiarZonaHoraria('America/New_York').subscribe();
    http.expectOne(URL).flush({ zonaHoraria: 'America/New_York' });
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    expect(errorFecha(el)).not.toContain('Solo se puede reservar');
  });

  it('el reloj fijo cruza el día: Tokio a 01:00Z → min 16', async () => {
    await TestBed.configureTestingModule({
      imports: [ReservaFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AHORA, useValue: () => new Date('2026-10-15T01:00:00Z') },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReservaFormComponent);
    fixture.detectChanges();
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush({ zonaHoraria: 'Asia/Tokyo' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#fecha')?.min).toBe('2026-10-16');
  });

  it('al pasar la medianoche (tick de 60 s) avanzan min, ayuda y validación', fakeAsync(() => {
    let ahora = new Date('2026-10-15T21:59:30Z'); // Madrid: 23:59:30 del 15.
    TestBed.configureTestingModule({
      imports: [ReservaFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AHORA, useValue: () => ahora },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReservaFormComponent);
    const el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush({ zonaHoraria: 'Europe/Madrid' });
    fixture.detectChanges();
    expect(fecha(el).min).toBe('2026-10-16');
    escribirFecha(fixture, el, '2026-10-16');
    expect(errorFecha(el)).not.toContain('Solo se puede reservar');

    ahora = new Date('2026-10-15T22:00:30Z'); // Madrid: 00:00:30 del 16.
    tick(60_000);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    expect(fecha(el).min).toBe('2026-10-17');
    expect(ayuda(el)).toContain('17/10/2026');
    expect(errorFecha(el)).toContain('Solo se puede reservar a partir de mañana');

    fixture.destroy();
    discardPeriodicTasks();
  }));

  it('si el servidor devuelve una zona no válida usa la del navegador', async () => {
    const { fixture, el } = await crear();
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush({ zonaHoraria: 'Mars/Olympus' });
    fixture.detectChanges();
    expect(fecha(el).min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ayuda(el)).not.toContain('Mars/Olympus');
  });

  it('si el GET falla sin zona guardada usa la del navegador en silencio', async () => {
    const { fixture, el } = await crear();
    http.expectOne('/api/salas').flush([]);
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fecha(el).min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(config.zonaHoraria()).toBeUndefined();
    escribirFecha(fixture, el, '2020-01-01');
    expect(errorFecha(el)).toContain('Solo se puede reservar a partir de mañana');
  });
});
