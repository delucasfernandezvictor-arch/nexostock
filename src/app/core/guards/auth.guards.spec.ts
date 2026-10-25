import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthStore } from '../state/auth.store';
import { authGuard, roleGuard } from './auth.guards';

/** Doble de prueba del AuthStore con señales controlables. */
function fakeAuth(authenticated: boolean, role: 'admin' | 'user' | null) {
  return {
    whenReady: () => Promise.resolve(),
    isAuthenticated: signal(authenticated),
    role: signal(role),
  };
}

const seg = (...p: string[]) => p.map((x) => new UrlSegment(x, {}));

describe('guards', () => {
  function setup(auth: ReturnType<typeof fakeAuth>) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthStore, useValue: auth }] });
    return TestBed.inject(Router);
  }

  it('authGuard redirige al login conservando la ruta', async () => {
    const router = setup(fakeAuth(false, null));
    const res = (await TestBed.runInInjectionContext(() => authGuard({} as Route, seg('app', 'pedidos'), {} as never))) as UrlTree;
    expect(router.serializeUrl(res)).toBe('/login?redirect=%2Fapp%2Fpedidos');
  });

  it('authGuard deja pasar con sesión', async () => {
    setup(fakeAuth(true, 'user'));
    expect(await TestBed.runInInjectionContext(() => authGuard({} as Route, seg('app'), {} as never))).toBe(true);
  });

  it('roleGuard(admin) bloquea al usuario estándar', async () => {
    const router = setup(fakeAuth(true, 'user'));
    const res = (await TestBed.runInInjectionContext(() => roleGuard('admin')({} as Route, seg('app', 'dashboard'), {} as never))) as UrlTree;
    expect(router.serializeUrl(res)).toBe('/app/acceso-denegado');
  });

  it('roleGuard(admin) permite al administrador', async () => {
    setup(fakeAuth(true, 'admin'));
    expect(await TestBed.runInInjectionContext(() => roleGuard('admin')({} as Route, seg('app', 'dashboard'), {} as never))).toBe(true);
  });
});
