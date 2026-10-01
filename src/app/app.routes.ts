import { Routes } from '@angular/router';

/**
 * Rutas de la aplicación. Las pantallas se cargan de forma diferida.
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
  { path: '**', redirectTo: 'reservas' },
];
