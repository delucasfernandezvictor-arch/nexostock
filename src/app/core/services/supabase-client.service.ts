import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG, isConfigured } from '../config/app-config';

/**
 * Envoltorio del SDK de Supabase (singleton).
 *
 * Se usa para:
 *  - **Auth**: sesión, login, registro y refresco automático del JWT.
 *  - **Realtime**: suscripción por WebSocket al almacén documental (NoSQL).
 *
 * El acceso a las tablas relacionales (SQL) NO pasa por aquí, sino por
 * {@link SqlApiService} (API REST de PostgREST con HttpClient).
 */
@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly config = inject(APP_CONFIG);
  private instance: SupabaseClient | null = null;

  /** `true` si hay URL y clave de Supabase configuradas. */
  readonly configured = isConfigured(this.config);

  /**
   * Cliente de Supabase. Se crea de forma perezosa la primera vez.
   * @throws Error si la app no está configurada
   */
  get client(): SupabaseClient {
    if (!this.configured) {
      throw new Error('Supabase no está configurado (SUPABASE_URL / SUPABASE_ANON_KEY)');
    }
    this.instance ??= createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    return this.instance;
  }
}
