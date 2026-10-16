import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { erroresInterceptor } from '../../core/http/errores.interceptor';
import { routes } from '../../app.routes';
import { SesionService } from '../../core/services/sesion.service';
import { AppComponent } from '../../app.component';
import { AjustesComponent } from './ajustes.component';

const URL = '/api/config/zona-horaria';

describe('AjustesComponent', () => {
  let fixture: ComponentFixture<AjustesComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AjustesComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AjustesComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    el.remove();
  });

  const selector = () => el.querySelector('#zona-horaria') as HTMLSelectElement;
  const boton = () => el.querySelector('button[type=submit]') as HTMLButtonElement;
  const estado = () => el.querySelector('[role=status]') as HTMLElement;

  function cargar(zona = 'Europe/Madrid'): void {
    http.expectOne(URL).flush({ zonaHoraria: zona });
    fixture.detectChanges();
  }

  function elegir(zona: string): void {
    selector().value = zona;
    selector().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function enviar(): void {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('mientras carga muestra «Cargando ajustes…» y pide GET', () => {
    expect(el.textContent).toContain('Cargando ajustes');
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('GET');
    expect(selector()).toBeNull();
    req.flush({ zonaHoraria: 'UTC' });
  });

  it('muestra la zona actual y la deja seleccionada', () => {
    cargar('Asia/Tokyo');
    expect(el.querySelector('strong')?.textContent).toBe('Asia/Tokyo');
    expect(selector().value).toBe('Asia/Tokyo');
  });

  it('el selector tiene etiqueta y optgroups con las zonas comunes', () => {
    cargar();
    expect(el.querySelector('label[for=zona-horaria]')).not.toBeNull();
    const grupos = Array.from(el.querySelectorAll('optgroup'));
    expect(grupos.length).toBe(2);
    const comunes = Array.from(grupos[0].querySelectorAll('option')).map((o) => o.value);
    for (const zona of ['Europe/Madrid', 'Europe/London', 'America/New_York', 'Asia/Tokyo', 'UTC']) {
      expect(comunes).toContain(zona);
    }
  });

  it('una zona actual desconocida para el navegador aparece seleccionada', () => {
    cargar('Antarctica/Troll');
    expect(selector().value).toBe('Antarctica/Troll');
  });

  it('si falla la carga muestra un aviso con role=alert y no el formulario', () => {
    http
      .expectOne(URL)
      .flush({ title: 'Error', status: 500, detail: 'Caído' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    const aviso = el.querySelector('p[role=alert]');
    expect(aviso?.textContent).toContain('Caído');
    expect(el.querySelector('form')).toBeNull();
  });

  it('guardar envía PUT con el cuerpo, desactiva el botón y marca aria-busy', () => {
    cargar();
    elegir('America/New_York');
    expect(boton().disabled).toBeFalse();
    expect(boton().textContent).toContain('Guardar');
    enviar();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ zonaHoraria: 'America/New_York' });
    expect(boton().disabled).toBeTrue();
    expect(boton().getAttribute('aria-busy')).toBe('true');
    expect(boton().textContent).toContain('Guardando…');
    req.flush({ zonaHoraria: 'America/New_York' });
    fixture.detectChanges();
    expect(boton().disabled).toBeFalse();
    expect(boton().getAttribute('aria-busy')).toBe('false');
  });

  it('tras guardar muestra el aviso en role=status y actualiza la zona actual', () => {
    cargar();
    expect(estado()).not.toBeNull();
    expect(estado().textContent?.trim()).toBe('');
    elegir('Asia/Tokyo');
    enviar();
    http.expectOne(URL).flush({ zonaHoraria: 'Asia/Tokyo' });
    fixture.detectChanges();
    expect(estado().textContent).toContain('Asia/Tokyo');
    expect(el.querySelector('strong')?.textContent).toBe('Asia/Tokyo');
  });

  it('doble envío seguido solo hace una petición', () => {
    cargar();
    elegir('Asia/Tokyo');
    enviar();
    enviar();
    const reqs = http.match(URL);
    expect(reqs.length).toBe(1);
    reqs[0].flush({ zonaHoraria: 'Asia/Tokyo' });
  });

  it('un nuevo guardado limpia el aviso de éxito anterior', () => {
    cargar();
    elegir('Asia/Tokyo');
    enviar();
    http.expectOne(URL).flush({ zonaHoraria: 'Asia/Tokyo' });
    fixture.detectChanges();
    elegir('UTC');
    enviar();
    expect(estado().textContent?.trim()).toBe('');
    http.expectOne(URL).flush({ zonaHoraria: 'UTC' });
  });

  it('un 400 se muestra junto al campo, con aria-invalid y el foco en el selector', async () => {
    cargar();
    elegir('Europe/London');
    enviar();
    http
      .expectOne(URL)
      .flush(
        { title: 'Solicitud no válida', status: 400, detail: 'Zona desconocida' },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    await fixture.whenStable();
    const error = el.querySelector('#zona-horaria-error .error');
    expect(error?.textContent).toContain('Zona desconocida');
    expect(selector().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(selector());
    expect(el.querySelector('.error-general')).toBeNull();
    expect(boton().disabled).toBeFalse();
    expect(estado().textContent?.trim()).toBe('');
  });

  it('un 400 con errores por campo muestra el mensaje de zonaHoraria', () => {
    cargar();
    enviar();
    http
      .expectOne(URL)
      .flush(
        { title: 'x', status: 400, errores: [{ campo: 'zonaHoraria', mensaje: 'Zona no reconocida' }] },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    expect(el.querySelector('#zona-horaria-error')?.textContent).toContain('Zona no reconocida');
  });

  it('un 400 sin detalle muestra un mensaje genérico', () => {
    cargar();
    enviar();
    http.expectOne(URL).flush({ title: 'x', status: 400 }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.querySelector('#zona-horaria-error')?.textContent).toContain('no es válida');
  });

  it('otro error al guardar (409) se muestra como error general, no junto al campo', () => {
    cargar();
    enviar();
    http
      .expectOne(URL)
      .flush({ title: 'Conflicto', status: 409, detail: 'Choca' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.querySelector('.error-general')?.textContent).toContain('Choca');
    expect(el.querySelector('#zona-horaria-error .error')).toBeNull();
  });

  it('sin zona elegida no envía y muestra «Selecciona una zona horaria»', () => {
    cargar();
    elegir('');
    enviar();
    http.expectNone(URL);
    expect(el.querySelector('#zona-horaria-error')?.textContent).toContain('Selecciona una zona horaria');
  });
});

describe('AjustesComponent: 403 al guardar', () => {
  it('lo gestiona el interceptor (/error/sin-permiso), no el campo', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([erroresInterceptor])), provideHttpClientTesting()],
    });
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AjustesComponent);
    const el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne(URL).flush({ zonaHoraria: 'Europe/Madrid' });
    fixture.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http
      .expectOne(URL)
      .flush({ title: 'Prohibido', status: 403 }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/error/sin-permiso'], jasmine.anything());
    expect(el.querySelector('#zona-horaria-error .error')).toBeNull();
    expect(el.querySelector('.error-general')).toBeNull();
    http.verify();
  });
});

describe('acceso a /admin/ajustes y enlace «Ajustes»', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const USER = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' as const };
  const ADMIN = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' as const };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(() => true);
  });

  it('un USER es redirigido a /reservas', async () => {
    TestBed.inject(SesionService).establecer(USER);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/ajustes');
    expect(TestBed.inject(Location).path()).toBe('/reservas');
    http.expectNone(URL);
  });

  it('sin sesión va a /login con returnUrl', async () => {
    TestBed.inject(SesionService).limpiar();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/ajustes');
    expect(TestBed.inject(Location).path()).toBe('/login?returnUrl=%2Fadmin%2Fajustes');
  });

  it('un ADMIN entra y se pide la zona', async () => {
    TestBed.inject(SesionService).establecer(ADMIN);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/ajustes');
    expect(TestBed.inject(Location).path()).toBe('/admin/ajustes');
    http.expectOne(URL).flush({ zonaHoraria: 'Europe/Madrid' });
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toBe('Ajustes');
  });

  function enlaceAjustes(rol: typeof USER | typeof ADMIN): HTMLAnchorElement | undefined {
    TestBed.inject(SesionService).establecer(rol);
    const app = TestBed.createComponent(AppComponent);
    app.detectChanges();
    return Array.from((app.nativeElement as HTMLElement).querySelectorAll('nav a')).find(
      (a) => a.textContent?.trim() === 'Ajustes',
    ) as HTMLAnchorElement | undefined;
  }

  it('el enlace «Ajustes» aparece solo para ADMIN', () => {
    expect(enlaceAjustes(ADMIN)?.getAttribute('href')).toBe('/admin/ajustes');
  });

  it('el enlace «Ajustes» no aparece para USER', () => {
    expect(enlaceAjustes(USER)).toBeUndefined();
  });
});
