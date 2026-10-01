import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AHORA } from '../../../core/tokens/ahora.token';
import { ReservaFormComponent } from './reserva-form.component';

const SALAS = [
  { id: 1, nombre: 'Sala Norte', capacidad: 10, planta: 1 },
  { id: 2, nombre: 'Sala Sur', capacidad: 4, planta: 0 },
];

const HOY = '2026-10-01';
const MANANA = '2026-10-02';

describe('ReservaFormComponent', () => {
  let fixture: ComponentFixture<ReservaFormComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;
  let ahora: Date;

  beforeEach(async () => {
    ahora = new Date(2026, 9, 1, 12, 30);
    await TestBed.configureTestingModule({
      imports: [ReservaFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AHORA, useValue: () => ahora },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ReservaFormComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne('/api/salas').flush(SALAS);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function escribir(id: string, valor: string): void {
    const campo = el.querySelector(`#${id}`) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
  }

  function elegirOpcion(select: HTMLSelectElement, texto: string): void {
    const opcion = Array.from(select.options).find((o) => o.textContent?.includes(texto));
    if (!opcion) {
      throw new Error(`No existe la opción «${texto}»`);
    }
    select.value = opcion.value;
    select.dispatchEvent(new Event('change'));
  }

  function rellenar(over: Partial<Record<string, string>> = {}): void {
    const s = el.querySelector('#sala') as HTMLSelectElement;
    elegirOpcion(s, 'Sala Sur');
    escribir('fecha', over['fecha'] ?? MANANA);
    escribir('hora-inicio', over['inicio'] ?? '10:00');
    escribir('hora-fin', over['fin'] ?? '11:00');
    escribir('responsable', over['responsable'] ?? '  Ana  ');
    escribir('motivo', over['motivo'] ?? ' Reunión ');
    fixture.detectChanges();
  }

  function enviar(): void {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  const textoErrores = () => Array.from(el.querySelectorAll('.error')).map((e) => e.textContent?.trim());

  it('carga las salas en el selector', () => {
    const opciones = Array.from(el.querySelectorAll('#sala option')).map((o) => o.textContent);
    expect(opciones.length).toBe(3);
    expect(opciones[1]).toContain('Sala Norte');
  });

  it('formulario vacío: no envía y muestra errores de obligatorios', () => {
    enviar();
    http.expectNone('/api/reservas');
    const t = textoErrores().join('|');
    expect(t).toContain('Selecciona una sala');
    expect(t).toContain('Indica la fecha');
    expect(t).toContain('Indica el responsable');
    expect(t).toContain('Indica el motivo');
  });

  it('hora fin igual a inicio: error y no envía', () => {
    rellenar({ inicio: '10:00', fin: '10:00' });
    enviar();
    http.expectNone('/api/reservas');
    expect(el.textContent).toContain('La hora de fin debe ser posterior');
  });

  it('fecha pasada: error y no envía', () => {
    rellenar({ fecha: '2020-01-01' });
    enviar();
    http.expectNone('/api/reservas');
    expect(el.querySelector('#fecha-error')?.textContent).toContain('Solo se puede reservar a partir de mañana');
  });

  it('hoy: error y no envía', () => {
    rellenar({ fecha: HOY, inicio: '23:00', fin: '23:30' });
    enviar();
    http.expectNone('/api/reservas');
    expect(el.querySelector('#fecha-error')?.textContent).toContain('Solo se puede reservar a partir de mañana');
  });

  it('mañana a primera hora (00:00): se envía', () => {
    rellenar({ fecha: MANANA, inicio: '00:00', fin: '01:00' });
    enviar();
    const req = http.expectOne('/api/reservas');
    expect(req.request.body.horaInicio).toBe('00:00');
    req.flush({});
  });

  it('el min del input de fecha es mañana', () => {
    expect((el.querySelector('#fecha') as HTMLInputElement).min).toBe(MANANA);
  });

  it('fin de año: el min es el 1 de enero', () => {
    ahora = new Date(2026, 11, 31, 23, 59);
    const otro = TestBed.createComponent(ReservaFormComponent);
    const el2 = otro.nativeElement as HTMLElement;
    otro.detectChanges();
    http.expectOne('/api/salas').flush(SALAS);
    otro.detectChanges();
    expect((el2.querySelector('#fecha') as HTMLInputElement).min).toBe('2027-01-01');
  });

  it('guardar() revalida: si cambia el día tras rellenar, no se envía', () => {
    rellenar();
    ahora = new Date(2026, 9, 2, 0, 1);
    enviar();
    http.expectNone('/api/reservas');
    expect(el.textContent).toContain('Solo se puede reservar a partir de mañana');
  });

  it('responsable de más de 100 caracteres no se envía', () => {
    rellenar({ responsable: 'a'.repeat(101) });
    // maxlength del input recorta en navegador real, pero el valor programático lo supera
    enviar();
    http.expectNone('/api/reservas');
    expect(el.textContent).toContain('Máximo 100 caracteres');
  });

  it('envía la petición normalizada y navega a /reservas al guardar', () => {
    rellenar();
    enviar();
    const req = http.expectOne('/api/reservas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      salaId: 2,
      fecha: MANANA,
      horaInicio: '10:00',
      horaFin: '11:00',
      responsable: 'Ana',
      motivo: 'Reunión',
    });
    expect(router.navigate).not.toHaveBeenCalled();
    req.flush({ id: 1 });
    expect(router.navigate).toHaveBeenCalledWith(['/reservas']);
  });

  it('409: muestra mensaje de solapamiento y no navega', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').flush(
      { title: 'Conflicto', status: 409, detail: 'Solapa con otra reserva' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    const alerta = el.querySelector('.error-general')?.textContent ?? '';
    expect(alerta).toContain('ya está reservada');
    expect(alerta).toContain('Solapa con otra reserva');
    expect(router.navigate).not.toHaveBeenCalled();
    expect((el.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('404: muestra que la sala no existe', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'NF' });
    fixture.detectChanges();
    expect(el.querySelector('.error-general')?.textContent).toContain('La sala seleccionada ya no existe');
  });

  it('400 con errores por campo: los muestra junto a cada campo', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').flush(
      {
        title: 'Validación',
        status: 400,
        errores: [
          { campo: 'motivo', mensaje: 'Motivo demasiado largo' },
          { campo: 'horaFin', mensaje: 'Fin inválida' },
        ],
      },
      { status: 400, statusText: 'Bad' },
    );
    fixture.detectChanges();
    expect(el.querySelector('#motivo-error')?.textContent).toContain('Motivo demasiado largo');
    expect(el.querySelector('#hora-fin-error')?.textContent).toContain('Fin inválida');
    expect(el.querySelector('#fecha-error')?.textContent?.trim()).toBe('');
    expect(el.querySelector('.error-general')).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('400 con campo desconocido: lo muestra en el bloque general', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').flush(
      { title: 'Validación', status: 400, errores: [{ campo: 'raro', mensaje: 'Mal' }] },
      { status: 400, statusText: 'Bad' },
    );
    fixture.detectChanges();
    const general = el.querySelector('.error-general')?.textContent ?? '';
    expect(general).toContain('Revisa los datos');
    expect(general).toContain('raro: Mal');
  });

  it('servidor no disponible: mensaje comprensible', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(el.querySelector('.error-general')?.textContent).toContain('Servidor no disponible');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('un error de servidor en un campo se puede reenviar tras corregir', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').flush(
      { title: 'V', status: 400, errores: [{ campo: 'motivo', mensaje: 'Mal' }] },
      { status: 400, statusText: 'Bad' },
    );
    fixture.detectChanges();
    escribir('motivo', 'Otro motivo');
    fixture.detectChanges();
    enviar();
    http.expectOne('/api/reservas').flush({ id: 1 });
    expect(router.navigate).toHaveBeenCalledWith(['/reservas']);
  });

  it('400 sin errores: muestra el bloque general con el detail', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').flush(
      { title: 'Validación', status: 400, detail: 'Petición malformada' },
      { status: 400, statusText: 'Bad' },
    );
    fixture.detectChanges();
    const general = el.querySelector('.error-general')?.textContent ?? '';
    expect(general).toContain('Revisa los datos');
    expect(general).toContain('Petición malformada');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('400 mixto: campo conocido junto al campo y el desconocido en el bloque general', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').flush(
      {
        title: 'Validación',
        status: 400,
        errores: [
          { campo: 'motivo', mensaje: 'Motivo malo' },
          { campo: 'raro', mensaje: 'Mal' },
        ],
      },
      { status: 400, statusText: 'Bad' },
    );
    fixture.detectChanges();
    expect(el.querySelector('#motivo-error')?.textContent).toContain('Motivo malo');
    const general = el.querySelector('.error-general')?.textContent ?? '';
    expect(general).toContain('raro: Mal');
    expect(general).not.toContain('Motivo malo');
  });

  it('un error de servidor en un campo desaparece al editar ese campo', () => {
    rellenar();
    enviar();
    http.expectOne('/api/reservas').flush(
      { title: 'V', status: 400, errores: [{ campo: 'motivo', mensaje: 'Mal' }] },
      { status: 400, statusText: 'Bad' },
    );
    fixture.detectChanges();
    expect(el.querySelector('#motivo-error')?.textContent).toContain('Mal');
    escribir('motivo', 'Otro motivo');
    fixture.detectChanges();
    expect(el.querySelector('#motivo-error')?.textContent?.trim()).toBe('');
  });

  it('mientras se envía el botón está deshabilitado y muestra «Guardando…»', () => {
    rellenar();
    enviar();
    const boton = el.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(boton.disabled).toBeTrue();
    expect(boton.textContent).toContain('Guardando…');
    http.expectOne('/api/reservas').flush({ id: 1 });
  });

  it('«Cancelar» enlaza a /reservas', () => {
    const enlace = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('Cancelar'));
    expect(enlace?.getAttribute('href')).toBe('/reservas');
  });

  it('si falla GET /api/salas muestra un aviso con role=alert', () => {
    const otro = TestBed.createComponent(ReservaFormComponent);
    otro.detectChanges();
    http
      .expectOne('/api/salas')
      .flush({ title: 'x', status: 500, detail: 'Fallo salas' }, { status: 500, statusText: 'e' });
    otro.detectChanges();
    const aviso = (otro.nativeElement as HTMLElement).querySelector('.aviso');
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(aviso?.textContent).toContain('Fallo salas');
  });
});
