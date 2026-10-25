import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { UserRole } from '../models';
import { AuthStore } from '../state/auth.store';

/** Reconstruye la URL solicitada a partir de los segmentos (para `?redirect=`). */
function requestedUrl(segments: UrlSegment[]): string {
  return '/' + segments.map((s) => s.path).join('/');
}

/**
 * **authGuard** — solo deja pasar a usuarios autenticados.
 *
 * Se usa como `canMatch`: si no hay sesión la ruta ni siquiera se "empareja",
 * por lo que el *chunk* de código diferido (lazy loading) no se descarga.
 * Espera de forma asíncrona a que se restaure la sesión persistida.
 */
export const authGuard: CanMatchFn = async (_route: Route, segments: UrlSegment[]): Promise<boolean | UrlTree> => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], { queryParams: { redirect: requestedUrl(segments) } });
};

/**
 * **roleGuard** — fábrica de guards por rol (RBAC).
 * @param roles roles autorizados para la ruta
 * @example { path: 'dashboard', canMatch: [roleGuard('admin')], loadComponent: ... }
 */
export function roleGuard(...roles: UserRole[]): CanMatchFn {
  return async (_route: Route, segments: UrlSegment[]): Promise<boolean | UrlTree> => {
    const auth = inject(AuthStore);
    const router = inject(Router);
    await auth.whenReady();
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], { queryParams: { redirect: requestedUrl(segments) } });
    }
    const role = auth.role();
    return role !== null && roles.includes(role) ? true : router.createUrlTree(['/app/acceso-denegado']);
  };
}

/** **guestGuard** — evita que un usuario con sesión vuelva al login/registro. */
export const guestGuard: CanMatchFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.whenReady();
  return auth.isAuthenticated() ? router.createUrlTree(['/app/inicio']) : true;
};
