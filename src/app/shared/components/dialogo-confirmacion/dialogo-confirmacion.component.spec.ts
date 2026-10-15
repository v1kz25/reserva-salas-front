import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogoConfirmacionComponent } from './dialogo-confirmacion.component';

@Component({
  imports: [DialogoConfirmacionComponent],
  template: `
    <button id="origen" type="button">Origen</button>
    <app-dialogo-confirmacion
      titulo="Título de prueba"
      textoConfirmar="Sí"
      textoVolver="No"
      textoProcesando="Espera…"
      [abierto]="abierto()"
      [procesando]="procesando()"
      (confirmado)="confirmados = confirmados + 1"
      (cancelado)="cancelados = cancelados + 1"
    >
      <p id="contenido">Contenido</p>
    </app-dialogo-confirmacion>
  `,
})
class HostComponent {
  abierto = signal(false);
  procesando = signal(false);
  confirmados = 0;
  cancelados = 0;
}

describe('DialogoConfirmacionComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  const dialogo = () => el.querySelector('dialog') as HTMLDialogElement;
  const botones = () => Array.from(el.querySelectorAll('dialog button')) as HTMLButtonElement[];
  const volver = () => botones()[0];
  const confirmar = () => botones()[1];

  async function abrir(): Promise<void> {
    host.abierto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  it('está cerrado al inicio y muestra título, contenido y textos de los botones', () => {
    expect(dialogo().open).toBeFalse();
    expect(el.querySelector('h2')?.textContent).toContain('Título de prueba');
    expect(el.querySelector('#contenido')?.textContent).toBe('Contenido');
    expect(volver().textContent?.trim()).toBe('No');
    expect(confirmar().textContent?.trim()).toBe('Sí');
  });

  it('se abre como modal con aria-labelledby y aria-describedby válidos', async () => {
    await abrir();
    expect(dialogo().open).toBeTrue();
    expect(dialogo().matches(':modal')).toBeTrue();
    const titulo = dialogo().getAttribute('aria-labelledby') as string;
    const desc = dialogo().getAttribute('aria-describedby') as string;
    expect(el.querySelector(`#${titulo}`)?.tagName).toBe('H2');
    expect(el.querySelector(`#${desc}`)?.textContent).toContain('Contenido');
  });

  it('al abrir, el foco va al botón de volver (no destructivo)', async () => {
    (el.querySelector('#origen') as HTMLElement).focus();
    await abrir();
    expect(document.activeElement).toBe(volver());
  });

  it('al cerrar, el foco vuelve al elemento de origen', async () => {
    (el.querySelector('#origen') as HTMLElement).focus();
    await abrir();
    host.abierto.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialogo().open).toBeFalse();
    expect(document.activeElement).toBe(el.querySelector('#origen'));
  });

  it('si el elemento de origen ya no está en la página, no falla al cerrar', async () => {
    const origen = el.querySelector('#origen') as HTMLElement;
    origen.focus();
    await abrir();
    origen.remove();
    host.abierto.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialogo().open).toBeFalse();
  });

  it('confirmar emite confirmado una vez', async () => {
    await abrir();
    confirmar().click();
    expect(host.confirmados).toBe(1);
    expect(host.cancelados).toBe(0);
  });

  it('volver emite cancelado y no confirmado', async () => {
    await abrir();
    volver().click();
    expect(host.cancelados).toBe(1);
    expect(host.confirmados).toBe(0);
  });

  it('Esc (evento cancel) equivale a volver y no cierra el dialog por su cuenta', async () => {
    await abrir();
    const evento = new Event('cancel', { cancelable: true });
    dialogo().dispatchEvent(evento);
    expect(evento.defaultPrevented).toBeTrue();
    expect(host.cancelados).toBe(1);
    expect(dialogo().open).toBeTrue();
  });

  it('si el navegador cierra el dialog estando abierto, avisa al padre', async () => {
    await abrir();
    const cerrado = new Promise<void>((r) => dialogo().addEventListener('close', () => r(), { once: true }));
    dialogo().close();
    await cerrado;
    await new Promise((r) => setTimeout(r));
    // el evento close se despacha en una tarea posterior
    expect(host.cancelados).toBe(1);
  });

  it('cerrar desde el padre no emite cancelado', async () => {
    await abrir();
    host.abierto.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    expect(host.cancelados).toBe(0);
  });

  describe('mientras procesa', () => {
    beforeEach(async () => {
      await abrir();
      host.procesando.set(true);
      fixture.detectChanges();
    });

    it('marca los botones con aria-disabled, sin deshabilitarlos, y cambia el texto', () => {
      expect(confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(volver().getAttribute('aria-disabled')).toBe('true');
      expect(confirmar().disabled).toBeFalse();
      expect(confirmar().getAttribute('aria-busy')).toBe('true');
      expect(confirmar().textContent?.trim()).toBe('Espera…');
    });

    it('ignora clics repetidos en confirmar y en volver', () => {
      confirmar().click();
      confirmar().click();
      volver().click();
      expect(host.confirmados).toBe(0);
      expect(host.cancelados).toBe(0);
    });

    it('si el navegador cierra el dialog mientras procesa, no emite cancelado', async () => {
      const cerrado = new Promise<void>((r) => dialogo().addEventListener('close', () => r(), { once: true }));
      dialogo().close();
      await cerrado;
      await new Promise((r) => setTimeout(r));
      expect(host.cancelados).toBe(0);
    });

    it('si el navegador lo cerró con procesando=true y luego el padre pone abierto=false, el foco vuelve al origen', async () => {
      host.abierto.set(false);
      host.procesando.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      const origen = el.querySelector('#origen') as HTMLElement;
      origen.focus();
      await abrir();
      host.procesando.set(true);
      fixture.detectChanges();
      const cerrado = new Promise<void>((r) => dialogo().addEventListener('close', () => r(), { once: true }));
      dialogo().close();
      await cerrado;
      origen.blur();
      host.procesando.set(false);
      host.abierto.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(origen);
    });

    it('ignora Esc', () => {
      dialogo().dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(host.cancelados).toBe(0);
    });
  });
});
