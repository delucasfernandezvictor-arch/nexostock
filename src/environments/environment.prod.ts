import { runtimeEnv } from './runtime-env';

/** Configuración de entorno (producción). Ver `environment.ts`. */
export const environment = {
  production: true,
  supabaseUrl: runtimeEnv.supabaseUrl,
  supabaseAnonKey: runtimeEnv.supabaseAnonKey,
  /** Contraseñas de las cuentas demo (vacías = panel de acceso rápido desactivado) */
  demoAdminPassword: runtimeEnv.demoAdminPassword,
  demoUserPassword: runtimeEnv.demoUserPassword,
  pageSize: 10,
};
