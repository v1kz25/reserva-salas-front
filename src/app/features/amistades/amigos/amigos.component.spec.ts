import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';

import { Amigo, SolicitudAmistad } from '../../../core/models/amistad.model';
import { AmistadesService } from '../../../core/services/amistades.service';
import { AmigosComponent, idSolicitudEnviada } from './amigos.component';

const sinContenido = { status: 204, statusText: 'No Content' };

const RECIBIDAS: SolicitudAmistad[] = [
  { id: 1, usuario: { id: 11, nombre: 'Berta' }, fecha: '2026-10-03T12:00:00Z' },
  { id: 2, usuario: { id: 12, nombre: 'Carlos' }, fecha: '2026-10-02T12:00:00Z' },
];
const ENVIADAS: SolicitudAmistad[] = [{ id: 5, usuario: { id: 21, nombre: 'Diana' }, fecha: '2026-10-01T12:00:00Z' }];
const AMIGOS: Amigo[] = [
  { usuarioId: 31, nombre: 'Elena', desde: '2026-09-15T12:00:00Z' },
  { usuarioId: 32, nombre: 'Fran', desde: '2026-09-20T12:00:00Z' },
];

describe('AmigosComponent', () => {
  let fixture: ComponentFixture<AmigosComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let servicio: AmistadesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AmigosComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(AmistadesService);
  });

  afterEach(() => {
    http.verify();
    el?.remove();
  });

  function crear(): void {
    fixture = TestBed.createComponent(AmigosComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  }

  function responderListas(
    recibidas: SolicitudAmistad[] = RECIBIDAS,
    enviadas: SolicitudAmistad[] = ENVIADAS,
    amigos: Amigo[] = AMIGOS,
  ): void {
    http.expectOne('/api/amistades/solicitudes/recibidas').flush(recibidas);
    http.expectOne('/api/amistades/solicitudes/enviadas').flush(enviadas);
    http.expectOne('/api/amistades').flush(amigos);
    fixture.detectChanges();
  }

  function cargada(
    recibidas?: SolicitudAmistad[],
    enviadas?: SolicitudAmistad[],
    amigos?: Amigo[],
  ): void {
    crear();
    responderListas(recibidas, enviadas, amigos);
  }

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Texto de un elemento con los espacios normalizados (nombre accesible aproximado). */
  const normalizado = (e: Element) => (e.textContent ?? '').replace(/\s+/g, ' ').trim();
  /** Localiza un botón por su nombre accesible (texto visible + texto oculto). */
  const porEtiqueta = (etiqueta: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => normalizado(b) === etiqueta) as HTMLButtonElement;
  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;
  const seccion = (titulo: string) =>
    Array.from(el.querySelectorAll('section.bloque')).find((s) => s.querySelector('h2')?.textContent?.includes(titulo))!;
  const filas = (titulo: string) => seccion(titulo).querySelectorAll('li.fila');
  const dialogo = () => el.querySelector('dialog') as HTMLDialogElement;
  const sinPeticiones = () => http.expectNone(() => true);

  /** Pide a Angular las tres listas tras una acción. */
  function recargar(
    recibidas: SolicitudAmistad[] = RECIBIDAS,
    enviadas: SolicitudAmistad[] = ENVIADAS,
    amigos: Amigo[] = AMIGOS,
  ): void {
    responderListas(recibidas, enviadas, amigos);
  }

  describe('carga y render', () => {
    it('al abrir pide las tres listas y mientras tanto muestra «Cargando»', () => {
      crear();
      expect(el.textContent).toContain('Cargando amistades');
      // El mensaje de carga se anuncia: está dentro de una región role="status".
      const regiones = Array.from(el.querySelectorAll('[role="status"]'));
      expect(regiones.some((r) => r.textContent?.includes('Cargando amistades…'))).toBeTrue();
      expect(el.querySelector('#titulo-recibidas')).toBeNull();
      responderListas();
      expect(el.textContent).not.toContain('Cargando amistades');
    });

    it('muestra recibidas, enviadas y amigos con sus nombres, fechas y contador', () => {
      cargada();
      expect(seccion('Solicitudes recibidas').textContent).toContain('Berta');
      expect(seccion('Solicitudes recibidas').textContent).toContain('Carlos');
      expect(seccion('Solicitudes recibidas').querySelector('h2')?.textContent).toContain('(2)');
      expect(seccion('Solicitudes enviadas').textContent).toContain('Diana');
      expect(seccion('Tus amigos').textContent).toContain('Elena');
      expect(seccion('Tus amigos').textContent).toContain('Fran');
      expect(seccion('Tus amigos').textContent).toContain('15 de septiembre de 2026');
      expect(filas('Solicitudes recibidas').length).toBe(2);
      expect(filas('Solicitudes enviadas').length).toBe(1);
      expect(filas('Tus amigos').length).toBe(2);
    });

    it('con listas vacías muestra un mensaje en cada sección y sin contador', () => {
      cargada([], [], []);
      expect(seccion('Solicitudes recibidas').textContent).toContain('No tienes solicitudes pendientes');
      expect(seccion('Solicitudes recibidas').querySelector('.contador')).toBeNull();
      expect(seccion('Solicitudes enviadas').textContent).toContain('No has enviado solicitudes pendientes');
      expect(seccion('Tus amigos').textContent).toContain('Aún no tienes amigos');
    });

    it('al listar las recibidas el contador del servicio se fija en su longitud', () => {
      cargada();
      expect(servicio.pendientes()).toBe(2);
    });

    it('si falla la carga muestra un alert y no las secciones', () => {
      crear();
      http.expectOne('/api/amistades/solicitudes/recibidas').flush(null, { status: 0, statusText: '' });
      http.match('/api/amistades/solicitudes/enviadas');
      http.match('/api/amistades');
      fixture.detectChanges();
      expect(el.querySelector('p.error[role="alert"]')).not.toBeNull();
      expect(el.querySelector('#titulo-recibidas')).toBeNull();
    });

    it('los nombres se muestran como texto, no como HTML', () => {
      cargada([{ id: 1, usuario: { id: 1, nombre: '<b>X</b>' }, fecha: '2026-10-03T12:00:00Z' }]);
      expect(seccion('Solicitudes recibidas').querySelector('b')).toBeNull();
      expect(seccion('Solicitudes recibidas').textContent).toContain('<b>X</b>');
    });
  });

  describe('accesibilidad', () => {
    it('el buscador es un form role=search etiquetado con su título y el campo tiene label', () => {
      cargada();
      const form = el.querySelector('form[role="search"]') as HTMLFormElement;
      expect(form).not.toBeNull();
      const titulo = el.querySelector(`#${form.getAttribute('aria-labelledby')}`);
      expect(titulo?.textContent).toContain('Buscar personas');
      const input = el.querySelector('#busqueda-nombre') as HTMLInputElement;
      expect(el.querySelector('label[for="busqueda-nombre"]')?.textContent?.trim()).toBe('Nombre');
      expect(input.getAttribute('aria-describedby')).toBe('busqueda-ayuda');
      expect(el.querySelector('#busqueda-ayuda')?.textContent).toContain('2 caracteres');
      expect(input.maxLength).toBe(100);
    });

    it('enviar el formulario con Intro no recarga la página', () => {
      cargada();
      const evento = new Event('submit', { cancelable: true });
      el.querySelector('form')!.dispatchEvent(evento);
      expect(evento.defaultPrevented).toBeTrue();
    });

    it('el estado de la búsqueda está en una región aria-live polite', () => {
      cargada();
      expect(el.querySelector('div[aria-live="polite"]')).not.toBeNull();
      expect(el.querySelector('[role="status"]')).not.toBeNull();
    });

    it('los botones de las filas tienen nombre accesible con la persona', () => {
      cargada();
      expect(porEtiqueta('Aceptar la solicitud de Berta')).not.toBeNull();
      expect(porEtiqueta('Rechazar la solicitud de Berta')).not.toBeNull();
      expect(porEtiqueta('Retirar la solicitud enviada a Diana')).not.toBeNull();
      expect(porEtiqueta('Eliminar amistad con Elena')).not.toBeNull();
    });

    it('cada sección está etiquetada por su h2 y los h2 son enfocables por código', () => {
      cargada();
      for (const id of ['titulo-recibidas', 'titulo-enviadas', 'titulo-lista-amigos']) {
        const h2 = el.querySelector(`#${id}`) as HTMLElement;
        expect(h2.tagName).toBe('H2');
        expect(h2.getAttribute('tabindex')).toBe('-1');
        expect(h2.closest('section')?.getAttribute('aria-labelledby')).toBe(id);
      }
    });

    it('el diálogo de eliminar tiene título y descripción asociados', async () => {
      cargada();
      porEtiqueta('Eliminar amistad con Elena').click();
      await estabilizar();
      const titulo = dialogo().getAttribute('aria-labelledby')!;
      expect(el.querySelector(`#${titulo}`)?.textContent).toContain('Eliminar amistad');
      expect(el.querySelector(`#${dialogo().getAttribute('aria-describedby')}`)?.textContent).toContain('Elena');
    });
  });

  describe('aceptar', () => {
    it('envía POST, quita la fila, recarga sin «Cargando», baja el contador y avisa', async () => {
      cargada();
      porEtiqueta('Aceptar la solicitud de Berta').click();
      const req = http.expectOne('/api/amistades/solicitudes/1/aceptar');
      expect(req.request.method).toBe('POST');
      req.flush(null, sinContenido);
      await estabilizar();
      expect(filas('Solicitudes recibidas').length).toBe(1);
      expect(seccion('Solicitudes recibidas').textContent).not.toContain('Berta');
      expect(servicio.pendientes()).toBe(1);
      expect(el.querySelector('[role="status"] .exito')?.textContent).toContain('Has aceptado la solicitud de Berta');
      expect(el.textContent).not.toContain('Cargando amistades');
      recargar([RECIBIDAS[1]], [], [...AMIGOS, { usuarioId: 11, nombre: 'Berta', desde: '2026-10-15T10:00:00Z' }]);
      expect(filas('Tus amigos').length).toBe(3);
      expect(servicio.pendientes()).toBe(1);
    });

    it('aceptar la última solicitud deja el contador en 0 y el mensaje de vacío', async () => {
      cargada([RECIBIDAS[0]]);
      porEtiqueta('Aceptar la solicitud de Berta').click();
      http.expectOne('/api/amistades/solicitudes/1/aceptar').flush(null, sinContenido);
      recargar([], ENVIADAS, AMIGOS);
      await estabilizar();
      expect(servicio.pendientes()).toBe(0);
      expect(seccion('Solicitudes recibidas').textContent).toContain('No tienes solicitudes pendientes');
    });

    it('doble clic envía una sola petición y marca el botón como ocupado', () => {
      cargada();
      const b = porEtiqueta('Aceptar la solicitud de Berta');
      b.click();
      b.click();
      fixture.detectChanges();
      const reqs = http.match('/api/amistades/solicitudes/1/aceptar');
      expect(reqs.length).toBe(1);
      expect(b.getAttribute('aria-busy')).toBe('true');
      expect(normalizado(b)).toBe('Aceptando… la solicitud de Berta');
      reqs[0].flush(null, sinContenido);
      recargar();
    });

    it('404: indica que ya no está pendiente, quita la fila y recarga', async () => {
      cargada();
      porEtiqueta('Aceptar la solicitud de Berta').click();
      http
        .expectOne('/api/amistades/solicitudes/1/aceptar')
        .flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      await estabilizar();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('ya no está pendiente');
      expect(el.querySelector('.exito')).toBeNull();
      expect(filas('Solicitudes recibidas').length).toBe(1);
      recargar([RECIBIDAS[1]]);
    });

    it('otro error (500) muestra el detalle y no recarga', async () => {
      cargada();
      porEtiqueta('Aceptar la solicitud de Berta').click();
      http
        .expectOne('/api/amistades/solicitudes/1/aceptar')
        .flush({ title: 'Error', status: 500, detail: 'Fallo interno' }, { status: 500, statusText: 'Server Error' });
      await estabilizar();
      expect(el.querySelector('.error-general')?.textContent).toContain('Fallo interno');
      expect(filas('Solicitudes recibidas').length).toBe(2);
      sinPeticiones();
    });

    it('el foco pasa al h2 de la sección cuando la fila enfocada desaparece', async () => {
      cargada();
      const b = porEtiqueta('Aceptar la solicitud de Berta');
      b.focus();
      b.click();
      http.expectOne('/api/amistades/solicitudes/1/aceptar').flush(null, sinContenido);
      await estabilizar();
      expect(document.activeElement).toBe(el.querySelector('#titulo-recibidas'));
      recargar([RECIBIDAS[1]]);
    });
  });

  describe('rechazar', () => {
    it('envía POST, quita la fila, baja el contador, avisa y recarga', async () => {
      cargada();
      porEtiqueta('Rechazar la solicitud de Carlos').click();
      const req = http.expectOne('/api/amistades/solicitudes/2/rechazar');
      expect(req.request.method).toBe('POST');
      req.flush(null, sinContenido);
      await estabilizar();
      expect(filas('Solicitudes recibidas').length).toBe(1);
      expect(servicio.pendientes()).toBe(1);
      expect(el.querySelector('.exito')?.textContent).toContain('Has rechazado la solicitud de Carlos');
      recargar([RECIBIDAS[0]]);
    });

    it('404: mensaje y recarga', async () => {
      cargada();
      porEtiqueta('Rechazar la solicitud de Carlos').click();
      http
        .expectOne('/api/amistades/solicitudes/2/rechazar')
        .flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      await estabilizar();
      expect(el.querySelector('.error-general')?.textContent).toContain('ya no está pendiente');
      recargar([RECIBIDAS[0]]);
    });
  });

  describe('retirar', () => {
    it('envía DELETE, quita la fila, avisa y recarga', async () => {
      cargada();
      porEtiqueta('Retirar la solicitud enviada a Diana').click();
      const req = http.expectOne('/api/amistades/solicitudes/5');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, sinContenido);
      await estabilizar();
      expect(filas('Solicitudes enviadas').length).toBe(0);
      expect(el.querySelector('.exito')?.textContent).toContain('Has retirado la solicitud enviada a Diana');
      recargar(RECIBIDAS, [], AMIGOS);
    });

    it('404: mensaje, quita la fila y recarga', async () => {
      cargada();
      porEtiqueta('Retirar la solicitud enviada a Diana').click();
      http
        .expectOne('/api/amistades/solicitudes/5')
        .flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      await estabilizar();
      expect(el.querySelector('.error-general')?.textContent).toContain('ya no está pendiente');
      expect(filas('Solicitudes enviadas').length).toBe(0);
      recargar(RECIBIDAS, [], AMIGOS);
    });

    it('retirar permite volver a enviar solicitud a esa persona desde el buscador', fakeAsync(() => {
      cargada();
      escribir('di');
      tick(300);
      http.expectOne((r) => r.url === '/api/usuarios/buscar').flush([{ id: 21, nombre: 'Diana' }]);
      fixture.detectChanges();
      expect(el.querySelector('#resultados-busqueda li')?.textContent).toContain('Solicitud enviada');
      porEtiqueta('Retirar la solicitud enviada a Diana').click();
      http.expectOne('/api/amistades/solicitudes/5').flush(null, sinContenido);
      fixture.detectChanges();
      expect(porEtiqueta('Enviar solicitud a Diana')).not.toBeNull();
      recargar(RECIBIDAS, [], AMIGOS);
      flush();
    }));
  });

  describe('eliminar amistad', () => {
    async function abrir(nombre = 'Elena'): Promise<void> {
      porEtiqueta(`Eliminar amistad con ${nombre}`).click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it('«Eliminar amistad» abre el diálogo con el nombre y no envía nada', async () => {
      cargada();
      await abrir();
      expect(dialogo().open).toBeTrue();
      expect(dialogo().textContent).toContain('Elena');
      sinPeticiones();
    });

    it('confirmar envía DELETE, quita al amigo, avisa y recarga', async () => {
      cargada();
      await abrir();
      boton('Sí, eliminar la amistad').click();
      const req = http.expectOne('/api/amistades/31');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, sinContenido);
      await estabilizar();
      expect(filas('Tus amigos').length).toBe(1);
      expect(seccion('Tus amigos').textContent).not.toContain('Elena');
      expect(el.querySelector('.exito')?.textContent).toContain('Elena ya no está en tu lista de amigos');
      expect(dialogo().open).toBeFalse();
      recargar(RECIBIDAS, ENVIADAS, [AMIGOS[1]]);
    });

    it('volver cierra el diálogo sin eliminar', async () => {
      cargada();
      await abrir();
      boton('No, mantenerla').click();
      await estabilizar();
      expect(dialogo().open).toBeFalse();
      expect(filas('Tus amigos').length).toBe(2);
      sinPeticiones();
    });

    it('Esc cierra el diálogo sin eliminar', async () => {
      cargada();
      await abrir();
      dialogo().dispatchEvent(new Event('cancel', { cancelable: true }));
      await estabilizar();
      expect(dialogo().open).toBeFalse();
      sinPeticiones();
    });

    it('tras cancelar, eliminar a otro amigo usa a ese amigo', async () => {
      cargada();
      await abrir('Elena');
      boton('No, mantenerla').click();
      await estabilizar();
      await abrir('Fran');
      boton('Sí, eliminar la amistad').click();
      const req = http.expectOne('/api/amistades/32');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, sinContenido);
      recargar(RECIBIDAS, ENVIADAS, [AMIGOS[0]]);
    });

    it('404: mensaje de que ya no erais amigos, quita al amigo, cierra el diálogo y recarga', async () => {
      cargada();
      await abrir();
      boton('Sí, eliminar la amistad').click();
      http
        .expectOne('/api/amistades/31')
        .flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      await estabilizar();
      expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('Ya no erais amigos');
      expect(dialogo().open).toBeFalse();
      expect(filas('Tus amigos').length).toBe(1);
      recargar(RECIBIDAS, ENVIADAS, [AMIGOS[1]]);
    });

    it('doble clic en confirmar envía un solo DELETE', async () => {
      cargada();
      await abrir();
      const confirmar = boton('Sí, eliminar la amistad');
      confirmar.click();
      confirmar.click();
      fixture.detectChanges();
      const reqs = http.match('/api/amistades/31');
      expect(reqs.length).toBe(1);
      reqs[0].flush(null, sinContenido);
      recargar(RECIBIDAS, ENVIADAS, [AMIGOS[1]]);
    });

    it('el foco acaba en el h2 «Tus amigos» al eliminar al amigo enfocado', async () => {
      cargada();
      porEtiqueta('Eliminar amistad con Elena').focus();
      await abrir();
      boton('Sí, eliminar la amistad').click();
      http.expectOne('/api/amistades/31').flush(null, sinContenido);
      await estabilizar();
      expect(document.activeElement).toBe(el.querySelector('#titulo-lista-amigos'));
      recargar(RECIBIDAS, ENVIADAS, [AMIGOS[1]]);
    });
  });

  describe('una sola acción a la vez', () => {
    it('mientras hay una acción en curso se ignoran las demás', () => {
      cargada();
      porEtiqueta('Aceptar la solicitud de Berta').click();
      porEtiqueta('Rechazar la solicitud de Carlos').click();
      porEtiqueta('Retirar la solicitud enviada a Diana').click();
      porEtiqueta('Eliminar amistad con Elena').click();
      fixture.detectChanges();
      expect(http.match('/api/amistades/solicitudes/2/rechazar').length).toBe(0);
      expect(http.match('/api/amistades/solicitudes/5').length).toBe(0);
      expect(dialogo().open).toBeFalse();
      for (const etiqueta of [
        'Rechazar la solicitud de Carlos',
        'Retirar la solicitud enviada a Diana',
        'Eliminar amistad con Elena',
      ]) {
        expect(porEtiqueta(etiqueta).getAttribute('aria-disabled')).toBe('true');
      }
      http.expectOne('/api/amistades/solicitudes/1/aceptar').flush(null, sinContenido);
      recargar([RECIBIDAS[1]]);
    });

    it('al terminar la acción los botones vuelven a estar activos', async () => {
      cargada();
      porEtiqueta('Aceptar la solicitud de Berta').click();
      http.expectOne('/api/amistades/solicitudes/1/aceptar').flush(null, sinContenido);
      await estabilizar();
      expect(porEtiqueta('Rechazar la solicitud de Carlos').getAttribute('aria-disabled')).toBe('false');
      recargar([RECIBIDAS[1]]);
    });
  });

  /** Escribe en el buscador y lanza el evento `input`. */
  function escribir(texto: string): void {
    const input = el.querySelector('#busqueda-nombre') as HTMLInputElement;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const buscar = () => http.match((r) => r.url === '/api/usuarios/buscar');
  const resultados = () => Array.from(el.querySelectorAll('#resultados-busqueda li'));

  describe('buscador', () => {
    it('no busca con 1 carácter', fakeAsync(() => {
      cargada();
      escribir('a');
      tick(1000);
      expect(buscar().length).toBe(0);
      expect(el.querySelector('div[aria-live] p')).toBeNull();
    }));

    it('los espacios no cuentan: «  a  » no busca', fakeAsync(() => {
      cargada();
      escribir('  a  ');
      tick(1000);
      expect(buscar().length).toBe(0);
    }));

    it('espera 300 ms desde la última pulsación y envía el término recortado', fakeAsync(() => {
      cargada();
      escribir(' ma ');
      tick(299);
      expect(buscar().length).toBe(0);
      expect(el.querySelector('div[aria-live]')?.textContent).toContain('Buscando');
      tick(1);
      const reqs = buscar();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('q')).toBe('ma');
      reqs[0].flush([]);
    }));

    it('escribir de nuevo reinicia la espera: solo se busca el último texto', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(200);
      escribir('mar');
      tick(200);
      expect(buscar().length).toBe(0);
      tick(100);
      const reqs = buscar();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('q')).toBe('mar');
      reqs[0].flush([]);
    }));

    it('cancela la búsqueda anterior si llega otra y descarta su respuesta', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      const primera = buscar()[0];
      escribir('mar');
      tick(300);
      expect(primera.cancelled).toBeTrue();
      const segunda = buscar()[0];
      expect(segunda.request.params.get('q')).toBe('mar');
      segunda.flush([{ id: 40, nombre: 'Marta' }]);
      fixture.detectChanges();
      expect(resultados().length).toBe(1);
      expect(resultados()[0].textContent).toContain('Marta');
    }));

    it('borrar hasta menos de 2 caracteres cancela la búsqueda en curso y limpia los resultados', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      const pendiente = buscar()[0];
      escribir('m');
      expect(pendiente.cancelled).toBeTrue();
      tick(500);
      expect(buscar().length).toBe(0);
      expect(el.querySelector('div[aria-live]')?.textContent).not.toContain('Buscando');
    }));

    it('borrar tras haber resultados los oculta', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      buscar()[0].flush([{ id: 40, nombre: 'Marta' }]);
      fixture.detectChanges();
      expect(resultados().length).toBe(1);
      escribir('');
      fixture.detectChanges();
      expect(resultados().length).toBe(0);
    }));

    it('0 resultados: lo anuncia en la región aria-live', fakeAsync(() => {
      cargada();
      escribir('zz');
      tick(300);
      buscar()[0].flush([]);
      fixture.detectChanges();
      expect(el.querySelector('div[aria-live]')?.textContent).toContain('No se ha encontrado a nadie con «zz»');
      expect(resultados().length).toBe(0);
    }));

    it('con resultados anuncia cuántos hay, en singular y plural', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      buscar()[0].flush([{ id: 40, nombre: 'Marta' }]);
      fixture.detectChanges();
      expect(el.querySelector('div[aria-live]')?.textContent).toContain('1 persona encontrada');
      escribir('mar');
      tick(300);
      buscar()[0].flush([
        { id: 40, nombre: 'Marta' },
        { id: 41, nombre: 'Mario' },
      ]);
      fixture.detectChanges();
      expect(el.querySelector('div[aria-live]')?.textContent).toContain('2 personas encontradas');
    }));

    it('400: muestra el detalle del servidor en un alert y no deja resultados', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      buscar()[0].flush(
        { title: 'Solicitud no válida', status: 400, detail: 'El texto debe tener entre 2 y 100 caracteres' },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      expect(el.querySelector('p.error[role="alert"]')?.textContent).toContain('entre 2 y 100 caracteres');
      expect(resultados().length).toBe(0);
      expect(el.querySelector('div[aria-live]')?.textContent).not.toContain('Buscando');
    }));

    it('tras un 400, una nueva búsqueda correcta limpia el error', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      buscar()[0].flush({ title: 'x', status: 400 }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      escribir('mar');
      tick(300);
      buscar()[0].flush([{ id: 40, nombre: 'Marta' }]);
      fixture.detectChanges();
      expect(el.querySelector('p.error[role="alert"]')).toBeNull();
      expect(resultados().length).toBe(1);
    }));

    it('el nombre de un resultado se muestra como texto', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      buscar()[0].flush([{ id: 40, nombre: '<i>Marta</i>' }]);
      fixture.detectChanges();
      expect(resultados()[0].querySelector('i')).toBeNull();
      expect(resultados()[0].textContent).toContain('<i>Marta</i>');
    }));

    describe('estado de cada resultado', () => {
      const USUARIOS = [
        { id: 31, nombre: 'Elena' }, // amiga
        { id: 21, nombre: 'Diana' }, // solicitud enviada
        { id: 11, nombre: 'Berta' }, // solicitud recibida
        { id: 50, nombre: 'Nadia' }, // disponible
      ];

      function buscarTodos(): void {
        cargada();
        escribir('na');
        tick(300);
        buscar()[0].flush(USUARIOS);
        fixture.detectChanges();
      }

      it('disponible: botón «Enviar solicitud» con nombre accesible', fakeAsync(() => {
        buscarTodos();
        const b = porEtiqueta('Enviar solicitud a Nadia');
        expect(b.firstChild?.textContent?.trim()).toBe('Enviar solicitud');
        expect(b.getAttribute('aria-disabled')).toBe('false');
      }));

      it('enviada: «Solicitud enviada» con aria-disabled y sin acción', fakeAsync(() => {
        buscarTodos();
        const b = porEtiqueta('Solicitud enviada a Diana');
        expect(b.firstChild?.textContent?.trim()).toBe('Solicitud enviada');
        expect(b.getAttribute('aria-disabled')).toBe('true');
        b.click();
        sinPeticiones();
      }));

      it('recibida: «Te ha enviado una solicitud» y sin botón de enviar', fakeAsync(() => {
        buscarTodos();
        const fila = resultados()[2];
        expect(fila.textContent).toContain('Te ha enviado una solicitud');
        expect(fila.querySelector('button')).toBeNull();
      }));

      it('amigo: «Ya sois amigos» y sin botón de enviar', fakeAsync(() => {
        buscarTodos();
        const fila = resultados()[0];
        expect(fila.textContent).toContain('Ya sois amigos');
        expect(fila.querySelector('button')).toBeNull();
      }));
    });

    describe('enviar solicitud', () => {
      function buscarNadia(): void {
        cargada();
        escribir('na');
        tick(300);
        buscar()[0].flush([{ id: 50, nombre: 'Nadia' }]);
        fixture.detectChanges();
      }

      it('201: avisa, el botón pasa a «Solicitud enviada» deshabilitado y aparece en enviadas', fakeAsync(() => {
        buscarNadia();
        porEtiqueta('Enviar solicitud a Nadia').click();
        const req = http.expectOne('/api/amistades/solicitudes');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ usuarioId: 50 });
        req.flush(
          { id: 70, usuario: { id: 50, nombre: 'Nadia' }, fecha: '2026-10-15T10:00:00Z' },
          { status: 201, statusText: 'Created' },
        );
        fixture.detectChanges();
        const b = porEtiqueta('Solicitud enviada a Nadia');
        expect(b.getAttribute('aria-disabled')).toBe('true');
        expect(el.querySelector('[role="status"] .exito')?.textContent).toContain('Solicitud de amistad enviada a Nadia');
        expect(seccion('Solicitudes enviadas').textContent).toContain('Nadia');
        recargar(RECIBIDAS, [...ENVIADAS, { id: 70, usuario: { id: 50, nombre: 'Nadia' }, fecha: '2026-10-15T10:00:00Z' }]);
        expect(porEtiqueta('Solicitud enviada a Nadia')).not.toBeNull();
      }));

      it('doble clic envía una sola solicitud', fakeAsync(() => {
        buscarNadia();
        const b = porEtiqueta('Enviar solicitud a Nadia');
        b.click();
        b.click();
        fixture.detectChanges();
        const reqs = http.match('/api/amistades/solicitudes');
        expect(reqs.length).toBe(1);
        expect(b.getAttribute('aria-busy')).toBe('true');
        expect(normalizado(b)).toBe('Enviando… a Nadia');
        reqs[0].flush(
          { id: 70, usuario: { id: 50, nombre: 'Nadia' }, fecha: '2026-10-15T10:00:00Z' },
          { status: 201, statusText: 'Created' },
        );
        recargar();
      }));

      it('409: mensaje claro, sin aviso de éxito, y recarga las listas', fakeAsync(() => {
        buscarNadia();
        porEtiqueta('Enviar solicitud a Nadia').click();
        http
          .expectOne('/api/amistades/solicitudes')
          .flush({ title: 'Conflicto', status: 409 }, { status: 409, statusText: 'Conflict' });
        fixture.detectChanges();
        const alerta = el.querySelector('.error-general[role="alert"]');
        expect(alerta?.textContent).toContain('Nadia');
        expect(alerta?.textContent).toContain('ya sois amigos o ya hay una solicitud pendiente');
        expect(el.querySelector('.exito')).toBeNull();
        // tras recargar, Nadia es amiga: el estado del resultado se actualiza
        recargar(RECIBIDAS, ENVIADAS, [...AMIGOS, { usuarioId: 50, nombre: 'Nadia', desde: '2026-10-15T10:00:00Z' }]);
        expect(resultados()[0].textContent).toContain('Ya sois amigos');
      }));

      it('404: indica que la persona ya no está disponible y recarga', fakeAsync(() => {
        buscarNadia();
        porEtiqueta('Enviar solicitud a Nadia').click();
        http
          .expectOne('/api/amistades/solicitudes')
          .flush({ title: 'No encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
        fixture.detectChanges();
        expect(el.querySelector('.error-general[role="alert"]')?.textContent).toContain('Nadia ya no está disponible');
        recargar();
      }));

      it('400 (a ti mismo): muestra el detalle del servidor y no recarga', fakeAsync(() => {
        buscarNadia();
        porEtiqueta('Enviar solicitud a Nadia').click();
        http
          .expectOne('/api/amistades/solicitudes')
          .flush(
            { title: 'Solicitud no válida', status: 400, detail: 'No puedes enviarte una solicitud a ti mismo' },
            { status: 400, statusText: 'Bad Request' },
          );
        fixture.detectChanges();
        expect(el.querySelector('.error-general')?.textContent).toContain('a ti mismo');
        sinPeticiones();
      }));

      it('mientras envía, las demás acciones se ignoran', fakeAsync(() => {
        buscarNadia();
        porEtiqueta('Enviar solicitud a Nadia').click();
        porEtiqueta('Aceptar la solicitud de Berta').click();
        expect(http.match('/api/amistades/solicitudes/1/aceptar').length).toBe(0);
        http
          .expectOne('/api/amistades/solicitudes')
          .flush(
            { id: 70, usuario: { id: 50, nombre: 'Nadia' }, fecha: '2026-10-15T10:00:00Z' },
            { status: 201, statusText: 'Created' },
          );
        recargar();
      }));
    });
  });

  describe('foco tras enviar la solicitud', () => {
    it('el foco pasa al botón «Solicitud enviada» (#solicitud-enviada-{id})', fakeAsync(() => {
      cargada();
      escribir('na');
      tick(300);
      buscar()[0].flush([{ id: 50, nombre: 'Nadia' }]);
      fixture.detectChanges();
      const enviar = porEtiqueta('Enviar solicitud a Nadia');
      enviar.focus();
      enviar.click();
      http
        .expectOne('/api/amistades/solicitudes')
        .flush(
          { id: 70, usuario: { id: 50, nombre: 'Nadia' }, fecha: '2026-10-15T10:00:00Z' },
          { status: 201, statusText: 'Created' },
        );
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      const destino = el.querySelector('#solicitud-enviada-50') as HTMLButtonElement;
      expect(destino).not.toBeNull();
      expect(destino.getAttribute('aria-disabled')).toBe('true');
      expect(document.activeElement).toBe(destino);
      recargar();
    }));

    it('idSolicitudEnviada construye el id a partir del usuario', () => {
      expect(idSolicitudEnviada(50)).toBe('solicitud-enviada-50');
    });
  });

  describe('reintentar la búsqueda', () => {
    const error400 = () => ({ title: 'x', status: 400, detail: 'Texto no válido' });
    const reintentar = () => porEtiqueta('Reintentar la búsqueda');

    it('tras un error muestra «Reintentar» junto al mensaje; sin error no existe', fakeAsync(() => {
      cargada();
      expect(reintentar()).toBeUndefined();
      escribir('ma');
      tick(300);
      buscar()[0].flush(error400(), { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(reintentar()).toBeDefined();
      expect(el.querySelector('p.error[role="alert"]')?.textContent).toContain('Texto no válido');
    }));

    it('repite la misma búsqueda, devuelve el foco al campo y limpia el error si funciona', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      buscar()[0].flush(error400(), { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      reintentar().click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(el.querySelector('#busqueda-nombre'));
      tick(300);
      const reqs = buscar();
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.get('q')).toBe('ma');
      reqs[0].flush([{ id: 40, nombre: 'Marta' }]);
      fixture.detectChanges();
      expect(el.querySelector('p.error[role="alert"]')).toBeNull();
      expect(reintentar()).toBeUndefined();
      expect(resultados().length).toBe(1);
    }));

    it('se puede reintentar más de una vez la misma búsqueda', fakeAsync(() => {
      cargada();
      escribir('ma');
      tick(300);
      buscar()[0].flush(error400(), { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      for (let i = 0; i < 2; i++) {
        reintentar().click();
        fixture.detectChanges();
        tick(300);
        const reqs = buscar();
        expect(reqs.length).toBe(1);
        expect(reqs[0].request.params.get('q')).toBe('ma');
        reqs[0].flush(error400(), { status: 400, statusText: 'Bad Request' });
        fixture.detectChanges();
        expect(reintentar()).toBeDefined();
      }
    }));
  });

  describe('label in name (WCAG 2.5.3)', () => {
    /** Texto visible de un botón: su contenido sin los fragmentos `visualmente-oculto`. */
    function visible(b: HTMLElement): string {
      const copia = b.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('.visualmente-oculto').forEach((o) => o.remove());
      return (copia.textContent ?? '').replace(/\s+/g, ' ').trim();
    }
    /** Nombre accesible aproximado: `aria-label` si existe, si no el texto completo. */
    const nombre = (b: HTMLElement) => b.getAttribute('aria-label') ?? normalizado(b);

    function comprobarTodos(): void {
      const botones = Array.from(el.querySelectorAll('button')).filter((b) => !b.closest('dialog'));
      expect(botones.length).toBeGreaterThan(0);
      for (const b of botones) {
        const texto = visible(b);
        expect(texto).not.toBe('');
        expect(nombre(b).toLowerCase()).toContain(texto.toLowerCase());
        // El nombre accesible debe distinguir a la persona (más que el texto visible).
        expect(nombre(b).length).toBeGreaterThan(texto.length);
      }
    }

    it('en reposo, cada botón contiene su texto visible en su nombre accesible', fakeAsync(() => {
      cargada();
      escribir('na');
      tick(300);
      buscar()[0].flush([
        { id: 50, nombre: 'Nadia' },
        { id: 21, nombre: 'Diana' },
      ]);
      fixture.detectChanges();
      comprobarTodos();
    }));

    const ocupados: [string, string, string, () => void][] = [
      ['aceptar', 'Aceptar la solicitud de Berta', '/api/amistades/solicitudes/1/aceptar', () => undefined],
      ['rechazar', 'Rechazar la solicitud de Berta', '/api/amistades/solicitudes/1/rechazar', () => undefined],
      ['retirar', 'Retirar la solicitud enviada a Diana', '/api/amistades/solicitudes/5', () => undefined],
    ];
    for (const [accion, etiqueta, url] of ocupados) {
      it(`con la acción «${accion}» en curso, el texto de ocupado sigue contenido en el nombre`, () => {
        cargada();
        porEtiqueta(etiqueta).click();
        fixture.detectChanges();
        expect(el.querySelector('button[aria-busy="true"]')).not.toBeNull();
        comprobarTodos();
        const req = http.expectOne(url);
        req.flush(null, sinContenido);
        recargar();
      });
    }

    it('con «Enviar solicitud» en curso, «Enviando…» sigue contenido en el nombre', fakeAsync(() => {
      cargada();
      escribir('na');
      tick(300);
      buscar()[0].flush([{ id: 50, nombre: 'Nadia' }]);
      fixture.detectChanges();
      porEtiqueta('Enviar solicitud a Nadia').click();
      fixture.detectChanges();
      expect(el.querySelector('button[aria-busy="true"]')).not.toBeNull();
      comprobarTodos();
      http
        .expectOne('/api/amistades/solicitudes')
        .flush(
          { id: 70, usuario: { id: 50, nombre: 'Nadia' }, fecha: '2026-10-15T10:00:00Z' },
          { status: 201, statusText: 'Created' },
        );
      recargar();
    }));
  });

  it('el término no se pierde al recargar las listas tras una acción', fakeAsync(() => {
    cargada();
    escribir('na');
    tick(300);
    buscar()[0].flush([{ id: 50, nombre: 'Nadia' }]);
    fixture.detectChanges();
    porEtiqueta('Aceptar la solicitud de Berta').click();
    http.expectOne('/api/amistades/solicitudes/1/aceptar').flush(null, sinContenido);
    recargar([RECIBIDAS[1]]);
    expect((el.querySelector('#busqueda-nombre') as HTMLInputElement).value).toBe('na');
    expect(resultados().length).toBe(1);
  }));

  it('una recarga que falla tras una acción conserva las listas y avisa', async () => {
    cargada();
    porEtiqueta('Aceptar la solicitud de Berta').click();
    http.expectOne('/api/amistades/solicitudes/1/aceptar').flush(null, sinContenido);
    http
      .expectOne('/api/amistades/solicitudes/recibidas')
      .flush(null, { status: 500, statusText: 'Server Error' });
    http.match('/api/amistades/solicitudes/enviadas');
    http.match('/api/amistades');
    await estabilizar();
    expect(el.querySelector('.aviso[role="alert"]')?.textContent).toContain('No se han podido actualizar');
    expect(seccion('Tus amigos').textContent).toContain('Elena');
  });
});
