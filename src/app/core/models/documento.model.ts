/**
 * Documento de la colección NoSQL (`public.documentos`).
 * El campo `data` es JSONB sin esquema fijo: cada colección define su forma.
 */
export interface Documento<T = Record<string, unknown>> {
  id: string;
  coleccion: string;
  data: T;
  autor_id: string | null;
  created_at: string;
}

/** Forma de los documentos de la colección `actividad`. */
export interface Actividad {
  tipo: string;
  mensaje: string;
  pedido_id?: number;
  producto_id?: number;
  total?: number;
  [clave: string]: unknown;
}

/** Nivel visual de un aviso. */
export type NivelAviso = 'info' | 'exito' | 'alerta';

/** Forma de los documentos de la colección `avisos`. */
export interface Aviso {
  titulo: string;
  texto: string;
  nivel: NivelAviso;
  etiquetas?: string[];
  [clave: string]: unknown;
}

/** Usuario conectado (Supabase Realtime Presence). */
export interface PresenciaUsuario {
  user_id: string;
  nombre: string;
  role: string;
  online_at: string;
}
