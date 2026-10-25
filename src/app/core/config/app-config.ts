import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Configuración de la aplicación inyectable (facilita los tests). */
export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  production: boolean;
  pageSize: number;
}

/** Token de inyección de la configuración. */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => ({ ...environment }),
});

/**
 * Indica si la configuración de Supabase está completa.
 * Si no lo está, la app muestra una pantalla informativa en lugar de fallar.
 */
export function isConfigured(config: AppConfig): boolean {
  return /^https:\/\/.+/.test(config.supabaseUrl) && config.supabaseAnonKey.length > 20;
}
