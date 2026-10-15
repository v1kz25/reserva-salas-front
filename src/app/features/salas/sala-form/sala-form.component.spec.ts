import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { SalaFormComponent } from './sala-form.component';

const SALA = { id: 5, nombre: 'Sala Sur', capacidad: 4, planta: -1 };

describe('SalaFormComponent', () => {
  let fixture: ComponentFixture<SalaFormComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  async function crear(id: string | null): Promise<void> {
    params = new BehaviorSubject(convertToParamMap(id === null ? {} : { id }));
    await TestBed.configureTestingModule({
      imports: [SalaFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(SalaFormComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    el.remove();
  });

  const input = (id: string) => el.querySelector(`#${id}`) as HTMLInputElement;
  const enviar = () => el.querySelector('button[type="submit"]') as HTMLButtonElement;

  function rellenar(nombre: string, capacidad: string, planta: string): void {
    for (const [id, valor] of [
      ['nombre', nombre],
      ['capacidad', capacidad],
      ['planta', planta],
    ]) {
      const campo = input(id);
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  }

  function pulsarGuardar(): void {
    enviar().click();
    fixture.detectChanges();
  }

  const errores = (id: string) =>
    Array.from(el.querySelectorAll(`#${id}-error .error`)).map((p) => p.textContent?.trim());

  async function editar(): Promise<void> {
    await crear('5');
    http.expectOne('/api/salas/5').flush(SALA);
    fixture.detectChanges();
  }

  describe('alta', () => {
    beforeEach(async () => {
      await crear(null);
    });

    it('muestra el título «Nueva sala», los tres campos con su label y sin peticiones', () => {
      expect(el.querySelector('h1')?.textContent).toContain('Nueva sala');
      for (const id of ['nombre', 'capacidad', 'planta']) {
        const label = el.querySelector(`label[for="${id}"]`);
        expect(label).not.toBeNull();
        expect(input(id)).not.toBeNull();
      }
      expect(input('nombre').value).toBe('');
      http.expectNone(() => true);
    });

    it('envía POST /api/salas con el cuerpo y vuelve al listado con aviso', () => {
      rellenar('Sala Este', '12', '3');
      pulsarGuardar();
      const req = http.expectOne('/api/salas');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ nombre: 'Sala Este', capacidad: 12, planta: 3 });
      req.flush({ id: 9, nombre: 'Sala Este', capacidad: 12, planta: 3 });
      expect(router.navigate).toHaveBeenCalledOnceWith(['/admin/salas'], {
        state: { aviso: 'Sala «Sala Este» creada.' },
      });
    });

    it('recorta los espacios del nombre en el cuerpo enviado', () => {
      rellenar('   Sala Este  ', '2', '0');
      pulsarGuardar();
      const req = http.expectOne('/api/salas');
      expect(req.request.body.nombre).toBe('Sala Este');
      req.flush({ id: 9, ...req.request.body });
    });

    it('la planta 0 y las plantas negativas (sótanos) son válidas', () => {
      for (const planta of ['0', '-1', '-3']) {
        rellenar('S', '2', planta);
        expect(input('planta').getAttribute('aria-invalid')).not.toBe('true');
      }
      rellenar('S', '2', '-2');
      pulsarGuardar();
      const req = http.expectOne('/api/salas');
      expect(req.request.body.planta).toBe(-2);
      req.flush({ id: 9, ...req.request.body });
    });

    it('nombre vacío no se envía y muestra el error', () => {
      rellenar('', '2', '1');
      pulsarGuardar();
      http.expectNone(() => true);
      expect(errores('nombre')).toEqual(['Indica el nombre.']);
      expect(input('nombre').getAttribute('aria-invalid')).toBe('true');
    });

    it('nombre solo con espacios no se envía', () => {
      rellenar('    ', '2', '1');
      pulsarGuardar();
      http.expectNone(() => true);
      expect(errores('nombre')).toEqual(['Indica el nombre.']);
    });

    it('nombre de 100 caracteres es válido; el de 101 no (el límite está en maxlength y en la validación)', () => {
      expect(input('nombre').getAttribute('maxlength')).toBe('100');
      rellenar('a'.repeat(100), '2', '1');
      pulsarGuardar();
      const req = http.expectOne('/api/salas');
      expect(req.request.body.nombre.length).toBe(100);
      req.flush({ id: 1, ...req.request.body });
    });

    it('nombre de 101 caracteres (si se salta el maxlength) no se envía', () => {
      rellenar('a'.repeat(101), '2', '1');
      pulsarGuardar();
      http.expectNone(() => true);
      expect(errores('nombre')).toEqual(['Máximo 100 caracteres.']);
    });

    for (const valor of ['0', '-1']) {
      it(`capacidad ${valor} (< 1) no se acepta`, () => {
        rellenar('S', valor, '1');
        pulsarGuardar();
        http.expectNone(() => true);
        expect(errores('capacidad')).toEqual(['La capacidad debe ser de al menos 1 persona.']);
        expect(input('capacidad').getAttribute('aria-invalid')).toBe('true');
      });
    }

    it('capacidad 1 es válida', () => {
      rellenar('S', '1', '1');
      pulsarGuardar();
      http.expectOne('/api/salas').flush({ id: 1, nombre: 'S', capacidad: 1, planta: 1 });
    });

    it('capacidad decimal no se acepta', () => {
      rellenar('S', '2.5', '1');
      pulsarGuardar();
      http.expectNone(() => true);
      expect(errores('capacidad')).toEqual(['La capacidad debe ser un número entero.']);
    });

    it('capacidad vacía no se acepta', () => {
      rellenar('S', '', '1');
      pulsarGuardar();
      http.expectNone(() => true);
      expect(errores('capacidad')).toEqual(['Indica la capacidad.']);
    });

    it('planta decimal no se acepta', () => {
      rellenar('S', '2', '1.5');
      pulsarGuardar();
      http.expectNone(() => true);
      expect(errores('planta')).toEqual(['La planta debe ser un número entero.']);
      expect(input('planta').getAttribute('aria-invalid')).toBe('true');
    });

    it('planta vacía no se acepta (0 no es lo mismo que vacío)', () => {
      rellenar('S', '2', '');
      pulsarGuardar();
      http.expectNone(() => true);
      expect(errores('planta')).toEqual(['Indica la planta.']);
    });

    it('formulario vacío: marca los tres campos como inválidos', () => {
      pulsarGuardar();
      http.expectNone(() => true);
      for (const id of ['nombre', 'capacidad', 'planta']) {
        expect(input(id).getAttribute('aria-invalid')).toBe('true');
      }
    });

    it('los campos no tocados no son aria-invalid antes de enviar', () => {
      for (const id of ['nombre', 'capacidad', 'planta']) {
        expect(input(id).getAttribute('aria-invalid')).not.toBe('true');
      }
    });

    it('cada campo está asociado a su zona de error con aria-describedby', () => {
      for (const id of ['nombre', 'capacidad', 'planta']) {
        expect(input(id).getAttribute('aria-describedby')).toContain(`${id}-error`);
        expect(el.querySelector(`#${id}-error`)).not.toBeNull();
      }
    });

    it('409: muestra «Ya existe una sala con ese nombre.» en el campo nombre, sin navegar', () => {
      rellenar('Sala Sur', '4', '1');
      pulsarGuardar();
      http.expectOne('/api/salas').flush({ title: 'Conflicto', status: 409 }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(errores('nombre')).toEqual(['Ya existe una sala con ese nombre.']);
      expect(input('nombre').getAttribute('aria-invalid')).toBe('true');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(enviar().disabled).toBeFalse();
    });

    it('tras un 409, corregir el nombre quita el error y permite reenviar', () => {
      rellenar('Sala Sur', '4', '1');
      pulsarGuardar();
      http.expectOne('/api/salas').flush({ title: 'C', status: 409 }, { status: 409, statusText: 'Conflict' });
      rellenar('Sala Sur 2', '4', '1');
      expect(errores('nombre')).toEqual([]);
      pulsarGuardar();
      http.expectOne('/api/salas').flush({ id: 2, nombre: 'Sala Sur 2', capacidad: 4, planta: 1 });
    });

    it('400 con errores por campo: cada mensaje aparece bajo su campo', () => {
      rellenar('S', '2', '1');
      pulsarGuardar();
      http.expectOne('/api/salas').flush(
        {
          title: 'Datos no válidos',
          status: 400,
          errores: [
            { campo: 'capacidad', mensaje: 'debe ser mayor que 0' },
            { campo: 'planta', mensaje: 'planta no válida' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      expect(errores('capacidad')).toContain('debe ser mayor que 0');
      expect(errores('planta')).toContain('planta no válida');
      expect(input('capacidad').getAttribute('aria-invalid')).toBe('true');
      expect(el.querySelector('.error-general')).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('400 con un error de un campo desconocido: se muestra en el bloque general', () => {
      rellenar('S', '2', '1');
      pulsarGuardar();
      http.expectOne('/api/salas').flush(
        { title: 'Datos no válidos', status: 400, errores: [{ campo: 'otro', mensaje: 'raro' }] },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('otro: raro');
    });

    it('400 sin detalle por campo: muestra el aviso general', () => {
      rellenar('S', '2', '1');
      pulsarGuardar();
      http.expectOne('/api/salas').flush({ title: 'Datos no válidos', status: 400 }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('Revisa los datos');
    });

    it('mientras envía, el botón está desactivado y un segundo envío no repite la petición', () => {
      rellenar('S', '2', '1');
      pulsarGuardar();
      expect(enviar().disabled).toBeTrue();
      expect(enviar().textContent).toContain('Guardando');
      el.querySelector('form')?.dispatchEvent(new Event('submit'));
      enviar().click();
      const reqs = http.match('/api/salas');
      expect(reqs.length).toBe(1);
      reqs[0].flush({ id: 1, nombre: 'S', capacidad: 2, planta: 1 });
    });

    it('si el envío falla, el botón se reactiva', () => {
      rellenar('S', '2', '1');
      pulsarGuardar();
      http.expectOne('/api/salas').flush({ title: 'C', status: 409 }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(enviar().disabled).toBeFalse();
      expect(enviar().textContent).toContain('Guardar sala');
    });

    it('tiene un enlace «Cancelar» al listado', () => {
      expect(el.querySelector('a[href="/admin/salas"]')?.textContent).toContain('Cancelar');
    });
  });

  describe('edición', () => {
    it('GET /api/salas/{id} y pre-rellena el formulario con los datos (planta negativa incluida)', async () => {
      await crear('5');
      expect(el.textContent).toContain('Cargando sala');
      const req = http.expectOne('/api/salas/5');
      expect(req.request.method).toBe('GET');
      req.flush(SALA);
      fixture.detectChanges();
      expect(el.querySelector('h1')?.textContent).toContain('Editar sala');
      expect(input('nombre').value).toBe('Sala Sur');
      expect(input('capacidad').value).toBe('4');
      expect(input('planta').value).toBe('-1');
    });

    it('guardar envía PUT /api/salas/{id} y vuelve al listado con el aviso de guardada', async () => {
      await editar();
      rellenar('  Sala Sur II ', '6', '-2');
      pulsarGuardar();
      const req = http.expectOne('/api/salas/5');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ nombre: 'Sala Sur II', capacidad: 6, planta: -2 });
      req.flush({ id: 5, nombre: 'Sala Sur II', capacidad: 6, planta: -2 });
      expect(router.navigate).toHaveBeenCalledOnceWith(['/admin/salas'], {
        state: { aviso: 'Sala «Sala Sur II» guardada.' },
      });
    });

    it('guardar sin cambios también envía PUT con los datos originales', async () => {
      await editar();
      pulsarGuardar();
      const req = http.expectOne('/api/salas/5');
      expect(req.request.body).toEqual({ nombre: 'Sala Sur', capacidad: 4, planta: -1 });
      req.flush(SALA);
    });

    it('las validaciones también aplican al editar', async () => {
      await editar();
      rellenar('', '0', '');
      pulsarGuardar();
      http.expectNone(() => true);
      expect(errores('nombre').length).toBe(1);
      expect(errores('capacidad').length).toBe(1);
      expect(errores('planta').length).toBe(1);
    });

    it('409 al editar: error en el campo nombre', async () => {
      await editar();
      pulsarGuardar();
      http.expectOne('/api/salas/5').flush({ title: 'C', status: 409 }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(errores('nombre')).toEqual(['Ya existe una sala con ese nombre.']);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('404 al guardar (sala eliminada entretanto): muestra «La sala no existe» y oculta el formulario', async () => {
      await editar();
      pulsarGuardar();
      http.expectOne('/api/salas/5').flush({ title: 'NF', status: 404 }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('La sala no existe');
      expect(el.querySelector('form')).toBeNull();
      expect(el.querySelector('a[href="/admin/salas"]')).not.toBeNull();
    });

    it('404 al cargar: muestra «La sala no existe» con enlace al listado', async () => {
      await crear('5');
      http.expectOne('/api/salas/5').flush({ title: 'NF', status: 404 }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('La sala no existe');
      expect(el.querySelector('form')).toBeNull();
      expect(el.querySelector('a[href="/admin/salas"]')).not.toBeNull();
    });

    for (const id of ['abc', '0', '-3', '1.5', '', '99999999999999999999']) {
      it(`id inválido «${id}»: sin peticiones y «La sala no existe»`, async () => {
        await crear(id);
        expect(el.textContent).toContain('La sala no existe');
        expect(el.querySelector('form')).toBeNull();
        http.expectNone(() => true);
      });
    }

    it('otros errores al cargar muestran el mensaje, no «no existe»', async () => {
      await crear('5');
      http.expectOne('/api/salas/5').flush(null, { status: 0, statusText: '' });
      fixture.detectChanges();
      expect(el.querySelector('p.error')?.textContent).toContain('No se ha podido conectar');
      expect(el.textContent).not.toContain('La sala no existe');
      expect(el.querySelector('form')).toBeNull();
    });

    it('cambiar el parámetro de la ruta recarga el formulario con la otra sala', async () => {
      await editar();
      params.next(convertToParamMap({ id: '6' }));
      http.expectOne('/api/salas/6').flush({ id: 6, nombre: 'Otra', capacidad: 8, planta: 0 });
      fixture.detectChanges();
      expect(input('nombre').value).toBe('Otra');
    });

    it('pasar de edición a alta vacía el formulario y vuelve a «Nueva sala»', async () => {
      await editar();
      params.next(convertToParamMap({}));
      fixture.detectChanges();
      expect(el.querySelector('h1')?.textContent).toContain('Nueva sala');
      expect(input('nombre').value).toBe('');
    });

    it('accesibilidad: tras un 404 al guardar, el foco no se pierde (va al título)', async () => {
      await editar();
      input('nombre').focus();
      pulsarGuardar();
      http.expectOne('/api/salas/5').flush({ title: 'NF', status: 404 }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
      expect(document.activeElement).toBe(el.querySelector('h1'));
    });
  });
});
