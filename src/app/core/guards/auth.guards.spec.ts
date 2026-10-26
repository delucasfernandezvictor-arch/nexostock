import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, RouterStateSnapshot, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthStore } from '../state/auth.store';
import { authActivateGuard, authGuard, roleActivateGuard, roleGuard } from './auth.guards';
import { HasPendingChanges, pendingChangesGuard } from './pending-changes.guard';

/** Doble de prueba del AuthStore con señales controlables. */
function fakeAuth(authenticated: boolean, role: 'admin' | 'user' | null) {
  return {
    whenReady: () => Promise.resolve(),
    isAuthenticated: signal(authenticated),
    role: signal(role),
  };
}

const seg = (...p: string[]) => p.map((x) => new UrlSegment(x, {}));
const state = (url: string) => ({ url }) as RouterStateSnapshot;

@Component({ template: '' })
class DummyComponent {}

describe('guards', () => {
  function setup(auth: ReturnType<typeof fakeAuth>, routes: Route[] = []) {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthStore, useValue: auth }] });
    return TestBed.inject(Router);
  }

  describe('canMatch (primera línea, nivel red)', () => {
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

  describe('canActivate (segunda línea, nivel vista)', () => {
    it('authActivateGuard conserva también los parámetros de consulta', async () => {
      const router = setup(fakeAuth(false, null));
      const res = (await TestBed.runInInjectionContext(() => authActivateGuard({} as never, state('/app/pedidos?id=7')))) as UrlTree;
      expect(router.serializeUrl(res)).toBe('/login?redirect=%2Fapp%2Fpedidos%3Fid%3D7');
    });

    it('roleActivateGuard(admin) bloquea al usuario estándar y permite al admin', async () => {
      const router = setup(fakeAuth(true, 'user'));
      const denied = (await TestBed.runInInjectionContext(() => roleActivateGuard('admin')({} as never, state('/app/usuarios')))) as UrlTree;
      expect(router.serializeUrl(denied)).toBe('/app/acceso-denegado');

      TestBed.resetTestingModule();
      setup(fakeAuth(true, 'admin'));
      expect(await TestBed.runInInjectionContext(() => roleActivateGuard('admin')({} as never, state('/app/usuarios')))).toBe(true);
    });
  });

  describe('integración con el router (defensa en profundidad)', () => {
    const routes: Route[] = [
      { path: 'login', component: DummyComponent },
      {
        path: 'app',
        canMatch: [authGuard],
        canActivateChild: [authActivateGuard],
        children: [
          { path: 'inicio', component: DummyComponent },
          { path: 'acceso-denegado', component: DummyComponent },
          { path: 'dashboard', canMatch: [roleGuard('admin')], canActivate: [roleActivateGuard('admin')], component: DummyComponent },
        ],
      },
    ];

    it('sin sesión, una ruta hija redirige al login con la URL completa', async () => {
      const router = setup(fakeAuth(false, null), routes);
      await router.navigateByUrl('/app/dashboard');
      expect(router.url).toBe('/login?redirect=%2Fapp%2Fdashboard');
    });

    it('un usuario estándar acaba en "acceso denegado" al pedir el dashboard', async () => {
      const router = setup(fakeAuth(true, 'user'), routes);
      await router.navigateByUrl('/app/dashboard');
      expect(router.url).toBe('/app/acceso-denegado');
    });

    it('el administrador llega al dashboard', async () => {
      const router = setup(fakeAuth(true, 'admin'), routes);
      await router.navigateByUrl('/app/dashboard');
      expect(router.url).toBe('/app/dashboard');
    });
  });

  describe('pendingChangesGuard (canDeactivate)', () => {
    function withAlert(role: 'cancel' | 'destructive') {
      const present = vi.fn(() => Promise.resolve());
      const create = vi.fn(() => Promise.resolve({ present, onDidDismiss: () => Promise.resolve({ role }) }));
      TestBed.configureTestingModule({ providers: [{ provide: AlertController, useValue: { create } }] });
      return create;
    }
    const component = (dirty: boolean): HasPendingChanges => ({ hasPendingChanges: () => dirty });
    const run = (c: HasPendingChanges) => TestBed.runInInjectionContext(() => pendingChangesGuard(c, {} as never, {} as never, {} as never));

    it('deja salir sin preguntar si no hay cambios', async () => {
      const create = withAlert('cancel');
      expect(await run(component(false))).toBe(true);
      expect(create).not.toHaveBeenCalled();
    });

    it('si hay cambios y el usuario elige "Seguir editando", bloquea la navegación', async () => {
      withAlert('cancel');
      expect(await run(component(true))).toBe(false);
    });

    it('si hay cambios y el usuario los descarta, permite salir', async () => {
      withAlert('destructive');
      expect(await run(component(true))).toBe(true);
    });
  });
});
