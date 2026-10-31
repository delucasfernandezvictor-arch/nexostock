import { UserRole } from '../models';
import { RememberedAccount } from '../utils/remember';
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

/**
 * Cuenta del **acceso rápido** del login: una cuenta de demostración (con su
 * contraseña) o una cuenta recordada en este dispositivo (sin contraseña).
 */
export interface QuickAccount extends DemoAccount {
  /** Solo las cuentas demo la traen; las recordadas nunca guardan contraseña */
  password?: string;
  /** true si es una cuenta recordada en este dispositivo */
  recordada?: boolean;
}

/** Cuenta de demostración con su contraseña ya resuelta. */
export interface DemoCredentials extends QuickAccount {
  password: string;
}

/** Colores de avatar con contraste AA sobre texto blanco. */
const AVATAR_COLORS = ['#0b6e69', '#a3195b', '#a64b05', '#6d28d9', '#2f3fb8', '#b42318', '#0e7490', '#4d7c0f'] as const;

/** Color estable para un email (el mismo email, siempre el mismo color). */
export function avatarColor(email: string): string {
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
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

/**
 * Convierte las cuentas recordadas en cuentas de acceso rápido, quitando las que
 * ya son cuentas de demostración (para no duplicarlas).
 */
export function rememberedQuickAccounts(remembered: readonly RememberedAccount[]): QuickAccount[] {
  const demo = new Set(DEMO_ACCOUNTS.map((a) => a.email));
  return remembered
    .filter((a) => !demo.has(a.email))
    .map((a) => ({ ...a, departamento: a.departamento || 'Sin departamento', color: avatarColor(a.email), recordada: true }));
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
