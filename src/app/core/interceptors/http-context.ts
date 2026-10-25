import { HttpContextToken } from '@angular/common/http';

/**
 * Marca una petición para que NO muestre la barra de carga global
 * (p. ej. validaciones asíncronas mientras el usuario escribe).
 */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

/** Marca una petición para que el interceptor de errores no notifique al usuario. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);
