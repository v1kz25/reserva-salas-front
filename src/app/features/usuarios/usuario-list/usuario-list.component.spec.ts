import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { UsuarioAdmin } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { UsuarioListComponent } from './usuario-list.component';

const ADMIN: UsuarioAdmin = {
  id: 9,
  email: 'admin@example.com',
  nombre: 'Admin',
  rol: 'ADMIN',
  activo: true,
  fechaCreacion: '2026-10-01T10:00:00+02:00',
};
const ANA: UsuarioAdmin = {
  id: 1,
  email: 'ana@example.com',
  nombre: 'Ana',
  rol: 'USER',
  activo: true,
  fechaCreacion: '2026-10-05T10:00:00+02:00',
};
const LUIS: UsuarioAdmin = {
  id: 2,
  email: 'luis@example.com',
  nombre: 'Luis',
  rol: 'USER',
  activo: false,
  fechaCreacion: '2026-10-06T10:00:00+02:00',
};
const USUARIOS = [ADMIN, ANA, LUIS];

describe('UsuarioListComponent', () => {
  let fixture: ComponentFixture<UsuarioListComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  async function crear(estado?: Record<string, unknown>): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [UsuarioListComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SesionService).establecer({ id: 9, email: ADMIN.email, nombre: ADMIN.nombre, rol: 'ADMIN' });
    if (estado) {
      spyOn(TestBed.inject(Router), 'getCurrentNavigation').and.returnValue({ extras: { state: estado } } as never);
    }
    fixture = TestBed.createComponent(UsuarioListComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  async function cargada(usuarios: UsuarioAdmin[] = USUARIOS, estado?: Record<string, unknown>): Promise<void> {
    await crear(estado);
    http.expectOne('/api/usuarios').flush(usuarios);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    el.remove();
  });

  const filas = () => Array.from(el.querySelectorAll('tbody tr'));
  const fila = (email: string) => filas().find((f) => f.querySelector('th')?.textContent?.trim() === email) as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;
  const botonFila = (email: string) => fila(email).querySelector('button') as HTMLButtonElement;
  const dialogo = () => el.querySelector('dialog') as HTMLDialogElement;

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function abrirDialogo(email: string): Promise<void> {
    botonFila(email).click();
    await estabilizar();
  }

  const conflicto = { title: 'Conflicto', status: 409, detail: 'No puedes desactivar tu propia cuenta.' };

  it('muestra «Cargando» y luego la tabla con email, nombre, rol, estado y fecha de alta', async () => {
    await crear();
    expect(el.textContent).toContain('Cargando usuarios');
    http.expectOne('/api/usuarios').flush(USUARIOS);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Cargando usuarios');
    const cabeceras = Array.from(el.querySelectorAll('thead th')).map((t) => t.textContent?.trim());
    expect(cabeceras.slice(0, 5)).toEqual(['Email', 'Nombre', 'Rol', 'Estado', 'Fecha de alta']);
    expect(Array.from(el.querySelectorAll('thead th')).every((t) => t.getAttribute('scope') === 'col')).toBeTrue();
    const ana = Array.from(fila('ana@example.com').querySelectorAll('th, td')).map((c) => c.textContent?.replace(/\s+/g, ' ').trim());
    expect(ana.slice(0, 4)).toEqual(['ana@example.com', 'Ana', 'Usuario', 'Activo']);
    expect(ana[4]).toMatch(/5 oct\.? 2026/);
    expect(fila('admin@example.com').textContent).toContain('Administrador');
    expect(fila('ana@example.com').querySelector('time')?.getAttribute('datetime')).toBe(ANA.fechaCreacion);
  });

  it('enlace «Nuevo usuario» y enlaces «Editar» con nombre accesible', async () => {
    await cargada();
    expect(el.querySelector('a[href="/admin/usuarios/nuevo"]')?.textContent).toContain('Nuevo usuario');
    const editar = el.querySelector('a[href="/admin/usuarios/1"]');
    expect(editar?.textContent?.trim()).toBe('Editar');
    expect(editar?.getAttribute('aria-label')).toContain('Ana');
    expect(editar?.getAttribute('aria-label')).toContain('ana@example.com');
  });

  it('los inactivos llevan la etiqueta «Inactivo», clase visual y no solo color', async () => {
    await cargada();
    expect(fila('luis@example.com').textContent).toContain('Inactivo');
    expect(fila('luis@example.com').classList.contains('inactivo')).toBeTrue();
    expect(fila('ana@example.com').textContent).not.toContain('Inactivo');
    expect(fila('ana@example.com').classList.contains('inactivo')).toBeFalse();
  });

  it('el propio administrador aparece marcado «(tú)» y solo él', async () => {
    await cargada();
    expect(fila('admin@example.com').textContent).toContain('(tú)');
    expect(fila('ana@example.com').textContent).not.toContain('(tú)');
    expect(el.textContent?.match(/\(tú\)/g)?.length).toBe(1);
  });

  it('lista vacía: mensaje de vacío', async () => {
    await cargada([]);
    expect(el.textContent).toContain('No hay usuarios');
  });

  it('error al cargar: alert y sin tabla', async () => {
    await crear();
    http.expectOne('/api/usuarios').flush(null, { status: 0, statusText: '' });
    fixture.detectChanges();
    expect(el.querySelector('p.error[role="alert"]')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();
  });

  it('el nombre y el email se muestran como texto, no como HTML', async () => {
    await cargada([{ ...ANA, nombre: '<b>X</b>' }]);
    expect(el.querySelector('tbody b')).toBeNull();
    expect(el.querySelector('tbody td')?.textContent).toContain('<b>X</b>');
  });

  it('muestra el aviso recibido en el estado de navegación en una región de estado', async () => {
    await cargada(USUARIOS, { aviso: 'Usuario «Eva» creado.' });
    expect(el.querySelector('[role="status"] .exito')?.textContent).toContain('Usuario «Eva» creado.');
  });

  describe('fila propia', () => {
    it('Desactivar lleva aria-disabled y una explicación asociada', async () => {
      await cargada();
      const b = botonFila('admin@example.com');
      expect(b.textContent?.trim()).toBe('Desactivar');
      expect(b.getAttribute('aria-disabled')).toBe('true');
      const ayuda = el.querySelector(`#${b.getAttribute('aria-describedby')}`);
      expect(ayuda?.textContent).toContain('No puedes desactivar tu propia cuenta');
    });

    it('pulsarlo no abre el diálogo ni envía nada', async () => {
      await cargada();
      botonFila('admin@example.com').click();
      await estabilizar();
      expect(dialogo().open).toBeFalse();
      http.expectNone(() => true);
    });

    it('en las demás filas no hay aria-disabled', async () => {
      await cargada();
      expect(botonFila('ana@example.com').hasAttribute('aria-disabled')).toBeFalse();
    });
  });

  describe('activar y desactivar', () => {
    it('el botón depende del estado: Desactivar para activos, Activar para inactivos', async () => {
      await cargada();
      expect(botonFila('ana@example.com').textContent?.trim()).toBe('Desactivar');
      expect(botonFila('luis@example.com').textContent?.trim()).toBe('Activar');
    });

    it('abre el diálogo con el usuario y no envía nada todavía', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      expect(dialogo().open).toBeTrue();
      expect(dialogo().textContent).toContain('Ana');
      expect(dialogo().textContent).toContain('desactivar');
      http.expectNone(() => true);
    });

    it('cancelar con el botón de volver cierra sin enviar', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('No, dejarlo como está').click();
      await estabilizar();
      expect(dialogo().open).toBeFalse();
      http.expectNone(() => true);
    });

    it('Esc cierra el diálogo sin enviar', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      dialogo().dispatchEvent(new Event('cancel', { cancelable: true }));
      await estabilizar();
      expect(dialogo().open).toBeFalse();
      http.expectNone(() => true);
    });

    it('confirmar desactivar envía PUT con nombre y rol actuales y activo=false; actualiza fila, avisa y recarga en silencio', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      const req = http.expectOne('/api/usuarios/1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ nombre: 'Ana', rol: 'USER', activo: false });
      req.flush({ ...ANA, activo: false });
      await estabilizar();
      expect(fila('ana@example.com').textContent).toContain('Inactivo');
      expect(el.querySelector('.exito')?.textContent).toContain('desactivado');
      expect(dialogo().open).toBeFalse();
      expect(el.textContent).not.toContain('Cargando usuarios');
      http.expectOne('/api/usuarios').flush([ADMIN, { ...ANA, activo: false }, LUIS]);
      fixture.detectChanges();
      expect(filas().length).toBe(3);
    });

    it('confirmar activar envía activo=true y avisa de que ya puede iniciar sesión', async () => {
      await cargada();
      await abrirDialogo('luis@example.com');
      expect(dialogo().textContent).toContain('activar');
      boton('Sí, activarlo').click();
      http.expectOne('/api/usuarios/2').flush(LUIS);
      const req = http.expectOne('/api/usuarios/2');
      expect(req.request.body).toEqual({ nombre: 'Luis', rol: 'USER', activo: true });
      req.flush({ ...LUIS, activo: true });
      http.expectOne('/api/usuarios').flush([ADMIN, ANA, { ...LUIS, activo: true }]);
      await estabilizar();
      expect(el.querySelector('.exito')?.textContent).toContain('activado');
      expect(fila('luis@example.com').textContent).not.toContain('Inactivo');
    });

    it('la recarga refleja cambios hechos por otros', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      http.expectOne('/api/usuarios/1').flush({ ...ANA, activo: false });
      http.expectOne('/api/usuarios').flush([ADMIN, { ...ANA, activo: false }, LUIS, { ...ANA, id: 7, email: 'nueva@example.com' }]);
      fixture.detectChanges();
      expect(filas().length).toBe(4);
    });

    it('si falla la recarga se conserva el listado y se avisa', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      http.expectOne('/api/usuarios/1').flush({ ...ANA, activo: false });
      http.expectOne('/api/usuarios').flush(null, { status: 0, statusText: '' });
      await estabilizar();
      expect(filas().length).toBe(3);
      expect(el.querySelector('.aviso[role="alert"]')?.textContent).toContain('No se ha podido actualizar');
    });

    it('doble clic en confirmar envía una sola lectura y un solo PUT', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      const confirmar = boton('Sí, desactivarlo');
      confirmar.click();
      confirmar.click();
      fixture.detectChanges();
      const lecturas = http.match('/api/usuarios/1');
      expect(lecturas.length).toBe(1);
      expect(boton('Guardando').getAttribute('aria-disabled')).toBe('true');
      lecturas[0].flush(ANA);
      const puts = http.match('/api/usuarios/1');
      expect(puts.length).toBe(1);
      expect(puts[0].request.method).toBe('PUT');
      puts[0].flush({ ...ANA, activo: false });
      http.expectOne('/api/usuarios').flush(USUARIOS);
    });

    it('mientras se guarda, otro botón de fila no cambia el usuario pendiente', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      botonFila('luis@example.com').click();
      http.expectOne('/api/usuarios/1').flush({ ...ANA, activo: false });
      http.expectOne('/api/usuarios').flush(USUARIOS);
      expect(http.match('/api/usuarios/2').length).toBe(0);
    });

    it('el PUT lleva el nombre y el rol que devuelve el GET, distintos de los del listado', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      const lectura = http.expectOne('/api/usuarios/1');
      expect(lectura.request.method).toBe('GET');
      lectura.flush({ ...ANA, nombre: 'Ana Renombrada', rol: 'ADMIN' });
      const put = http.expectOne('/api/usuarios/1');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ nombre: 'Ana Renombrada', rol: 'ADMIN', activo: false });
      put.flush({ ...ANA, nombre: 'Ana Renombrada', rol: 'ADMIN', activo: false });
      http.expectOne('/api/usuarios').flush(USUARIOS);
    });

    it('404 en el GET: mensaje, quita la fila, recarga y no envía PUT', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush({ title: 'NF', status: 404 }, { status: 404, statusText: 'Not Found' });
      http.expectOne('/api/usuarios').flush([ADMIN, LUIS]);
      await estabilizar();
      expect(http.match((r) => r.method === 'PUT').length).toBe(0);
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('ya no existe');
      expect(filas().map((f) => f.querySelector('th')?.textContent?.trim())).toEqual(['admin@example.com', 'luis@example.com']);
      expect(dialogo().open).toBeFalse();
    });

    it('404 en el PUT: mensaje, quita la fila y recarga', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      const put = http.expectOne('/api/usuarios/1');
      expect(put.request.method).toBe('PUT');
      put.flush({ title: 'NF', status: 404 }, { status: 404, statusText: 'Not Found' });
      http.expectOne('/api/usuarios').flush([ADMIN, LUIS]);
      await estabilizar();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('ya no existe');
      expect(filas().length).toBe(2);
    });

    it('409: muestra el mensaje del servidor, cierra el diálogo, recarga y no avisa de éxito', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      http.expectOne('/api/usuarios/1').flush(conflicto, { status: 409, statusText: 'Conflict' });
      http.expectOne('/api/usuarios').flush(USUARIOS);
      await estabilizar();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('No puedes desactivar');
      expect(el.querySelector('.exito')).toBeNull();
      expect(dialogo().open).toBeFalse();
      expect(filas().length).toBe(3);
    });

    it('409 sin detalle: usa el mensaje genérico de cambio propio rechazado', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      http.expectOne('/api/usuarios/1').flush({ title: 'Conflicto', status: 409 }, { status: 409, statusText: 'Conflict' });
      http.expectOne('/api/usuarios').flush(USUARIOS);
      await estabilizar();
      expect(el.querySelector('.error-general')?.textContent).toContain('no puede desactivarse');
    });

    it('404: indica que el usuario ya no existe, quita la fila y recarga', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      http.expectOne('/api/usuarios/1').flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      http.expectOne('/api/usuarios').flush([ADMIN, LUIS]);
      await estabilizar();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('ya no existe');
      expect(filas().map((f) => f.querySelector('th')?.textContent?.trim())).toEqual(['admin@example.com', 'luis@example.com']);
    });

    it('un nuevo intento limpia el error anterior', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      http.expectOne('/api/usuarios/1').flush(conflicto, { status: 409, statusText: 'Conflict' });
      http.expectOne('/api/usuarios').flush(USUARIOS);
      await estabilizar();
      expect(el.querySelector('.error-general')).not.toBeNull();
      await abrirDialogo('luis@example.com');
      expect(el.querySelector('.error-general')).toBeNull();
    });

    it('error 500 del servidor: se mantiene la fila y no hay aviso de éxito', async () => {
      await cargada();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      http.expectOne('/api/usuarios/1').flush({ title: 'Error', status: 500 }, { status: 500, statusText: 'Server Error' });
      await estabilizar();
      expect(filas().length).toBe(3);
      expect(el.querySelector('.exito')).toBeNull();
    });
  });

  describe('accesibilidad', () => {
    it('al abrir el diálogo, el foco va al botón de volver', async () => {
      await cargada();
      botonFila('ana@example.com').focus();
      await abrirDialogo('ana@example.com');
      expect(document.activeElement).toBe(boton('No, dejarlo como está'));
    });

    it('al cancelar, el foco vuelve al botón que abrió el diálogo', async () => {
      await cargada();
      botonFila('ana@example.com').focus();
      await abrirDialogo('ana@example.com');
      boton('No, dejarlo como está').click();
      await estabilizar();
      expect(document.activeElement).toBe(botonFila('ana@example.com'));
    });

    it('tras un 404 con la fila desaparecida el foco no se pierde', async () => {
      await cargada();
      botonFila('ana@example.com').focus();
      await abrirDialogo('ana@example.com');
      boton('Sí, desactivarlo').click();
      http.expectOne('/api/usuarios/1').flush(ANA);
      http.expectOne('/api/usuarios/1').flush({ title: 'NF', status: 404 }, { status: 404, statusText: 'Not Found' });
      http.expectOne('/api/usuarios').flush([ADMIN, LUIS]);
      await estabilizar();
      await new Promise((r) => setTimeout(r));
      expect(document.activeElement).not.toBe(document.body);
      expect(el.contains(document.activeElement)).toBeTrue();
    });

    it('tabla en región con nombre, caption y encabezado de fila', async () => {
      await cargada();
      const region = el.querySelector('[role="region"]') as HTMLElement;
      expect(el.querySelector(`#${region.getAttribute('aria-labelledby')}`)?.textContent).toContain('Listado de usuarios');
      expect(el.querySelector('tbody th')?.getAttribute('scope')).toBe('row');
    });

    it('los botones de fila tienen nombre accesible con el usuario', async () => {
      await cargada();
      expect(botonFila('ana@example.com').getAttribute('aria-label')).toBe('Desactivar al usuario Ana (ana@example.com)');
      expect(botonFila('luis@example.com').getAttribute('aria-label')).toBe('Activar al usuario Luis (luis@example.com)');
    });
  });
});
