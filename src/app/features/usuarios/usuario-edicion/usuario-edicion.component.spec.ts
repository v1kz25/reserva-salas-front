import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { UsuarioAdmin } from '../../../core/models/usuario.model';
import { SesionService } from '../../../core/services/sesion.service';
import { UsuarioEdicionComponent } from './usuario-edicion.component';

const ANA: UsuarioAdmin = {
  id: 1,
  email: 'ana@example.com',
  nombre: 'Ana',
  rol: 'USER',
  activo: true,
  fechaCreacion: '2026-10-05T10:00:00+02:00',
};
const ADMIN: UsuarioAdmin = { ...ANA, id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

describe('UsuarioEdicionComponent', () => {
  let fixture: ComponentFixture<UsuarioEdicionComponent>;
  let http: HttpTestingController;
  let navigate: jasmine.Spy;
  let sesion: SesionService;
  let el: HTMLElement;

  async function crear(id: string | null, enSesion = ADMIN): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [UsuarioEdicionComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap(id === null ? {} : { id })) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionService);
    sesion.establecer({ id: enSesion.id, email: enSesion.email, nombre: enSesion.nombre, rol: enSesion.rol });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(UsuarioEdicionComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  async function cargada(usuario = ANA, enSesion = ADMIN): Promise<void> {
    await crear(String(usuario.id), enSesion);
    http.expectOne(`/api/usuarios/${usuario.id}`).flush(usuario);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    el.remove();
  });

  const campo = (id: string) => el.querySelector(`#${id}`) as HTMLInputElement & HTMLSelectElement;

  function escribir(id: string, valor: string): void {
    const c = campo(id);
    c.value = valor;
    c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  async function guardar(): Promise<void> {
    (el.querySelector('form button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const texto = (id: string) => el.querySelector(`#${id}`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  describe('carga', () => {
    it('muestra «Cargando» y después el formulario prerrellenado', async () => {
      await crear('1');
      expect(el.textContent).toContain('Cargando usuario');
      http.expectOne('/api/usuarios/1').flush(ANA);
      fixture.detectChanges();
      expect(campo('nombre').value).toBe('Ana');
      expect(campo('rol').value).toBe('USER');
      expect(campo('activo').checked).toBeTrue();
    });

    it('prerrellena rol ADMIN y estado inactivo', async () => {
      await cargada({ ...ANA, rol: 'ADMIN', activo: false });
      expect(campo('rol').value).toBe('ADMIN');
      expect(campo('activo').checked).toBeFalse();
    });

    it('email y fecha de alta son de solo lectura (texto, no controles)', async () => {
      await cargada();
      const ficha = el.querySelector('dl.ficha') as HTMLElement;
      expect(ficha.textContent).toContain('ana@example.com');
      expect(ficha.querySelector('time')?.getAttribute('datetime')).toBe(ANA.fechaCreacion);
      expect(ficha.querySelector('time')?.textContent).toContain('2026');
      expect(el.querySelector('#email')).toBeNull();
    });

    it('incluye la sección de cambio de contraseña', async () => {
      await cargada();
      expect(el.querySelector('app-cambio-password h2')?.textContent).toContain('Cambiar la contraseña');
    });

    it('id no numérico: «El usuario no existe» sin pedir nada', async () => {
      await crear('abc');
      expect(el.textContent).toContain('El usuario no existe');
      expect(el.querySelector('form')).toBeNull();
      http.expectNone(() => true);
    });

    it('id 0, negativo o con decimales: no existe, sin petición', async () => {
      await crear('0');
      expect(el.textContent).toContain('El usuario no existe');
      http.expectNone(() => true);
    });

    it('404 al cargar: «El usuario no existe» y enlace de vuelta', async () => {
      await crear('77');
      http.expectOne('/api/usuarios/77').flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('El usuario no existe');
      expect(el.querySelector('a[href="/admin/usuarios"]')).not.toBeNull();
      expect(el.querySelector('form')).toBeNull();
    });

    it('error de conexión al cargar: alert y sin formulario', async () => {
      await crear('1');
      http.expectOne('/api/usuarios/1').flush(null, { status: 0, statusText: '' });
      fixture.detectChanges();
      expect(el.querySelector('p.error[role="alert"]')).not.toBeNull();
      expect(el.querySelector('form')).toBeNull();
    });
  });

  describe('usuario distinto del actual', () => {
    it('rol y activo habilitados, sin explicación de cuenta propia', async () => {
      await cargada();
      expect(campo('rol').disabled).toBeFalse();
      expect(campo('activo').disabled).toBeFalse();
      expect(el.querySelector('#rol-ayuda')).toBeNull();
      expect(el.textContent).not.toContain('Es tu propia cuenta');
    });

    it('PUT con el cuerpo editado (nombre recortado, rol y estado)', async () => {
      await cargada();
      escribir('nombre', '  Ana María ');
      escribir('rol', 'ADMIN');
      campo('activo').click();
      await guardar();
      const req = http.expectOne('/api/usuarios/1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ nombre: 'Ana María', rol: 'ADMIN', activo: false });
      req.flush({ ...ANA, nombre: 'Ana María', rol: 'ADMIN', activo: false });
      const [ruta, extras] = navigate.calls.mostRecent().args as [string[], { state: Record<string, string> }];
      expect(ruta).toEqual(['/admin/usuarios']);
      expect(Object.values(extras.state)[0]).toContain('Ana María');
    });

    it('editar a otro usuario no cambia la cabecera (sesión)', async () => {
      await cargada();
      escribir('nombre', 'Otro nombre');
      await guardar();
      http.expectOne('/api/usuarios/1').flush({ ...ANA, nombre: 'Otro nombre' });
      expect(sesion.usuario()?.nombre).toBe('Admin');
    });

    it('nombre vacío: error, foco en el nombre y no envía', async () => {
      await cargada();
      escribir('nombre', '');
      await guardar();
      await new Promise((r) => setTimeout(r));
      expect(texto('nombre-error')).toContain('Indica el nombre');
      expect(document.activeElement).toBe(campo('nombre'));
      http.expectNone(() => true);
    });

    it('nombre en blanco: no envía', async () => {
      await cargada();
      escribir('nombre', '   ');
      await guardar();
      expect(texto('nombre-error')).toContain('Indica el nombre');
      http.expectNone(() => true);
    });

    it('doble envío: una sola petición', async () => {
      await cargada();
      const boton = el.querySelector('form button[type="submit"]') as HTMLButtonElement;
      boton.click();
      boton.click();
      fixture.detectChanges();
      const reqs = http.match('/api/usuarios/1');
      expect(reqs.length).toBe(1);
      expect(boton.textContent).toContain('Guardando');
      reqs[0].flush(ANA);
    });

    it('409: error general con el detalle del servidor, sin navegar y con foco en el aviso', async () => {
      await cargada();
      await guardar();
      http.expectOne('/api/usuarios/1').flush(
        { title: 'Conflicto', status: 409, detail: 'No puedes quitarte el rol de administrador.' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
      const general = el.querySelector('.error-general[role="alert"]') as HTMLElement;
      expect(general.textContent).toContain('No se ha podido guardar el cambio');
      expect(general.textContent).toContain('No puedes quitarte el rol');
      expect(document.activeElement).toBe(general);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('409 sin detalle: mensaje genérico de cambio propio rechazado', async () => {
      await cargada();
      await guardar();
      http.expectOne('/api/usuarios/1').flush({ title: 'Conflicto', status: 409 }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain('no puede desactivarse');
    });

    it('400 sin campo conocido: lista los errores con la etiqueta legible', async () => {
      await cargada();
      await guardar();
      http.expectOne('/api/usuarios/1').flush(
        { title: 'Solicitud no válida', status: 400, errores: [{ campo: 'email', mensaje: 'No se puede cambiar' }, { campo: 'zzz', mensaje: 'x' }] },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      const items = Array.from(el.querySelectorAll('.error-general li')).map((li) => li.textContent?.trim());
      expect(items).toEqual(['Email: No se puede cambiar', 'zzz: x']);
    });

    it('404 al guardar: pasa a «El usuario no existe»', async () => {
      await cargada();
      await guardar();
      http.expectOne('/api/usuarios/1').flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el.querySelector('form')).toBeNull();
      expect(el.querySelector('.error-general')?.textContent).toContain('El usuario no existe');
    });

    it('400 con error en nombre: se muestra en el campo', async () => {
      await cargada();
      await guardar();
      http.expectOne('/api/usuarios/1').flush(
        { title: 'Solicitud no válida', status: 400, errores: [{ campo: 'nombre', mensaje: 'Nombre no permitido' }] },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      expect(texto('nombre-error')).toContain('Nombre no permitido');
    });
  });

  describe('usuario actual (el propio administrador)', () => {
    it('rol y activo deshabilitados, con explicación asociada', async () => {
      await cargada(ADMIN);
      expect(campo('rol').disabled).toBeTrue();
      expect(campo('activo').disabled).toBeTrue();
      expect(campo('nombre').disabled).toBeFalse();
      expect(el.querySelector('#rol-ayuda')?.textContent).toContain('No puedes quitarte el rol de administrador');
      expect(el.querySelector('#activo-ayuda')?.textContent).toContain('No puedes desactivar tu propia cuenta');
      expect(campo('rol').getAttribute('aria-describedby')).toContain('rol-ayuda');
      expect(campo('activo').getAttribute('aria-describedby')).toContain('activo-ayuda');
      expect(el.textContent).toContain('Es tu propia cuenta');
    });

    it('el PUT conserva rol ADMIN y activo=true aunque estén deshabilitados', async () => {
      await cargada(ADMIN);
      escribir('nombre', 'Admin Nuevo');
      await guardar();
      const req = http.expectOne('/api/usuarios/9');
      expect(req.request.body).toEqual({ nombre: 'Admin Nuevo', rol: 'ADMIN', activo: true });
      req.flush({ ...ADMIN, nombre: 'Admin Nuevo' });
    });

    it('al guardar, actualiza el nombre de la cabecera sin cambiar de sesión', async () => {
      await cargada(ADMIN);
      const generacion = sesion.generacion();
      escribir('nombre', 'Admin Nuevo');
      await guardar();
      http.expectOne('/api/usuarios/9').flush({ ...ADMIN, nombre: 'Admin Nuevo' });
      expect(sesion.usuario()?.nombre).toBe('Admin Nuevo');
      expect(sesion.usuario()?.rol).toBe('ADMIN');
      expect(sesion.generacion()).toBe(generacion);
      expect(navigate).toHaveBeenCalled();
    });

    it('si el guardado falla (409), la cabecera no cambia', async () => {
      await cargada(ADMIN);
      escribir('nombre', 'Admin Nuevo');
      await guardar();
      http.expectOne('/api/usuarios/9').flush({ title: 'C', status: 409 }, { status: 409, statusText: 'Conflict' });
      expect(sesion.usuario()?.nombre).toBe('Admin');
    });

    it('el effect habilita o deshabilita rol y activo si cambia propio() con la pantalla abierta', async () => {
      await cargada(ADMIN);
      expect(campo('rol').disabled).toBeTrue();
      // La sesión pasa a ser otro administrador: el usuario editado ya no es el propio.
      sesion.establecer({ id: 10, email: 'otro@example.com', nombre: 'Otro', rol: 'ADMIN' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(campo('rol').disabled).toBeFalse();
      expect(campo('activo').disabled).toBeFalse();
      expect(el.querySelector('#rol-ayuda')).toBeNull();
      // Y vuelve a serlo.
      sesion.establecer({ id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(campo('rol').disabled).toBeTrue();
      expect(campo('activo').disabled).toBeTrue();
      expect(el.querySelector('#rol-ayuda')).not.toBeNull();
    });

    it('un usuario con el mismo rol ADMIN pero otro id sí puede cambiar rol y estado', async () => {
      await cargada({ ...ADMIN, id: 10, email: 'otro-admin@example.com' });
      expect(campo('rol').disabled).toBeFalse();
      expect(campo('activo').disabled).toBeFalse();
    });
  });

  describe('cambio de contraseña dentro de la edición', () => {
    it('404 al cambiar la contraseña lleva a «El usuario no existe»', async () => {
      await cargada();
      const pass = el.querySelector('#password-nueva') as HTMLInputElement;
      const conf = el.querySelector('#password-confirmacion') as HTMLInputElement;
      pass.value = 'clave-segura-1';
      pass.dispatchEvent(new Event('input'));
      conf.value = 'clave-segura-1';
      conf.dispatchEvent(new Event('input'));
      (el.querySelector('app-cambio-password button[type="submit"]') as HTMLButtonElement).click();
      http.expectOne('/api/usuarios/1/password').flush({ title: 'NF', status: 404 }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el.querySelector('form')).toBeNull();
      expect(el.textContent).toContain('El usuario no existe');
    });
  });

  describe('accesibilidad', () => {
    it('todos los controles tienen etiqueta', async () => {
      await cargada();
      for (const id of ['nombre', 'rol', 'activo']) {
        expect(el.querySelector(`label[for="${id}"]`)).withContext(id).not.toBeNull();
      }
    });

    it('la lista de datos de solo lectura usa dl/dt/dd', async () => {
      await cargada();
      expect(Array.from(el.querySelectorAll('dl.ficha dt')).map((d) => d.textContent)).toEqual(['Email', 'Fecha de alta']);
    });
  });
});
