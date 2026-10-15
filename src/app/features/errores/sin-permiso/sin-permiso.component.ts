import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PaginaErrorComponent } from '../../../shared/components/pagina-error/pagina-error.component';

/**
 * SinPermisoComponent — página para las respuestas `403`. Mensaje genérico, sin detalles.
 */
@Component({
  selector: 'app-sin-permiso',
  imports: [PaginaErrorComponent, RouterLink],
  templateUrl: './sin-permiso.component.html',
  styleUrl: './sin-permiso.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SinPermisoComponent {}
