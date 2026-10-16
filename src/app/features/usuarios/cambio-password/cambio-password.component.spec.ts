import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { erroresInterceptor } from '../../../core/http/errores.interceptor';
import { SesionService } from '../../../core/services/sesion.service';
import { CambioPasswordComponent } from './cambio-password.component';

describe('CambioPasswordComponent', () => {
  let fixture: ComponentFixture<CambioPasswordComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CambioPasswordComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SesionService).establecer({ id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' });
    fixture = TestBed.createComponent(CambioPasswordComponent);
    fixture.componentRef.setInput('usuarioId', 4);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    el.remove();
  });

  const campo = (id: string) => el.querySelector(`#${id}`) as HTMLInputElement;
  const texto = (id: string) => el.querySelector(`#${id}`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function escribir(id: string, valor: string): void {
    campo(id).value = valor;
    campo(id).dispatchEvent(new Event('input'));
  }

  async function enviar(password: string, confirmacion = password): Promise<void> {
    escribir('password-nueva', password);
    escribir('password-confirmacion', confirmacion);
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('es una sección con encabezado, campos con etiqueta y tipo password', () => {
    expect(el.querySelector('section h2')?.textContent).toContain('Cambiar la contraseña');
    expect(el.querySelector('label[for="password-nueva"]')).not.toBeNull();
    expect(el.querySelector('label[for="password-confirmacion"]')).not.toBeNull();
    expect(campo('password-nueva').type).toBe('password');
    expect(campo('password-confirmacion').type).toBe('password');
    expect(campo('password-nueva').autocomplete).toBe('new-password');
  });

  it('sin ser la cuenta propia no muestra el aviso de cuenta propia; siendo propia, sí', () => {
    expect(el.querySelector('#password-propia-ayuda')).toBeNull();
    fixture.componentRef.setInput('propio', true);
    fixture.detectChanges();
    expect(el.querySelector('#password-propia-ayuda')?.textContent).toContain('Es tu propia cuenta');
  });

  it('campos vacíos: errores y no envía', async () => {
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(texto('password-nueva-error')).toContain('Indica la contraseña nueva');
    expect(texto('password-confirmacion-error')).toContain('Repite la contraseña nueva');
    http.expectNone(() => true);
  });

  it('confirmación distinta: «Las contraseñas no coinciden», aria-invalid y no envía', async () => {
    await enviar('clave-segura-1', 'clave-segura-2');
    expect(texto('password-confirmacion-error')).toContain('Las contraseñas no coinciden');
    expect(campo('password-confirmacion').getAttribute('aria-invalid')).toBe('true');
    http.expectNone(() => true);
  });

  it('contraseña de 7 caracteres: mínimo 8', async () => {
    await enviar('1234567');
    expect(texto('password-nueva-error')).toContain('Mínimo 8');
    http.expectNone(() => true);
  });

  it('contraseña de 8 caracteres: se envía', async () => {
    await enviar('12345678');
    expect(http.expectOne('/api/usuarios/4/password').request.method).toBe('PUT');
  });

  it('73 bytes (36 «ñ» + 1 ASCII): límite con aviso y no envía', async () => {
    await enviar('ñ'.repeat(36) + 'a');
    expect(texto('password-nueva-error')).toContain('demasiado larga');
    http.expectNone(() => true);
  });

  it('72 bytes (36 «ñ»): se envía', async () => {
    await enviar('ñ'.repeat(36));
    expect(http.expectOne('/api/usuarios/4/password').request.method).toBe('PUT');
  });

  it('204: envía PUT con { password }, vacía los campos y muestra el aviso en una región de estado', async () => {
    await enviar('clave-segura-1');
    const req = http.expectOne('/api/usuarios/4/password');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ password: 'clave-segura-1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(el.querySelector('[role="status"] .exito')?.textContent).toContain('Contraseña cambiada');
    expect(campo('password-nueva').value).toBe('');
    expect(campo('password-confirmacion').value).toBe('');
    expect(el.querySelectorAll('.error').length).toBe(0);
  });

  it('doble clic: una sola petición y el botón indica «Cambiando»', async () => {
    escribir('password-nueva', 'clave-segura-1');
    escribir('password-confirmacion', 'clave-segura-1');
    const boton = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    boton.click();
    boton.click();
    fixture.detectChanges();
    const reqs = http.match('/api/usuarios/4/password');
    expect(reqs.length).toBe(1);
    expect(boton.textContent).toContain('Cambiando');
    reqs[0].flush(null, { status: 204, statusText: 'No Content' });
  });

  it('un nuevo intento borra el aviso anterior', async () => {
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(el.querySelector('.exito')).not.toBeNull();
    await enviar('corta');
    expect(el.querySelector('.exito')).toBeNull();
  });

  it('400 con error en password: se muestra en el campo con foco', async () => {
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush(
      { title: 'Solicitud no válida', status: 400, errores: [{ campo: 'password', mensaje: 'Contraseña no permitida' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    expect(texto('password-nueva-error')).toContain('Contraseña no permitida');
    expect(document.activeElement).toBe(campo('password-nueva'));
    expect(el.querySelector('.exito')).toBeNull();
  });

  it('400 sin errores por campo: mensaje general', async () => {
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush(
      { title: 'Solicitud no válida', status: 400, detail: 'Datos no válidos' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('Datos no válidos');
  });

  it('404: avisa de que el usuario no existe y emite noEncontrado', async () => {
    let emitido = false;
    fixture.componentInstance.noEncontrado.subscribe(() => (emitido = true));
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(emitido).toBeTrue();
    expect(el.querySelector('.error-general')?.textContent).toContain('El usuario no existe');
  });

  it('404 vacía los dos campos', async () => {
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush({ title: 'NF', status: 404 }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(campo('password-nueva').value).toBe('');
    expect(campo('password-confirmacion').value).toBe('');
  });

  it('400 con errores de password y de otros campos: el de password va al campo y los demás se listan con etiqueta legible', async () => {
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush(
      {
        title: 'Solicitud no válida',
        status: 400,
        errores: [
          { campo: 'password', mensaje: 'Contraseña no permitida' },
          { campo: 'email', mensaje: 'Email raro' },
          { campo: 'desconocido', mensaje: 'x' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(texto('password-nueva-error')).toContain('Contraseña no permitida');
    const items = Array.from(el.querySelectorAll('.error-general li')).map((li) => li.textContent?.trim());
    expect(items).toEqual(['Email: Email raro', 'desconocido: x']);
  });

  it('400 solo con errores de otros campos: no marca el campo password y los lista', async () => {
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush(
      { title: 'Solicitud no válida', status: 400, errores: [{ campo: 'nombre', mensaje: 'Nombre raro' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(texto('password-nueva-error')).toBe('');
    expect(el.querySelector('.error-general li')?.textContent).toContain('Nombre: Nombre raro');
  });

  it('un nuevo intento borra la lista de errores anterior', async () => {
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush(
      { title: 'T', status: 400, errores: [{ campo: 'nombre', mensaje: 'Nombre raro' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(el.querySelector('.error-general li')).not.toBeNull();
    await enviar('clave-segura-1');
    expect(el.querySelector('.error-general')).toBeNull();
    http.expectOne('/api/usuarios/4/password').flush(null, { status: 204, statusText: 'No Content' });
  });

  it('401: el interceptor limpia la sesión y lleva a /login; no se muestra aviso de éxito ni error propio', async () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    spyOnProperty(router, 'url').and.returnValue('/admin/usuarios/9');
    const sesion = TestBed.inject(SesionService);
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(sesion.autenticado()).toBeFalse();
    expect(navigate).toHaveBeenCalled();
    expect((navigate.calls.mostRecent().args[0] as string[])[0]).toBe('/login');
    expect(el.querySelector('.exito')).toBeNull();
    expect(el.querySelector('.error-general')).toBeNull();
    // HttpClient inyectado solo para asegurar que el interceptor está configurado
    expect(TestBed.inject(HttpClient)).toBeTruthy();
  });

  it('500: lo gestiona el interceptor y la sección no muestra éxito', async () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    await enviar('clave-segura-1');
    http.expectOne('/api/usuarios/4/password').flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.querySelector('.exito')).toBeNull();
  });
});
