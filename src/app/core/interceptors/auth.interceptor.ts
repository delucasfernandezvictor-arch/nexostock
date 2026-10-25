import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { SupabaseClientService } from '../services/supabase-client.service';

/**
 * **Interceptor de autenticación** (funcional).
 *
 * Para cada petición dirigida a Supabase añade:
 *  - `apikey`: clave pública del proyecto (identifica el proyecto, no da permisos).
 *  - `Authorization: Bearer <JWT>`: token del usuario. Se obtiene de forma
 *    **asíncrona** con `auth.getSession()`, que lo refresca si está a punto de
 *    caducar. Sin sesión se envía la clave anónima (rol `anon` en RLS).
 *
 * Las peticiones a otros dominios pasan sin modificar.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(APP_CONFIG);
  const supa = inject(SupabaseClientService);

  if (!supa.configured || !req.url.startsWith(config.supabaseUrl)) {
    return next(req);
  }

  return from(supa.client.auth.getSession()).pipe(
    switchMap(({ data }) => {
      const token = data.session?.access_token ?? config.supabaseAnonKey;
      return next(
        req.clone({
          setHeaders: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
        }),
      );
    }),
  );
};
