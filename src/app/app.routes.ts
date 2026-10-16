import { Routes } from '@angular/router';

import { adminGuard } from './core/guards/admin.guard';
import { loginGuard, sesionGuard } from './core/guards/sesion.guard';
import { InesperadoComponent } from './features/errores/inesperado/inesperado.component';
import { NoDisponibleComponent } from './features/errores/no-disponible/no-disponible.component';
import { NoEncontradoComponent } from './features/errores/no-encontrado/no-encontrado.component';
import { SinPermisoComponent } from './features/errores/sin-permiso/sin-permiso.component';

/**
 * Rutas de la aplicación. Las pantallas se cargan de forma diferida, salvo las
 * páginas de error, que se cargan de forma eager: son pequeñas y tienen que poder
 * mostrarse aunque no haya red para descargar un chunk.
 *
 * Todas las pantallas exigen sesión (`sesionGuard`), salvo `/login`, las páginas de
 * error y la de «no encontrado». Las de `/admin/**` exigen además el rol `ADMIN`
 * (`adminGuard`, siempre detrás de `sesionGuard`).
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'reservas' },
  {
    path: 'login',
    title: 'Iniciar sesión',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'reservas',
    title: 'Reservas',
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./features/reservas/reserva-list/reserva-list.component').then((m) => m.ReservaListComponent),
  },
  {
    path: 'reservas/nueva',
    title: 'Nueva reserva',
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./features/reservas/reserva-form/reserva-form.component').then((m) => m.ReservaFormComponent),
  },
  {
    path: 'reservas/:id',
    title: 'Reserva',
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./features/reservas/reserva-detalle/reserva-detalle.component').then((m) => m.ReservaDetalleComponent),
  },
  {
    path: 'amigos',
    title: 'Amigos',
    canActivate: [sesionGuard],
    loadComponent: () => import('./features/amistades/amigos/amigos.component').then((m) => m.AmigosComponent),
  },
  {
    path: 'admin/salas',
    title: 'Salas',
    canActivate: [sesionGuard, adminGuard],
    loadComponent: () => import('./features/salas/sala-list/sala-list.component').then((m) => m.SalaListComponent),
  },
  {
    path: 'admin/salas/nueva',
    title: 'Nueva sala',
    canActivate: [sesionGuard, adminGuard],
    loadComponent: () => import('./features/salas/sala-form/sala-form.component').then((m) => m.SalaFormComponent),
  },
  {
    path: 'admin/salas/:id',
    title: 'Editar sala',
    canActivate: [sesionGuard, adminGuard],
    loadComponent: () => import('./features/salas/sala-form/sala-form.component').then((m) => m.SalaFormComponent),
  },
  {
    path: 'admin/usuarios',
    title: 'Usuarios',
    canActivate: [sesionGuard, adminGuard],
    loadComponent: () =>
      import('./features/usuarios/usuario-list/usuario-list.component').then((m) => m.UsuarioListComponent),
  },
  {
    path: 'admin/usuarios/nuevo',
    title: 'Nuevo usuario',
    canActivate: [sesionGuard, adminGuard],
    loadComponent: () =>
      import('./features/usuarios/usuario-alta/usuario-alta.component').then((m) => m.UsuarioAltaComponent),
  },
  {
    path: 'admin/usuarios/:id',
    title: 'Editar usuario',
    canActivate: [sesionGuard, adminGuard],
    loadComponent: () =>
      import('./features/usuarios/usuario-edicion/usuario-edicion.component').then((m) => m.UsuarioEdicionComponent),
  },
  {
    path: 'admin/ajustes',
    title: 'Ajustes',
    canActivate: [sesionGuard, adminGuard],
    loadComponent: () => import('./features/ajustes/ajustes.component').then((m) => m.AjustesComponent),
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
