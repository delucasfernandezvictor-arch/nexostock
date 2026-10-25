import { runtimeEnv } from './runtime-env';

/** Configuración de entorno (producción). Ver `environment.ts`. */
export const environment = {
  production: true,
  supabaseUrl: runtimeEnv.supabaseUrl,
  supabaseAnonKey: runtimeEnv.supabaseAnonKey,
  pageSize: 10,
};
