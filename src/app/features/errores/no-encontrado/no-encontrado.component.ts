import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PaginaErrorComponent } from '../../../shared/components/pagina-error/pagina-error.component';

/**
 * NoEncontradoComponent — página para las rutas inexistentes del front. No redirige
 * sola: ofrece un enlace a `/reservas`.
 */
@Component({
  selector: 'app-no-encontrado',
  imports: [PaginaErrorComponent, RouterLink],
  templateUrl: './no-encontrado.component.html',
  styleUrl: './no-encontrado.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoEncontradoComponent {}
