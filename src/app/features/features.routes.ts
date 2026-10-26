import { Route, Routes } from '@angular/router';
import { roleActivateGuard, roleGuard } from '../core/guards/auth.guards';
import { pendingChangesGuard } from '../core/guards/pending-changes.guard';

/**
 * Protección de las rutas de administración con defensa en profundidad:
 * `canMatch` impide descargar el código y `canActivate` impide instanciar la vista.
 */
const ADMIN_ONLY: Pick<Route, 'canMatch' | 'canActivate'> = {
  canMatch: [roleGuard('admin')],
  canActivate: [roleActivateGuard('admin')],
};

/** Rutas internas (requieren sesión). Las marcadas con `ADMIN_ONLY` solo para administradores. */
export const FEATURE_ROUTES: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'inicio',
    title: 'Inicio',
    loadComponent: () => import('./inicio/inicio.page').then((m) => m.InicioPage),
  },
  {
    path: 'catalogo',
    title: 'Catálogo',
    loadComponent: () => import('./catalogo/catalogo.page').then((m) => m.CatalogoPage),
  },
  {
    path: 'pedidos',
    title: 'Pedidos',
    loadComponent: () => import('./pedidos/pedidos.page').then((m) => m.PedidosPage),
  },
  {
    path: 'pedidos/nuevo',
    title: 'Nuevo pedido',
    loadComponent: () => import('./pedidos/nuevo-pedido.page').then((m) => m.NuevoPedidoPage),
  },
  {
    path: 'informes',
    title: 'Informes',
    loadComponent: () => import('./informes/informes.page').then((m) => m.InformesPage),
  },
  {
    path: 'ayuda',
    title: 'Ayuda',
    loadComponent: () => import('./ayuda/ayuda.page').then((m) => m.AyudaPage),
  },
  {
    path: 'accesibilidad',
    title: 'Accesibilidad',
    loadComponent: () => import('./accesibilidad/accesibilidad.page').then((m) => m.AccesibilidadPage),
  },

  // --- Solo ADMINISTRADOR ---
  {
    path: 'dashboard',
    title: 'Cuadro de mando',
    ...ADMIN_ONLY,
    loadComponent: () => import('./admin/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'productos/nuevo',
    title: 'Alta de producto',
    ...ADMIN_ONLY,
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./admin/producto-form/producto-form.page').then((m) => m.ProductoFormPage),
  },
  {
    path: 'productos/:id',
    title: 'Editar producto',
    ...ADMIN_ONLY,
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./admin/producto-form/producto-form.page').then((m) => m.ProductoFormPage),
  },
  {
    path: 'usuarios',
    title: 'Usuarios y roles',
    ...ADMIN_ONLY,
    loadComponent: () => import('./admin/usuarios/usuarios.page').then((m) => m.UsuariosPage),
  },
  {
    path: 'avisos',
    title: 'Avisos',
    ...ADMIN_ONLY,
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./admin/avisos/avisos.page').then((m) => m.AvisosPage),
  },

  {
    path: 'acceso-denegado',
    title: 'Acceso denegado',
    loadComponent: () => import('./errores/acceso-denegado.page').then((m) => m.AccesoDenegadoPage),
  },
  {
    path: '**',
    title: 'Página no encontrada',
    loadComponent: () => import('./errores/no-encontrado.page').then((m) => m.NoEncontradoPage),
  },
];
