import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Session } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { Profile, UserRole } from '../models';
import { SupabaseClientService } from '../services/supabase-client.service';
import { SqlApiService } from '../services/sql-api.service';

/** Fase del ciclo de autenticación. */
export type AuthStatus = 'init' | 'authenticated' | 'anonymous';

/** Estado global de autenticación (inmutable, solo cambia con `patchState`). */
export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  status: AuthStatus;
  loading: boolean;
  error: string | null;
}

/** Datos del formulario de registro. */
export interface RegistroData {
  email: string;
  password: string;
  nombre: string;
  departamento: string;
}

/** Resultado del registro: si Supabase exige confirmar el email no hay sesión. */
export interface RegistroResult {
  needsConfirmation: boolean;
}

const initialState: AuthState = { session: null, profile: null, status: 'init', loading: false, error: null };

/** Traduce los mensajes de Supabase Auth más habituales. */
function authMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos';
  if (/email not confirmed/i.test(msg)) return 'Debes confirmar tu email antes de entrar';
  if (/already registered|already exists/i.test(msg)) return 'Ya existe una cuenta con ese email';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera unos minutos';
  if (/failed to fetch|network/i.test(msg)) return 'No hay conexión con el servidor';
  return msg;
}

/**
 * **AuthStore** — estado global de sesión y rol (NgRx Signals Store).
 *
 * - Flujo unidireccional: los componentes leen señales de solo lectura y
 *   solo pueden cambiar el estado a través de los métodos del store.
 * - Se sincroniza con Supabase Auth (`onAuthStateChange`), que refresca el JWT
 *   automáticamente antes de que caduque.
 * - El rol se lee de la tabla `profiles` protegida por RLS: aunque se manipulara
 *   el cliente, el servidor seguiría denegando las operaciones de administrador.
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ session, profile, status }) => ({
    isAuthenticated: computed(() => status() === 'authenticated' && session() !== null),
    role: computed<UserRole | null>(() => profile()?.role ?? null),
    isAdmin: computed(() => profile()?.role === 'admin'),
    userId: computed(() => session()?.user.id ?? null),
    displayName: computed(() => profile()?.nombre || session()?.user.email?.split('@')[0] || 'Invitado'),
    initials: computed(() => {
      const name = profile()?.nombre || session()?.user.email || '?';
      return name
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join('');
    }),
  })),
  withMethods((store, supa = inject(SupabaseClientService), api = inject(SqlApiService)) => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((r) => (resolveReady = r));

    /** Carga el perfil (y por tanto el rol) desde la API REST. */
    async function loadProfile(session: Session): Promise<void> {
      try {
        const rows = await firstValueFrom(api.select<Profile>('profiles', { id: `eq.${session.user.id}`, select: '*' }));
        const profile: Profile = rows[0] ?? {
          id: session.user.id,
          email: session.user.email ?? '',
          nombre: null,
          departamento: null,
          role: 'user',
          created_at: new Date().toISOString(),
        };
        patchState(store, { session, profile, status: 'authenticated', error: null });
      } catch {
        // Sin perfil no se concede ningún privilegio: rol mínimo
        patchState(store, {
          session,
          status: 'authenticated',
          profile: { id: session.user.id, email: session.user.email ?? '', nombre: null, departamento: null, role: 'user', created_at: '' },
        });
      }
    }

    return {
      /** Promesa que se resuelve cuando se ha recuperado la sesión guardada. */
      whenReady(): Promise<void> {
        return ready;
      },

      /** Recupera la sesión persistida y escucha los cambios de Supabase Auth. */
      async init(): Promise<void> {
        if (!supa.configured) {
          patchState(store, { status: 'anonymous' });
          resolveReady();
          return;
        }
        try {
          const { data } = await supa.client.auth.getSession();
          if (data.session) await loadProfile(data.session);
          else patchState(store, { status: 'anonymous' });
        } catch {
          patchState(store, { status: 'anonymous' });
        } finally {
          resolveReady();
        }

        supa.client.auth.onAuthStateChange((event, session) => {
          // No se llama a Supabase de forma síncrona dentro del callback (evita bloqueos)
          setTimeout(() => {
            if (event === 'SIGNED_OUT' || !session) {
              patchState(store, { session: null, profile: null, status: 'anonymous' });
            } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
              patchState(store, { session });
            } else if (event === 'SIGNED_IN' && store.profile()?.id !== session.user.id) {
              void loadProfile(session);
            }
          });
        });
      },

      /** Inicia sesión con email y contraseña. */
      async login(email: string, password: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const { data, error } = await supa.client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
          if (error) throw error;
          await loadProfile(data.session);
        } catch (e) {
          patchState(store, { error: authMessage(e) });
          throw new Error(authMessage(e));
        } finally {
          patchState(store, { loading: false });
        }
      },

      /** Registra un usuario estándar. El trigger `handle_new_user` crea su perfil. */
      async register(form: RegistroData): Promise<RegistroResult> {
        patchState(store, { loading: true, error: null });
        try {
          const { data, error } = await supa.client.auth.signUp({
            email: form.email.trim().toLowerCase(),
            password: form.password,
            options: { data: { nombre: form.nombre.trim(), departamento: form.departamento } },
          });
          if (error) throw error;
          if (data.session) {
            await loadProfile(data.session);
            return { needsConfirmation: false };
          }
          return { needsConfirmation: true };
        } catch (e) {
          patchState(store, { error: authMessage(e) });
          throw new Error(authMessage(e));
        } finally {
          patchState(store, { loading: false });
        }
      },

      /** Cierra la sesión (limpia primero la interfaz). */
      async logout(): Promise<void> {
        patchState(store, { session: null, profile: null, status: 'anonymous', error: null });
        if (supa.configured) await supa.client.auth.signOut().catch(() => undefined);
      },

      /** Actualiza el perfil en memoria (p. ej. tras cambiar el propio rol). */
      setProfile(profile: Profile): void {
        patchState(store, { profile });
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
  withHooks({
    onInit(store) {
      void store.init();
    },
  }),
);

/** Tipo de la instancia del store (para inyección y tests). */
export type AuthStoreInstance = InstanceType<typeof AuthStore>;
