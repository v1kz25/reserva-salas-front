import { Routes } from '@angular/router';

import { InesperadoComponent } from './features/errores/inesperado/inesperado.component';
import { NoDisponibleComponent } from './features/errores/no-disponible/no-disponible.component';
import { NoEncontradoComponent } from './features/errores/no-encontrado/no-encontrado.component';
import { SinPermisoComponent } from './features/errores/sin-permiso/sin-permiso.component';

/**
 * Rutas de la aplicación. Las pantallas se cargan de forma diferida, salvo las
 * páginas de error, que se cargan de forma eager: son pequeñas y tienen que poder
 * mostrarse aunque no haya red para descargar un chunk.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'reservas' },
  {
    path: 'reservas',
    title: 'Reservas',
    loadComponent: () =>
      import('./features/reservas/reserva-list/reserva-list.component').then((m) => m.ReservaListComponent),
  },
  {
    path: 'reservas/nueva',
    title: 'Nueva reserva',
    loadComponent: () =>
      import('./features/reservas/reserva-form/reserva-form.component').then((m) => m.ReservaFormComponent),
  },
  {
    path: 'error/no-disponible',
    pathMatch: 'full',
    title: 'Servicio no disponible',
    component: NoDisponibleComponent,
  },
  {
    path: 'error/inesperado',
    pathMatch: 'full',
    title: 'Error inesperado',
    component: InesperadoComponent,
  },
  {
    path: 'error/sin-permiso',
    pathMatch: 'full',
    title: 'Sin permiso',
    component: SinPermisoComponent,
  },
  { path: 'no-encontrado', pathMatch: 'full', title: 'Página no encontrada', component: NoEncontradoComponent },
  { path: '**', title: 'Página no encontrada', component: NoEncontradoComponent },
];
