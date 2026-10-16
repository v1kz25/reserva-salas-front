import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Amigo } from '../../../core/models/amistad.model';
import { Invitacion } from '../../../core/models/invitacion.model';
import { Usuario } from '../../../core/models/usuario.model';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { SesionService } from '../../../core/services/sesion.service';
import { AHORA } from '../../../core/tokens/ahora.token';
import {
  AVISO_DEJAR_DE_ASISTIR,
  AVISO_INVITACION_ACEPTADA,
  AVISO_INVITACION_RECHAZADA,
  MENSAJE_ELIGE_AMIGO,
  MENSAJE_INVITACION_A_TI_MISMO,
  MENSAJE_INVITACION_NO_EXISTE,
  MENSAJE_INVITAR_SIN_PERMISO,
} from '../../invitaciones/invitaciones-mensajes';
import { descartarPeticionesDeFondo } from '../../../testing/peticiones-de-fondo';
import { ReservaDetalleComponent } from './reserva-detalle.component';

const ANA: Usuario = { id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' };
const LUIS: Usuario = { id: 2, email: 'luis@example.com', nombre: 'Luis', rol: 'USER' };
const OTRO: Usuario = { id: 7, email: 'otro@example.com', nombre: 'Otro', rol: 'USER' };
const ADMIN: Usuario = { id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' };

const SALA = { id: 2, nombre: 'Sala Sur', capacidad: 4, planta: -1 };
const URL_RESERVA = '/api/reservas/10';
const URL_INVITAR = '/api/reservas/10/invitaciones';

const inv = (id: number, usuarioId: number, nombre: string, estado: Invitacion['estado']): Invitacion => ({
  id,
  reservaId: 10,
  usuarioId,
  nombre,
  estado,
});

const LUIS_ACEPTADA = inv(21, 2, 'Luis', 'ACEPTADA');
const EVA_PENDIENTE = inv(22, 3, 'Eva', 'PENDIENTE');
const PEPE_RECHAZADA = inv(23, 4, 'Pepe', 'RECHAZADA');

const completa = (invitaciones: Invitacion[], extra: object = {}) => ({
  id: 10,
  salaId: 2,
  fecha: '2026-10-25',
  horaInicio: '09:00',
  horaFin: '10:30',
  detalle: 'COMPLETO',
  usuarioId: 1,
  responsable: 'Ana',
  motivo: 'Daily',
  invitaciones,
  ...extra,
});

const OCUPADA = { id: 10, salaId: 2, fecha: '2026-10-25', horaInicio: '09:00', horaFin: '10:30', detalle: 'OCUPADA' };

/**
 * Añade `miInvitacion` como lo hace el servidor: la invitación pendiente o aceptada del usuario
 * de la sesión, si la tiene, en una reserva COMPLETO.
 */
const conMiInvitacion = (usuario: Usuario, reserva: object): object => {
  const invitaciones = (reserva as { invitaciones?: Invitacion[] }).invitaciones ?? [];
  const mia = invitaciones.find((i) => i.usuarioId === usuario.id && i.estado !== 'RECHAZADA');
  return mia ? { ...reserva, miInvitacion: { id: mia.id, estado: mia.estado } } : reserva;
};

/** Momento fijo de las pruebas: anterior a las reservas de los datos (25/10/2026). */
const AHORA_FIJO = () => new Date(2026, 9, 10, 12, 0);

const amigo = (usuarioId: number, nombre: string): Amigo => ({ usuarioId, nombre, desde: '2026-09-01T10:00:00Z' });
const AMIGOS = [amigo(2, 'Luis'), amigo(3, 'Eva'), amigo(4, 'Pepe'), amigo(5, 'Marta')];

const problema = (status: number, detail?: string) => ({ title: 'Error', status, ...(detail ? { detail } : {}) });

describe('ReservaDetalleComponent: asistentes e invitaciones', () => {
  let fixture: ComponentFixture<ReservaDetalleComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let usuarioActual: Usuario;
  let reloj: () => Date = AHORA_FIJO;

  beforeEach(() => (reloj = AHORA_FIJO));

  /** Crea la pantalla con el usuario y la reserva dados y responde a la carga inicial. */
  function crear(usuario: Usuario, reserva: object, amigos: Amigo[] = AMIGOS, sala = SALA, zona?: string): void {
    TestBed.configureTestingModule({
      imports: [ReservaDetalleComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '10' })) } },
        { provide: AHORA, useValue: () => reloj() },
      ],
    });
    usuarioActual = usuario;
    TestBed.inject(SesionService).establecer(usuario);
    http = TestBed.inject(HttpTestingController);
    if (zona) {
      // Zona del servidor ya cargada (en la aplicación la pide la cabecera al iniciar sesión).
      TestBed.inject(ConfiguracionService).obtenerZonaHoraria(true).subscribe();
      http.expectOne('/api/config/zona-horaria').flush({ zonaHoraria: zona });
    }
    fixture = TestBed.createComponent(ReservaDetalleComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
    http.expectOne(URL_RESERVA).flush(conMiInvitacion(usuario, reserva));
    http.expectOne('/api/salas').flush([sala]);
    fixture.detectChanges();
    const peticionAmigos = http.match('/api/amistades');
    peticionAmigos.forEach((r) => r.flush(amigos));
    fixture.detectChanges();
  }

  afterEach(() => {
    descartarPeticionesDeFondo(http, ['/api/invitaciones/pendientes', '/api/amistades/solicitudes/recibidas']);
    http.verify();
    el.remove();
  });

  const texto = () => el.textContent ?? '';
  const ficha = () => {
    const dt = Array.from(el.querySelectorAll('dt')).map((d) => d.textContent?.trim());
    const dd = Array.from(el.querySelectorAll('dd')).map((d) => d.textContent?.trim());
    return new Map(dt.map((t, i) => [t, dd[i]]));
  };
  const boton = (txt: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(txt)) as HTMLButtonElement | undefined;
  const dialogoRetirar = () => el.querySelector('app-reserva-asistentes dialog') as HTMLDialogElement;
  const opciones = () => Array.from(el.querySelectorAll('#invitar-amigo option')).map((o) => o.textContent?.trim());
  const grupo = (estado: string) => el.querySelector(`#titulo-invitaciones-${estado}`)?.closest('section') as HTMLElement;

  function elegir(nombre: string): void {
    const selector = el.querySelector('#invitar-amigo') as HTMLSelectElement;
    selector.selectedIndex = Array.from(selector.options).findIndex((o) => o.textContent?.trim() === nombre);
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  /** Responde a la recarga silenciosa de la reserva y repinta. */
  function recargar(reserva: object): void {
    http.expectOne(URL_RESERVA).flush(conMiInvitacion(usuarioActual, reserva));
    fixture.detectChanges();
  }

  describe('reserva OCUPADA', () => {
    beforeEach(() => crear(OTRO, OCUPADA));

    it('muestra sala, fecha, franja y «Estado: Ocupada»', () => {
      const datos = ficha();
      expect(datos.get('Sala')).toBe('Sala Sur');
      expect(datos.get('Fecha')).toBe('25/10/2026');
      expect(datos.get('Inicio')).toBe('09:00');
      expect(datos.get('Fin')).toBe('10:30');
      expect(datos.get('Estado')).toBe('Ocupada');
    });

    it('no muestra responsable, motivo, asistentes ni acciones', () => {
      const datos = ficha();
      expect(datos.has('Responsable')).toBeFalse();
      expect(datos.has('Motivo')).toBeFalse();
      expect(el.querySelector('app-reserva-asistentes')).toBeNull();
      expect(boton('Cancelar reserva')).toBeUndefined();
      expect(texto()).not.toContain('Asistentes');
      expect(texto()).not.toContain('undefined');
    });

    it('no pide los amigos', () => {
      http.expectNone('/api/amistades');
    });
  });

  describe('Asistentes', () => {
    it('muestra las plazas ocupadas (organizador + pendientes + aceptadas) sobre la capacidad', () => {
      crear(ANA, completa([LUIS_ACEPTADA, EVA_PENDIENTE, PEPE_RECHAZADA]));
      expect(el.querySelector('.plazas')?.textContent).toContain('3 de 4');
    });

    it('sin invitaciones, hay una plaza ocupada (el organizador)', () => {
      crear(ANA, completa([]));
      expect(el.querySelector('.plazas')?.textContent).toContain('1 de 4');
    });

    it('agrupa los invitados por estado, con su contador', () => {
      crear(ANA, completa([LUIS_ACEPTADA, EVA_PENDIENTE, PEPE_RECHAZADA]));
      expect(grupo('ACEPTADA').textContent).toContain('Luis');
      expect(grupo('ACEPTADA').querySelector('h3')?.textContent).toContain('(1)');
      expect(grupo('PENDIENTE').textContent).toContain('Eva');
      expect(grupo('PENDIENTE').textContent).not.toContain('Luis');
      expect(grupo('RECHAZADA').textContent).toContain('Pepe');
      expect(grupo('RECHAZADA').textContent).not.toContain('Eva');
    });

    it('un grupo vacío lo indica', () => {
      crear(ANA, completa([LUIS_ACEPTADA]));
      expect(grupo('PENDIENTE').textContent).toContain('No hay invitaciones pendientes');
      expect(grupo('RECHAZADA').querySelector('h3')?.textContent).toContain('(0)');
    });

    it('un administrador que no organiza ve los asistentes pero no puede invitar ni retirar', () => {
      crear(ADMIN, completa([LUIS_ACEPTADA, EVA_PENDIENTE]));
      expect(grupo('ACEPTADA').textContent).toContain('Luis');
      expect(boton('Retirar')).toBeUndefined();
      expect(el.querySelector('#invitar-amigo')).toBeNull();
      expect(texto()).not.toContain('Invitar a un amigo');
      expect(boton('Aceptar')).toBeUndefined();
      http.expectNone('/api/amistades');
    });

    it('el nombre de un invitado se muestra como texto, no como HTML', () => {
      crear(ANA, completa([inv(30, 8, '<b>Eva</b>', 'PENDIENTE')]));
      expect(el.querySelector('app-reserva-asistentes b')).toBeNull();
      expect(texto()).toContain('<b>Eva</b>');
    });
  });

  describe('organizador: invitar', () => {
    it('el selector excluye a los amigos con invitación pendiente o aceptada, pero no a los que rechazaron', () => {
      crear(ANA, completa([LUIS_ACEPTADA, EVA_PENDIENTE, PEPE_RECHAZADA]));
      expect(opciones()).toEqual(['Elige un amigo', 'Pepe', 'Marta']);
    });

    it('pide la lista de amigos confirmados', () => {
      crear(ANA, completa([]));
      expect(opciones()).toEqual(['Elige un amigo', 'Luis', 'Eva', 'Pepe', 'Marta']);
    });

    it('invitar envía POST con el usuarioId, avisa y recarga la reserva', () => {
      crear(ANA, completa([LUIS_ACEPTADA]));
      elegir('Marta');
      boton('Invitar')?.click();
      const req = http.expectOne(URL_INVITAR);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ usuarioId: 5 });
      req.flush(inv(24, 5, 'Marta', 'PENDIENTE'), { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      recargar(completa([LUIS_ACEPTADA, inv(24, 5, 'Marta', 'PENDIENTE')]));
      expect(texto()).toContain('Invitación enviada a Marta.');
      expect(grupo('PENDIENTE').textContent).toContain('Marta');
      expect(opciones()).not.toContain('Marta');
      expect(el.querySelector('.plazas')?.textContent).toContain('3 de 4');
    });

    it('sin elegir a nadie no envía nada, avisa junto al selector y le da el foco', () => {
      crear(ANA, completa([]));
      boton('Invitar')?.click();
      fixture.detectChanges();
      http.expectNone(URL_INVITAR);
      expect(el.querySelector('#invitar-amigo-error')?.textContent).toContain(MENSAJE_ELIGE_AMIGO);
      expect(el.querySelector('#invitar-amigo')?.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement?.id).toBe('invitar-amigo');
    });

    it('409 con detail muestra el motivo del servidor y recarga la reserva y los amigos', () => {
      crear(ANA, completa([]));
      elegir('Luis');
      boton('Invitar')?.click();
      http.expectOne(URL_INVITAR).flush(problema(409, 'La sala está completa'), { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain('No se ha podido invitar a Luis');
      expect(el.querySelector('.error-general')?.textContent).toContain('La sala está completa');
      recargar(completa([]));
      http.expectOne('/api/amistades').flush(AMIGOS.slice(1));
      fixture.detectChanges();
      expect(opciones()).not.toContain('Luis');
    });

    it('409 sin detail enumera las causas posibles (no es amigo, ya invitado, aforo, pasada)', () => {
      crear(ANA, completa([]));
      elegir('Luis');
      boton('Invitar')?.click();
      http.expectOne(URL_INVITAR).flush(problema(409), { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      const mensaje = el.querySelector('.error-general')?.textContent ?? '';
      expect(mensaje).toContain('No se ha podido invitar a Luis');
      expect(mensaje).toContain('amigos');
      expect(mensaje).toContain('completa');
      recargar(completa([]));
      http.match('/api/amistades').forEach((r) => r.flush(AMIGOS));
    });

    it('400 muestra el detail del servidor y no recarga', () => {
      crear(ANA, completa([]));
      elegir('Luis');
      boton('Invitar')?.click();
      http.expectOne(URL_INVITAR).flush(problema(400, 'No puedes invitarte'), { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain('No puedes invitarte');
      http.expectNone(URL_RESERVA);
    });

    it('400 sin detail muestra el mensaje de invitarse a uno mismo', () => {
      crear(ANA, completa([]));
      elegir('Luis');
      boton('Invitar')?.click();
      http.expectOne(URL_INVITAR).flush(problema(400), { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain(MENSAJE_INVITACION_A_TI_MISMO);
    });

    it('403 muestra el mensaje de permisos y no recarga', () => {
      crear(ANA, completa([]));
      elegir('Luis');
      boton('Invitar')?.click();
      http.expectOne(URL_INVITAR).flush(null, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain(MENSAJE_INVITAR_SIN_PERMISO);
      http.expectNone(URL_RESERVA);
    });

    it('con la sala llena (organizador + invitaciones = capacidad) oculta el formulario y lo explica', () => {
      crear(ANA, completa([LUIS_ACEPTADA, EVA_PENDIENTE, inv(25, 6, 'Rosa', 'ACEPTADA')]));
      expect(el.querySelector('.plazas')?.textContent).toContain('4 de 4');
      expect(el.querySelector('#invitar-amigo')).toBeNull();
      expect(boton('Invitar')).toBeUndefined();
      expect(texto()).toContain('La sala está completa');
    });

    it('una invitación rechazada libera plaza: con 3 de 4 y una rechazada sigue pudiendo invitar', () => {
      crear(ANA, completa([LUIS_ACEPTADA, EVA_PENDIENTE, PEPE_RECHAZADA]));
      expect(el.querySelector('#invitar-amigo')).not.toBeNull();
    });

    it('sin amigos lo indica y enlaza a «Amigos»', () => {
      crear(ANA, completa([]), []);
      expect(el.querySelector('#invitar-amigo')).toBeNull();
      expect(el.querySelector('a[href="/amigos"]')).not.toBeNull();
    });

    it('si ya están todos invitados lo indica', () => {
      crear(ANA, completa([LUIS_ACEPTADA]), [amigo(2, 'Luis')]);
      expect(el.querySelector('#invitar-amigo')).toBeNull();
      expect(texto()).toContain('Ya has invitado a todos tus amigos');
    });

    it('un fallo al cargar los amigos lo muestra', () => {
      TestBed.configureTestingModule({
        imports: [ReservaDetalleComponent],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '10' })) } },
        ],
      });
      TestBed.inject(SesionService).establecer(ANA);
      http = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(ReservaDetalleComponent);
      el = fixture.nativeElement as HTMLElement;
      document.body.appendChild(el);
      fixture.detectChanges();
      http.expectOne(URL_RESERVA).flush(completa([]));
      http.expectOne('/api/salas').flush([SALA]);
      fixture.detectChanges();
      http.expectOne('/api/amistades').flush(problema(500, 'Fallo interno'), { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(texto()).toContain('No se han podido cargar tus amigos');
    });
  });

  describe('organizador: retirar', () => {
    beforeEach(() => crear(ANA, completa([LUIS_ACEPTADA, EVA_PENDIENTE])));

    it('«Retirar» abre el diálogo con el nombre del invitado y no envía nada todavía', async () => {
      boton('Retirar la invitación de Luis')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(dialogoRetirar().open).toBeTrue();
      expect(dialogoRetirar().textContent).toContain('Luis');
      http.expectNone((r) => r.method === 'DELETE');
    });

    it('confirmar envía DELETE, avisa y recarga la reserva', async () => {
      boton('Retirar la invitación de Luis')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      (Array.from(dialogoRetirar().querySelectorAll('button')).find((b) => b.textContent?.includes('Sí, retirar')) as HTMLButtonElement).click();
      const req = http.expectOne('/api/reservas/10/invitaciones/21');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      recargar(completa([EVA_PENDIENTE]));
      expect(dialogoRetirar().open).toBeFalse();
      expect(texto()).toContain('Has retirado la invitación de Luis.');
      expect(grupo('ACEPTADA').textContent).not.toContain('Luis');
      expect(el.querySelector('.plazas')?.textContent).toContain('2 de 4');
    });

    it('«No, mantener» cierra el diálogo sin enviar nada', async () => {
      boton('Retirar la invitación de Luis')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      (Array.from(dialogoRetirar().querySelectorAll('button')).find((b) => b.textContent?.includes('No, mantener')) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialogoRetirar().open).toBeFalse();
      http.expectNone((r) => r.method === 'DELETE');
    });

    it('Esc cierra el diálogo sin enviar nada y devuelve el foco al botón «Retirar»', async () => {
      const retirar = boton('Retirar la invitación de Luis') as HTMLButtonElement;
      retirar.focus();
      retirar.click();
      fixture.detectChanges();
      await fixture.whenStable();
      dialogoRetirar().dispatchEvent(new Event('cancel', { cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(dialogoRetirar().open).toBeFalse();
      http.expectNone((r) => r.method === 'DELETE');
      expect(document.activeElement).toBe(retirar);
    });

    it('404 al retirar indica que ya no existe, cierra el diálogo y recarga', async () => {
      boton('Retirar la invitación de Luis')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      (Array.from(dialogoRetirar().querySelectorAll('button')).find((b) => b.textContent?.includes('Sí, retirar')) as HTMLButtonElement).click();
      http.expectOne('/api/reservas/10/invitaciones/21').flush(null, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      recargar(completa([EVA_PENDIENTE]));
      expect(el.querySelector('.error-general')?.textContent).toContain(MENSAJE_INVITACION_NO_EXISTE);
      expect(dialogoRetirar().open).toBeFalse();
    });

    it('tras retirar, el foco no se pierde: va al título de «Asistentes»', async () => {
      const retirar = boton('Retirar la invitación de Luis') as HTMLButtonElement;
      retirar.focus();
      retirar.click();
      fixture.detectChanges();
      await fixture.whenStable();
      (Array.from(dialogoRetirar().querySelectorAll('button')).find((b) => b.textContent?.includes('Sí, retirar')) as HTMLButtonElement).click();
      http.expectOne('/api/reservas/10/invitaciones/21').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      recargar(completa([EVA_PENDIENTE]));
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).not.toBe(document.body);
      expect(el.contains(document.activeElement)).toBeTrue();
    });
  });

  describe('invitado', () => {
    it('con la invitación pendiente ve «Aceptar» y «Rechazar» y su estado, y no gestiona invitaciones', () => {
      crear(LUIS, completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
      expect(boton('Aceptar')).toBeDefined();
      expect(boton('Rechazar')).toBeDefined();
      expect(boton('Dejar de asistir')).toBeUndefined();
      expect(el.querySelector('#titulo-mi-invitacion')?.parentElement?.textContent).toContain('Pendiente');
      expect(boton('Retirar')).toBeUndefined();
      expect(el.querySelector('#invitar-amigo')).toBeNull();
      expect(boton('Cancelar reserva')).toBeUndefined();
      http.expectNone('/api/amistades');
    });

    it('aceptar envía POST, avisa y recarga: pasa a «Dejar de asistir»', () => {
      crear(LUIS, completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
      boton('Aceptar')?.click();
      const req = http.expectOne('/api/invitaciones/21/aceptar');
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      recargar(completa([inv(21, 2, 'Luis', 'ACEPTADA')]));
      expect(texto()).toContain(AVISO_INVITACION_ACEPTADA);
      expect(boton('Aceptar')).toBeUndefined();
      expect(boton('Dejar de asistir')).toBeDefined();
    });

    it('rechazar envía POST y, si la reserva pasa a verse como OCUPADA, conserva el mensaje', () => {
      crear(LUIS, completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
      boton('Rechazar')?.click();
      http.expectOne('/api/invitaciones/21/rechazar').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      recargar(OCUPADA);
      expect(ficha().get('Estado')).toBe('Ocupada');
      expect(ficha().has('Responsable')).toBeFalse();
      expect(el.querySelector('app-reserva-asistentes')).toBeNull();
      expect(texto()).toContain(AVISO_INVITACION_RECHAZADA);
    });

    it('al pasar a OCUPADA tras rechazar, el foco no se pierde: va al título de la página', async () => {
      crear(LUIS, completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
      const rechazar = boton('Rechazar') as HTMLButtonElement;
      rechazar.focus();
      rechazar.click();
      http.expectOne('/api/invitaciones/21/rechazar').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      recargar(OCUPADA);
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(el.querySelector('h1'));
    });

    it('con la invitación aceptada ve «Dejar de asistir» y no «Aceptar»/«Rechazar»', () => {
      crear(LUIS, completa([LUIS_ACEPTADA]));
      expect(boton('Dejar de asistir')).toBeDefined();
      expect(boton('Aceptar')).toBeUndefined();
      expect(boton('Rechazar')).toBeUndefined();
    });

    it('«Dejar de asistir» pide confirmación y no envía nada hasta confirmar', () => {
      crear(LUIS, completa([LUIS_ACEPTADA]));
      boton('Dejar de asistir')?.click();
      fixture.detectChanges();
      const dialogo = Array.from(el.querySelectorAll('dialog')).find((d) => d.textContent?.includes('dejar de asistir'));
      expect(dialogo?.open).toBeTrue();
      http.expectNone('/api/invitaciones/21/rechazar');
      boton('No, seguir asistiendo')?.click();
      fixture.detectChanges();
      expect(dialogo?.open).toBeFalse();
      http.expectNone('/api/invitaciones/21/rechazar');
    });

    it('«Dejar de asistir» confirmado envía POST a rechazar y avisa', () => {
      crear(LUIS, completa([LUIS_ACEPTADA]));
      boton('Dejar de asistir')?.click();
      fixture.detectChanges();
      boton('Sí, dejar de asistir')?.click();
      http.expectOne('/api/invitaciones/21/rechazar').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      recargar(OCUPADA);
      expect(texto()).toContain(AVISO_DEJAR_DE_ASISTIR);
    });

    it('409 al aceptar muestra el motivo del servidor y recarga', () => {
      crear(LUIS, completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
      boton('Aceptar')?.click();
      http.expectOne('/api/invitaciones/21/aceptar').flush(problema(409, 'La reserva ya ha pasado'), { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain('La reserva ya ha pasado');
      recargar(completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
    });

    it('404 al aceptar (organizador la ha retirado o cancelado) indica que ya no existe y recarga', () => {
      crear(LUIS, completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
      boton('Aceptar')?.click();
      http.expectOne('/api/invitaciones/21/aceptar').flush(null, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el.querySelector('.error-general')?.textContent).toContain(MENSAJE_INVITACION_NO_EXISTE);
      recargar(OCUPADA);
    });

    it('si la reserva se cancela durante la recarga (404), muestra «La reserva no existe»', () => {
      crear(LUIS, completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
      boton('Aceptar')?.click();
      http.expectOne('/api/invitaciones/21/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      http.expectOne(URL_RESERVA).flush(null, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(texto()).toContain('La reserva no existe');
    });

    it('si falla la recarga silenciosa, conserva la reserva y avisa', () => {
      crear(LUIS, completa([inv(21, 2, 'Luis', 'PENDIENTE')]));
      boton('Aceptar')?.click();
      http.expectOne('/api/invitaciones/21/aceptar').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      http.expectOne(URL_RESERVA).flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(ficha().get('Sala')).toBe('Sala Sur');
      expect(el.querySelector('.aviso')?.textContent).toContain('No se ha podido actualizar');
    });
  });

  describe('reserva pasada', () => {
    const PASADA = { fecha: '2026-10-01' };

    it('el organizador no ve el formulario de invitar ni «Retirar», y se explica por qué', () => {
      crear(ANA, completa([LUIS_ACEPTADA], PASADA));
      expect(el.querySelector('#invitar-amigo')).toBeNull();
      expect(boton('Retirar')).toBeUndefined();
      expect(texto()).toContain('La reserva ya ha pasado');
    });

    it('una reserva de hoy ya terminada también cuenta como pasada', () => {
      crear(ANA, completa([LUIS_ACEPTADA], { fecha: '2026-10-10', horaInicio: '09:00', horaFin: '11:00' }));
      expect(el.querySelector('#invitar-amigo')).toBeNull();
    });

    it('una reserva de hoy aún no terminada no cuenta como pasada', () => {
      crear(ANA, completa([LUIS_ACEPTADA], { fecha: '2026-10-10', horaInicio: '11:00', horaFin: '13:00' }));
      expect(el.querySelector('#invitar-amigo')).not.toBeNull();
    });

    it('límite: si termina justo ahora (horaFin == ahora) ya cuenta como pasada', () => {
      crear(ANA, completa([LUIS_ACEPTADA], { fecha: '2026-10-10', horaInicio: '11:00', horaFin: '12:00' }));
      expect(el.querySelector('#invitar-amigo')).toBeNull();
      expect(texto()).toContain('La reserva ya ha pasado');
    });

    it('límite: si termina un minuto después de ahora aún no ha pasado', () => {
      crear(ANA, completa([LUIS_ACEPTADA], { fecha: '2026-10-10', horaInicio: '11:00', horaFin: '12:01' }));
      expect(el.querySelector('#invitar-amigo')).not.toBeNull();
    });

    describe('con la zona del servidor distinta de la del navegador', () => {
      // 2026-10-10T23:30:00Z: en Kiritimati (UTC+14) es el 11 a las 13:30; en Los Ángeles, el 10 a las 16:30.
      beforeEach(() => (reloj = () => new Date('2026-10-10T23:30:00Z')));

      it('Pacific/Kiritimati: una reserva del día 11 de 09:00 a 10:00 ya ha pasado', () => {
        crear(ANA, completa([LUIS_ACEPTADA], { fecha: '2026-10-11', horaInicio: '09:00', horaFin: '10:00' }), AMIGOS, SALA, 'Pacific/Kiritimati');
        expect(el.querySelector('#invitar-amigo')).toBeNull();
        expect(texto()).toContain('La reserva ya ha pasado');
      });

      it('America/Los_Angeles: una reserva del día 10 de 17:00 a 18:00 aún no ha pasado', () => {
        crear(ANA, completa([LUIS_ACEPTADA], { fecha: '2026-10-10', horaInicio: '17:00', horaFin: '18:00' }), AMIGOS, SALA, 'America/Los_Angeles');
        expect(el.querySelector('#invitar-amigo')).not.toBeNull();
        expect(boton('Retirar')).toBeDefined();
      });
    });
  });

  describe('organizador: cancelar y asistentes a la vez', () => {
    it('el organizador sigue viendo «Cancelar reserva» y los datos completos', () => {
      crear(ANA, completa([LUIS_ACEPTADA]));
      expect(boton('Cancelar reserva')).toBeDefined();
      expect(ficha().get('Responsable')).toBe('Ana');
      expect(ficha().has('Estado')).toBeFalse();
    });
  });
});
