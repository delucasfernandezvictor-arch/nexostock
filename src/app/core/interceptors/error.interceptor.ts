import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../models';
import { AuthStore } from '../state/auth.store';

/** Mensajes en castellano para los códigos de PostgreSQL / PostgREST más comunes. */
const CODE_MESSAGES: Record<string, string> = {
  '23505': 'Ya existe un registro con ese valor único',
  '23503': 'El registro está relacionado con otros datos y no puede eliminarse',
  '23514': 'Algún valor no cumple las reglas de validación',
  '42501': 'No tienes permisos para realizar esta operación',
  PGRST116: 'El registro solicitado no existe',
  PGRST301: 'Tu sesión ha caducado. Vuelve a iniciar sesión',
  PGRST303: 'Tu sesión ha caducado. Vuelve a iniciar sesión',
};

/**
 * Convierte cualquier `HttpErrorResponse` en un {@link ApiError} homogéneo.
 * Los errores de negocio lanzados con `RAISE EXCEPTION` (P0001...) conservan
 * su mensaje original, que ya está redactado para el usuario.
 */
export function toApiError(err: HttpErrorResponse): ApiError {
  if (err.status === 0) {
    return { status: 0, message: 'No hay conexión con el servidor. Comprueba tu red e inténtalo de nuevo' };
  }
  const body = (typeof err.error === 'object' && err.error) || {};
  const code: string | undefined = body.code;
  const raw: string | undefined = body.message ?? body.msg;
  const business = code?.startsWith('P0') || code === '22023';
  const message =
    (business && raw) ||
    (code && CODE_MESSAGES[code]) ||
    (err.status === 401 ? 'Tu sesión ha caducado. Vuelve a iniciar sesión' : undefined) ||
    (err.status === 403 ? CODE_MESSAGES['42501'] : undefined) ||
    (err.status >= 500 ? 'El servidor no está disponible en este momento' : undefined) ||
    raw ||
    'Se ha producido un error inesperado';
  return { status: err.status, code, message, detail: body.details ?? body.hint ?? err.message };
}

/**
 * **Interceptor de errores**: normaliza los errores HTTP y, si el JWT ya no es
 * válido (401), cierra la sesión y redirige al login conservando la ruta.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      const apiError = toApiError(err);
      if (err.status === 401 && !req.url.includes('/auth/')) {
        const router = injector.get(Router);
        void injector
          .get(AuthStore)
          .logout()
          .then(() => router.navigate(['/login'], { queryParams: { redirect: router.url, expired: 1 } }));
      }
      return throwError(() => apiError);
    }),
  );
};
