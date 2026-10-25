import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guards';

/**
 * Rutas raíz. Todas las vistas se cargan de forma **diferida** (lazy loading):
 * cada `loadComponent` / `loadChildren` genera un *chunk* JavaScript propio que
 * solo se descarga cuando se navega a la ruta.
 *
 * Los guards son `canMatch`: si fallan, el chunk protegido ni se descarga.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    title: 'Crear cuenta',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/registro/registro.page').then((m) => m.RegistroPage),
  },
  {
    path: 'app',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    loadChildren: () => import('./features/features.routes').then((m) => m.FEATURE_ROUTES),
  },
  { path: '', redirectTo: 'app/inicio', pathMatch: 'full' },
  {
    path: '**',
    title: 'Página no encontrada',
    loadComponent: () => import('./features/errores/no-encontrado.page').then((m) => m.NoEncontradoPage),
  },
];
