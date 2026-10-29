import { UserRole } from '../models';
import { AppConfig } from './app-config';

/** Cuenta de demostración que se ofrece en el acceso rápido del login. */
export interface DemoAccount {
  email: string;
  nombre: string;
  departamento: string;
  role: UserRole;
  /** Color del avatar (contraste AA con texto blanco) */
  color: string;
}

/** Cuenta de demostración con su contraseña ya resuelta. */
export interface DemoCredentials extends DemoAccount {
  password: string;
}

/**
 * Cuentas de demostración con **datos sintéticos** (dominio reservado
 * `example.com`, RFC 2606). Los nombres y emails no son secretos; las
 * contraseñas NO están aquí: se inyectan en el build desde variables de
 * entorno (`DEMO_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`).
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { email: 'admin@example.com', nombre: 'Admin Demo', departamento: 'Dirección', role: 'admin', color: '#2f3fb8' },
  { email: 'usuario@example.com', nombre: 'Usuario Demo', departamento: 'Logística', role: 'user', color: '#0b6e69' },
  { email: 'lucia.herrera@example.com', nombre: 'Lucía Herrera', departamento: 'Compras', role: 'user', color: '#a3195b' },
  { email: 'marcos.vidal@example.com', nombre: 'Marcos Vidal', departamento: 'Ventas', role: 'user', color: '#a64b05' },
  { email: 'sara.ibanez@example.com', nombre: 'Sara Ibáñez', departamento: 'Sistemas', role: 'user', color: '#6d28d9' },
];

/**
 * Devuelve las cuentas demo con su contraseña, o una lista vacía si el build no
 * incluye las contraseñas (en ese caso el panel de acceso rápido no se muestra).
 */
export function demoCredentials(config: Pick<AppConfig, 'demoAdminPassword' | 'demoUserPassword'>): DemoCredentials[] {
  if (!config.demoAdminPassword || !config.demoUserPassword) return [];
  return DEMO_ACCOUNTS.map((a) => ({ ...a, password: a.role === 'admin' ? config.demoAdminPassword : config.demoUserPassword }));
}

/** Iniciales para el avatar: «Lucía Herrera» → «LH». */
export function initials(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
