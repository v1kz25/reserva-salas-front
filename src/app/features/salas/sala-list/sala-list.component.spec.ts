import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { SalaListComponent } from './sala-list.component';

const SALAS = [
  { id: 1, nombre: 'Sala Norte', capacidad: 10, planta: 2 },
  { id: 2, nombre: 'Sala Sur', capacidad: 4, planta: -1 },
];

const sinContenido = { status: 204, statusText: 'No Content' };

describe('SalaListComponent', () => {
  let fixture: ComponentFixture<SalaListComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  async function crear(estado?: Record<string, unknown>): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [SalaListComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    if (estado) {
      spyOn(router, 'getCurrentNavigation').and.returnValue({ extras: { state: estado } } as never);
    }
    fixture = TestBed.createComponent(SalaListComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    el.remove();
  });

  async function cargada(salas = SALAS, estado?: Record<string, unknown>): Promise<void> {
    await crear(estado);
    http.expectOne('/api/salas').flush(salas);
    fixture.detectChanges();
  }

  const filas = () => Array.from(el.querySelectorAll('tbody tr'));
  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;
  const botonEliminar = (nombre: string) =>
    el.querySelector(`button[aria-label="Eliminar la sala ${nombre}"]`) as HTMLButtonElement;

  async function abrirDialogo(nombre = 'Sala Norte'): Promise<void> {
    botonEliminar(nombre).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra «Cargando» y después la tabla con nombre, capacidad y planta', async () => {
    await crear();
    expect(el.textContent).toContain('Cargando salas');
    http.expectOne('/api/salas').flush(SALAS);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Cargando salas');
    const celdas = filas().map((f) => Array.from(f.querySelectorAll('th, td')).slice(0, 3).map((c) => c.textContent?.trim()));
    expect(celdas).toEqual([
      ['Sala Norte', '10', '2'],
      ['Sala Sur', '4', '-1'],
    ]);
  });

  it('tiene cabeceras de columna con scope y un enlace «Nueva sala»', async () => {
    await cargada();
    const cabeceras = Array.from(el.querySelectorAll('thead th')).map((t) => t.getAttribute('scope'));
    expect(cabeceras.every((s) => s === 'col')).toBeTrue();
    expect(el.querySelector('a[href="/admin/salas/nueva"]')?.textContent).toContain('Nueva sala');
  });

  it('cada fila tiene un enlace «Editar» a /admin/salas/{id} y un botón «Eliminar» con nombre accesible', async () => {
    await cargada();
    expect(el.querySelector('a[href="/admin/salas/1"]')?.textContent?.trim()).toBe('Editar');
    expect(el.querySelector('a[href="/admin/salas/2"]')?.getAttribute('aria-label')).toBe('Editar la sala Sala Sur');
    expect(botonEliminar('Sala Norte').textContent?.trim()).toBe('Eliminar');
    expect(botonEliminar('Sala Sur')).not.toBeNull();
  });

  it('lista vacía: muestra el mensaje de vacío', async () => {
    await cargada([]);
    expect(el.textContent).toContain('No hay salas');
    expect(el.querySelector('a[href="/admin/salas/nueva"]')).not.toBeNull();
  });

  it('error al cargar: muestra un alert y no la tabla', async () => {
    await crear();
    http.expectOne('/api/salas').flush(null, { status: 0, statusText: '' });
    fixture.detectChanges();
    expect(el.querySelector('p.error[role="alert"]')?.textContent).toContain('No se ha podido conectar');
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).not.toContain('No hay salas');
  });

  it('el nombre de la sala se muestra como texto, no como HTML', async () => {
    await cargada([{ id: 3, nombre: '<b>X</b>', capacidad: 2, planta: 0 }]);
    expect(el.querySelector('tbody b')).toBeNull();
    expect(el.querySelector('tbody th')?.textContent).toContain('<b>X</b>');
  });

  describe('aviso al volver del formulario', () => {
    it('muestra el aviso recibido en el estado de navegación en una región de estado', async () => {
      await cargada(SALAS, { aviso: 'Sala «Nueva» creada.' });
      expect(el.querySelector('[role="status"] .exito')?.textContent).toContain('Sala «Nueva» creada.');
    });

    it('sin aviso en el estado no muestra ninguno', async () => {
      await cargada();
      expect(el.querySelector('.exito')).toBeNull();
    });

    it('ignora un aviso que no es texto', async () => {
      await cargada(SALAS, { aviso: 42 });
      expect(el.querySelector('.exito')).toBeNull();
    });
  });

  describe('eliminar', () => {
    it('«Eliminar» abre el diálogo con el nombre de la sala y no envía nada', async () => {
      await cargada();
      await abrirDialogo();
      const dialogo = el.querySelector('dialog') as HTMLDialogElement;
      expect(dialogo.open).toBeTrue();
      expect(dialogo.textContent).toContain('Sala Norte');
      http.expectNone(() => true);
    });

    it('cancelar el diálogo cierra y no envía DELETE ni cambia el listado', async () => {
      await cargada();
      await abrirDialogo();
      boton('No, mantenerla').click();
      await estabilizar();
      expect((el.querySelector('dialog') as HTMLDialogElement).open).toBeFalse();
      expect(filas().length).toBe(2);
      http.expectNone(() => true);
    });

    it('Esc cierra el diálogo sin eliminar', async () => {
      await cargada();
      await abrirDialogo();
      (el.querySelector('dialog') as HTMLDialogElement).dispatchEvent(new Event('cancel', { cancelable: true }));
      await estabilizar();
      expect((el.querySelector('dialog') as HTMLDialogElement).open).toBeFalse();
      http.expectNone(() => true);
    });

    it('tras cancelar, un nuevo «Eliminar» sobre otra sala usa esa sala', async () => {
      await cargada();
      await abrirDialogo('Sala Norte');
      boton('No, mantenerla').click();
      await estabilizar();
      await abrirDialogo('Sala Sur');
      boton('Sí, eliminar la sala').click();
      const req = http.expectOne('/api/salas/2');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, sinContenido);
      http.expectOne('/api/salas').flush([SALAS[0]]);
    });

    it('confirmar envía DELETE; con 204 quita la fila, recarga y muestra el aviso', async () => {
      await cargada();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      const req = http.expectOne('/api/salas/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, sinContenido);
      await estabilizar();
      expect(filas().map((f) => f.querySelector('th')?.textContent?.trim())).toEqual(['Sala Sur']);
      expect(el.querySelector('.exito')?.textContent).toContain('Sala «Sala Norte» eliminada.');
      expect((el.querySelector('dialog') as HTMLDialogElement).open).toBeFalse();
      // recarga silenciosa: sin «Cargando» y la tabla sigue visible
      expect(el.textContent).not.toContain('Cargando salas');
      http.expectOne('/api/salas').flush([SALAS[1]]);
      fixture.detectChanges();
      expect(filas().length).toBe(1);
    });

    it('la recarga tras eliminar refleja cambios hechos por otros', async () => {
      await cargada();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      http.expectOne('/api/salas/1').flush(null, sinContenido);
      http.expectOne('/api/salas').flush([SALAS[1], { id: 7, nombre: 'Sala Nueva', capacidad: 3, planta: 0 }]);
      fixture.detectChanges();
      expect(filas().length).toBe(2);
      expect(el.textContent).toContain('Sala Nueva');
    });

    it('eliminar la última sala deja el mensaje de vacío', async () => {
      await cargada([SALAS[0]]);
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      http.expectOne('/api/salas/1').flush(null, sinContenido);
      http.expectOne('/api/salas').flush([]);
      await estabilizar();
      expect(el.textContent).toContain('No hay salas');
    });

    it('409 por reservas futuras: mensaje claro, la sala sigue en el listado y se recarga', async () => {
      await cargada();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      http
        .expectOne('/api/salas/1')
        .flush({ title: 'Conflicto', status: 409, detail: 'x' }, { status: 409, statusText: 'Conflict' });
      http.expectOne('/api/salas').flush(SALAS);
      await estabilizar();
      const alerta = el.querySelector('.error-general[role="alert"]');
      expect(alerta?.textContent).toContain('reservas futuras');
      expect(alerta?.textContent).toContain('Sala Norte');
      expect(filas().length).toBe(2);
      expect(el.querySelector('.exito')).toBeNull();
      expect((el.querySelector('dialog') as HTMLDialogElement).open).toBeFalse();
    });

    it('404: indica que ya no existía, quita la fila y recarga', async () => {
      await cargada();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      http.expectOne('/api/salas/1').flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      http.expectOne('/api/salas').flush([SALAS[1]]);
      await estabilizar();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('La sala ya no existe');
      expect(filas().map((f) => f.querySelector('th')?.textContent?.trim())).toEqual(['Sala Sur']);
    });

    it('un nuevo intento de eliminar limpia el mensaje de error anterior', async () => {
      await cargada();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      http.expectOne('/api/salas/1').flush({ title: 'C', status: 409 }, { status: 409, statusText: 'Conflict' });
      http.expectOne('/api/salas').flush(SALAS);
      await estabilizar();
      expect(el.querySelector('.error-general')).not.toBeNull();
      await abrirDialogo('Sala Sur');
      expect(el.querySelector('.error-general')).toBeNull();
    });

    it('doble clic en confirmar envía un solo DELETE y el botón queda marcado como ocupado', async () => {
      await cargada();
      await abrirDialogo();
      const confirmar = boton('Sí, eliminar la sala');
      confirmar.click();
      confirmar.click();
      fixture.detectChanges();
      const reqs = http.match('/api/salas/1');
      expect(reqs.length).toBe(1);
      expect(boton('Eliminando').getAttribute('aria-disabled')).toBe('true');
      reqs[0].flush(null, sinContenido);
      http.expectOne('/api/salas').flush([SALAS[1]]);
    });

    it('mientras se elimina, otro «Eliminar» no abre otro diálogo ni cambia la sala', async () => {
      await cargada();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      botonEliminar('Sala Sur').click();
      http.expectOne('/api/salas/1').flush(null, sinContenido);
      http.expectOne('/api/salas').flush([SALAS[1]]);
      expect(http.match('/api/salas/2').length).toBe(0);
    });

    it('error de servidor (500) al eliminar muestra el mensaje y mantiene la fila', async () => {
      await cargada();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      http.expectOne('/api/salas/1').flush({ title: 'Error', status: 500 }, { status: 500, statusText: 'Server Error' });
      await estabilizar();
      expect(filas().length).toBe(2);
      expect(el.querySelector('.exito')).toBeNull();
    });

    it('accesibilidad: al abrir el diálogo el foco va a «No, mantenerla»', async () => {
      await cargada();
      botonEliminar('Sala Norte').focus();
      await abrirDialogo();
      expect(document.activeElement).toBe(boton('No, mantenerla'));
    });

    it('accesibilidad: al cancelar, el foco vuelve al botón «Eliminar» que lo abrió', async () => {
      await cargada();
      botonEliminar('Sala Norte').focus();
      await abrirDialogo();
      boton('No, mantenerla').click();
      await estabilizar();
      expect(document.activeElement).toBe(botonEliminar('Sala Norte'));
    });

    it('accesibilidad: tras eliminar, con la fila desaparecida el foco no se pierde (va al título)', async () => {
      await cargada();
      botonEliminar('Sala Norte').focus();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      http.expectOne('/api/salas/1').flush(null, sinContenido);
      http.expectOne('/api/salas').flush([SALAS[1]]);
      await estabilizar();
      await new Promise((r) => setTimeout(r));
      expect(document.activeElement).toBe(el.querySelector('h1'));
    });

    it('accesibilidad: tras un 409 el foco vuelve a un elemento de la página', async () => {
      await cargada();
      botonEliminar('Sala Norte').focus();
      await abrirDialogo();
      boton('Sí, eliminar la sala').click();
      http.expectOne('/api/salas/1').flush({ title: 'C', status: 409 }, { status: 409, statusText: 'Conflict' });
      http.expectOne('/api/salas').flush(SALAS);
      await estabilizar();
      await new Promise((r) => setTimeout(r));
      expect(document.activeElement).not.toBe(document.body);
      expect(el.contains(document.activeElement)).toBeTrue();
    });
  });
});
