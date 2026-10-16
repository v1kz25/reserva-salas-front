import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { SesionService } from './core/services/sesion.service';

describe('AppComponent: enlace «Usuarios»', () => {
  let sesion: SesionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    sesion = TestBed.inject(SesionService);
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const enlace = (el: HTMLElement) => el.querySelector<HTMLAnchorElement>('nav a[href="/admin/usuarios"]');

  it('un ADMIN ve «Usuarios» junto a «Salas» en la navegación de administración', () => {
    sesion.establecer({ id: 9, email: 'admin@example.com', nombre: 'Admin', rol: 'ADMIN' });
    const el = render();
    expect(enlace(el)?.textContent?.trim()).toBe('Usuarios');
    expect(el.querySelector('nav[aria-label="Administración"] a[href="/admin/salas"]')).not.toBeNull();
  });

  it('un USER no ve el enlace', () => {
    sesion.establecer({ id: 1, email: 'ana@example.com', nombre: 'Ana', rol: 'USER' });
    expect(enlace(render())).toBeNull();
  });

  it('sin sesión no ve el enlace', () => {
    sesion.limpiar();
    expect(enlace(render())).toBeNull();
  });
});
