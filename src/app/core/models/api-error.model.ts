/** Error normalizado de cualquier origen de datos (REST, Auth, Realtime). */
export interface ApiError {
  /** Código HTTP (0 = sin conexión) */
  status: number;
  /** Código de PostgreSQL / PostgREST si existe (p. ej. 23505, 42501, P0001) */
  code?: string;
  /** Mensaje apto para mostrar al usuario */
  message: string;
  /** Detalle técnico */
  detail?: string;
}

/** Comprueba si un valor desconocido tiene forma de {@link ApiError}. */
export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e && 'message' in e;
}

/** Extrae un mensaje legible de cualquier error. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return 'Se ha producido un error inesperado';
}
