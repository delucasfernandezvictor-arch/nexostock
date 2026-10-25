import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map, retry, throwError, timer } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { ApiError } from '../models';

/** Parámetros de consulta PostgREST (`select`, `order`, filtros `col=eq.valor`...). */
export type QueryParams = Record<string, string | number | boolean>;

/** Resultado paginado con el total de filas (cabecera `Content-Range`). */
export interface Page<T> {
  data: T[];
  total: number;
}

/** Opciones comunes de petición. */
export interface RequestOptions {
  context?: HttpContext;
}

/**
 * Cliente de la **API REST relacional (SQL)** expuesta por PostgREST en
 * `/rest/v1`. Todas las operaciones devuelven `Observable` (RxJS), lo que
 * permite combinarlas con `forkJoin`, `switchMap`, cancelarlas, etc.
 *
 * La cabecera `apikey` y el JWT del usuario (`Authorization: Bearer`) los añade
 * `authInterceptor`; los errores los normaliza `errorInterceptor`.
 *
 * @example
 * api.select<Producto>('productos', { select: '*', order: 'nombre.asc', activo: 'eq.true' })
 */
@Injectable({ providedIn: 'root' })
export class SqlApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(APP_CONFIG).supabaseUrl}/rest/v1`;

  /**
   * SELECT sobre una tabla o vista.
   * Reintenta hasta 2 veces con *backoff* exponencial ante fallos de red o 5xx.
   */
  select<T>(resource: string, params: QueryParams = {}, options: RequestOptions = {}): Observable<T[]> {
    return this.http
      .get<T[]>(this.url(resource), { params: this.params(params), context: options.context })
      .pipe(retry({ count: 2, delay: retryDelay }));
  }

  /** SELECT con recuento total de filas (para paginación en servidor). */
  selectPage<T>(resource: string, params: QueryParams = {}, options: RequestOptions = {}): Observable<Page<T>> {
    return this.http
      .get<T[]>(this.url(resource), {
        params: this.params(params),
        headers: new HttpHeaders({ Prefer: 'count=exact' }),
        observe: 'response',
        context: options.context,
      })
      .pipe(
        retry({ count: 2, delay: retryDelay }),
        map((res: HttpResponse<T[]>) => ({ data: res.body ?? [], total: totalFromRange(res.headers.get('Content-Range')) })),
      );
  }

  /** SELECT de una única fila (falla con 406 si no existe). */
  selectOne<T>(resource: string, params: QueryParams = {}): Observable<T> {
    return this.http
      .get<T>(this.url(resource), {
        params: this.params(params),
        headers: new HttpHeaders({ Accept: 'application/vnd.pgrst.object+json' }),
      })
      .pipe(retry({ count: 2, delay: retryDelay }));
  }

  /** INSERT; devuelve la fila creada. */
  insert<T>(resource: string, body: Partial<T>): Observable<T> {
    return this.http
      .post<T[]>(this.url(resource), body, { headers: new HttpHeaders({ Prefer: 'return=representation' }) })
      .pipe(map((rows) => rows[0]));
  }

  /**
   * UPDATE de las filas que cumplan el filtro; devuelve las filas modificadas.
   * Si RLS bloquea la operación PostgREST no da error, sino 0 filas: se detecta
   * y se convierte en un error 403.
   */
  update<T>(resource: string, filter: QueryParams, body: Partial<T>): Observable<T[]> {
    return this.http
      .patch<T[]>(this.url(resource), body, {
        params: this.params(filter),
        headers: new HttpHeaders({ Prefer: 'return=representation' }),
      })
      .pipe(map((rows) => ensureRows(rows)));
  }

  /** DELETE de las filas que cumplan el filtro. */
  remove<T>(resource: string, filter: QueryParams): Observable<T[]> {
    return this.http
      .delete<T[]>(this.url(resource), {
        params: this.params(filter),
        headers: new HttpHeaders({ Prefer: 'return=representation' }),
      })
      .pipe(map((rows) => ensureRows(rows)));
  }

  /** Llama a una función de PostgreSQL expuesta como RPC (`/rest/v1/rpc/fn`). */
  rpc<T>(fn: string, args: object = {}, options: RequestOptions = {}): Observable<T> {
    return this.http.post<T>(this.url(`rpc/${fn}`), args, { context: options.context });
  }

  private url(resource: string): string {
    return `${this.baseUrl}/${resource}`;
  }

  private params(params: QueryParams): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) p = p.set(k, String(v));
    return p;
  }
}

/** Retardo de reintento: solo se reintenta ante errores transitorios. */
function retryDelay(error: ApiError | { status?: number }, attempt: number): Observable<number> {
  const status = error?.status ?? 0;
  if (status === 0 || status >= 500) return timer(300 * 2 ** attempt);
  return throwError(() => error);
}

/** Extrae el total de `Content-Range: 0-9/123`. */
export function totalFromRange(range: string | null): number {
  const total = range?.split('/')[1];
  return total && total !== '*' ? Number(total) : 0;
}

function ensureRows<T>(rows: T[]): T[] {
  if (!rows?.length) {
    const err: ApiError = { status: 403, code: '42501', message: 'No tienes permisos para esta operación o el registro no existe' };
    throw err;
  }
  return rows;
}
