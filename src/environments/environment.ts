import { runtimeEnv } from './runtime-env';

/**
 * Configuración de entorno (desarrollo).
 * Las credenciales de Supabase se inyectan en tiempo de build desde variables
 * de entorno (`scripts/set-env.mjs`), nunca se escriben en el repositorio.
 */
export const environment = {
  production: false,
  supabaseUrl: runtimeEnv.supabaseUrl,
  supabaseAnonKey: runtimeEnv.supabaseAnonKey,
  /** Contraseñas de las cuentas demo (vacías = panel de acceso rápido desactivado) */
  demoAdminPassword: runtimeEnv.demoAdminPassword,
  demoUserPassword: runtimeEnv.demoUserPassword,
  /** Número de filas por página por defecto en las tablas de datos */
  pageSize: 10,
};
