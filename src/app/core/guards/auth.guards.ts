import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, GuardResult, Route, Router, RouterStateSnapshot, UrlSegment } from '@angular/router';
import { UserRole } from '../models';
import { AuthStore } from '../state/auth.store';

/** Ruta a la que se envía a un usuario autenticado sin el rol necesario. */
export const FORBIDDEN_URL = '/app/acceso-denegado';

/**
 * URL completa que se intentaba abrir (para `?redirect=` tras el login).
 *
 * En `canMatch` los `segments` son relativos a la ruta padre (en `/app/dashboard`
 * solo llega `dashboard`), así que se toma la URL de la navegación en curso y
 * los segmentos quedan como respaldo.
 */
function targetUrl(router: Router, segments: UrlSegment[]): string {
  const nav = router.currentNavigation();
  return nav ? router.serializeUrl(nav.extractedUrl) : '/' + segments.map((s) => s.path).join('/');
}

/**
 * Lógica de autorización compartida por las versiones `canMatch` y
 * `canActivate`: una única fuente de verdad para no duplicar reglas.
 *
 * Devuelve siempre `true` o un `UrlTree` (nunca `false`), de modo que el router
 * aborta la navegación y redirige de forma atómica en el mismo ciclo.
 *
 * @param url URL solicitada, que se conserva como `?redirect=` si hay que iniciar sesión
 * @param roles roles autorizados; vacío = basta con estar autenticado
 */
async function authorize(url: string, roles: readonly UserRole[] = []): Promise<GuardResult> {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { redirect: url } });
  }
  if (!roles.length) return true;
  const role = auth.role();
  return role !== null && roles.includes(role) ? true : router.createUrlTree([FORBIDDEN_URL]);
}

/**
 * **authGuard** (`canMatch`, primera línea, nivel red): si no hay sesión la ruta
 * no se empareja y el *chunk* diferido ni siquiera se descarga.
 */
export const authGuard: CanMatchFn = (_route: Route, segments: UrlSegment[]) => authorize(targetUrl(inject(Router), segments));

/**
 * **authActivateGuard** (`canActivate`, segunda línea, nivel vista): vuelve a
 * comprobar la sesión antes de instanciar el componente. Usa `state.url`, que
 * incluye también los parámetros de consulta.
 */
export const authActivateGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => authorize(state.url);

/**
 * **roleGuard** — factoría de guards `canMatch` por rol (RBAC).
 * @param roles roles autorizados para la ruta
 * @example { path: 'dashboard', canMatch: [roleGuard('admin')], canActivate: [roleActivateGuard('admin')] }
 */
export function roleGuard(...roles: UserRole[]): CanMatchFn {
  return (_route: Route, segments: UrlSegment[]) => authorize(targetUrl(inject(Router), segments), roles);
}

/**
 * **roleActivateGuard** — factoría de guards `canActivate` por rol. Se combina
 * con {@link roleGuard} para aplicar defensa en profundidad.
 * @param roles roles autorizados para la ruta
 */
export function roleActivateGuard(...roles: UserRole[]): CanActivateFn {
  return (_route, state: RouterStateSnapshot) => authorize(state.url, roles);
}

/** **guestGuard** — evita que un usuario con sesión vuelva al login o al registro. */
export const guestGuard: CanMatchFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.whenReady();
  return auth.isAuthenticated() ? router.createUrlTree(['/app/inicio']) : true;
};
