import { UserRole } from '../models';

/**
 * «Recordar mi cuenta en este dispositivo».
 *
 * Se guarda en `localStorage` el **último email** (para rellenar el login) y una
 * lista corta de **cuentas recordadas** (email, nombre, departamento y rol) que
 * se ofrecen en el acceso rápido. **Nunca** se guarda la contraseña ni el token.
 * Todas las operaciones toleran que el almacenamiento no esté disponible.
 */
const KEY = 'nexostock.recordar-email';
const ACCOUNTS_KEY = 'nexostock.cuentas-recordadas';

/** Máximo de cuentas recordadas por dispositivo (las más recientes primero). */
export const MAX_REMEMBERED = 5;

/** Cuenta recordada en este dispositivo (sin credenciales). */
export interface RememberedAccount {
  email: string;
  nombre: string;
  departamento: string;
  role: UserRole;
}

/** Email recordado, o cadena vacía. */
export function getRememberedEmail(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

/** Guarda el email si `remember` es true; si no, lo olvida. */
export function setRememberedEmail(email: string, remember: boolean): void {
  try {
    if (remember && email.trim()) localStorage.setItem(KEY, email.trim().toLowerCase());
    else localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Cuentas recordadas, de la más reciente a la más antigua. Ignora datos corruptos. */
export function getRememberedAccounts(): RememberedAccount[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((a): a is RememberedAccount => typeof a?.email === 'string' && typeof a?.nombre === 'string')
      .map((a): RememberedAccount => ({ email: a.email, nombre: a.nombre, departamento: String(a.departamento ?? ''), role: a.role === 'admin' ? 'admin' : 'user' }))
      .slice(0, MAX_REMEMBERED);
  } catch {
    return [];
  }
}

/**
 * Recuerda la cuenta (la pone la primera de la lista) si `remember` es true;
 * si no, la olvida. Mantiene también el último email para el formulario.
 */
export function rememberAccount(account: RememberedAccount, remember: boolean): void {
  const email = account.email.trim().toLowerCase();
  setRememberedEmail(email, remember);
  if (!email) return;
  const others = getRememberedAccounts().filter((a) => a.email !== email);
  const next = remember ? [{ ...account, email, nombre: account.nombre.trim() || email.split('@')[0]! }, ...others] : others;
  try {
    if (next.length) localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next.slice(0, MAX_REMEMBERED)));
    else localStorage.removeItem(ACCOUNTS_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}
