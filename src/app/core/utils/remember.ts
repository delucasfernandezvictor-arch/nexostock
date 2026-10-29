/**
 * «Recordar mi email en este dispositivo».
 *
 * Solo se guarda el **email** (nunca la contraseña) en `localStorage`. Todas las
 * operaciones toleran que el almacenamiento no esté disponible (modo privado).
 */
const KEY = 'nexostock.recordar-email';

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
