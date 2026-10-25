import { Injectable, inject, signal } from '@angular/core';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Observable, share } from 'rxjs';
import { ApiError, Documento, PresenciaUsuario } from '../models';
import { SupabaseClientService } from './supabase-client.service';

/** Estado de la conexión WebSocket con Supabase Realtime. */
export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'error';

/** Identificador único para canales (varias suscripciones simultáneas). */
function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/**
 * **Servicio documental en tiempo real (NoSQL)**.
 *
 * Trata la tabla `documentos` como un almacén de documentos JSON agrupados en
 * colecciones (al estilo de Firestore) y expone cada colección como un
 * `Observable` que emite la lista actualizada cada vez que otro cliente inserta,
 * modifica o borra un documento (Supabase Realtime sobre WebSocket).
 *
 * Al cancelar la suscripción (`unsubscribe`, `takeUntilDestroyed`, `async`
 * pipe...) se elimina el canal, evitando fugas de memoria y de conexiones.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeDocsService {
  private readonly supa = inject(SupabaseClientService);

  /** Estado de la última conexión establecida (para el indicador "En vivo"). */
  readonly status = signal<RealtimeStatus>('idle');

  /** Usuarios conectados en este momento (lo alimenta el shell con `presence$`). */
  readonly online = signal<PresenciaUsuario[]>([]);

  /**
   * Suscribe a una colección: primero emite los últimos `limit` documentos y
   * después cada cambio en vivo.
   * @param coleccion nombre de la colección (`actividad`, `avisos`...)
   * @param limit número máximo de documentos que se mantienen en memoria
   */
  collection$<T>(coleccion: string, limit = 30): Observable<Documento<T>[]> {
    return new Observable<Documento<T>[]>((subscriber) => {
      const client = this.supa.client;
      let docs: Documento<T>[] = [];
      let closed = false;
      const emit = () => subscriber.next(docs);
      const upsert = (doc: Documento<T>) => {
        docs = [doc, ...docs.filter((d) => d.id !== doc.id)]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit);
        emit();
      };

      this.status.set('connecting');
      const channel: RealtimeChannel = client
        .channel(`docs:${coleccion}:${uid()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documentos', filter: `coleccion=eq.${coleccion}` }, (p) =>
          upsert(p.new as Documento<T>),
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documentos', filter: `coleccion=eq.${coleccion}` }, (p) =>
          upsert(p.new as Documento<T>),
        )
        // Los DELETE no admiten filtro en Realtime: se comprueba el id localmente
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'documentos' }, (p) => {
          const id = (p.old as Partial<Documento>).id;
          if (id && docs.some((d) => d.id === id)) {
            docs = docs.filter((d) => d.id !== id);
            emit();
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') this.status.set('live');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.status.set('error');
        });

      client
        .from('documentos')
        .select('*')
        .eq('coleccion', coleccion)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (closed) return;
          if (error) {
            subscriber.error({ status: 500, code: error.code, message: error.message } satisfies ApiError);
            return;
          }
          // Fusiona con lo que haya llegado en vivo mientras se cargaba
          const live = docs;
          docs = [...live, ...((data ?? []) as Documento<T>[]).filter((d) => !live.some((l) => l.id === d.id))].slice(0, limit);
          emit();
        });

      return () => {
        closed = true;
        void client.removeChannel(channel);
      };
    }).pipe(share());
  }

  /**
   * Flujo de cambios de una tabla relacional (INSERT/UPDATE/DELETE).
   * Se usa para refrescar listados cuando otro usuario modifica datos.
   */
  tableChanges$(table: string, filter?: string): Observable<RealtimePostgresChangesPayload<Record<string, unknown>>> {
    return new Observable((subscriber) => {
      const client = this.supa.client;
      const channel = client
        .channel(`table:${table}:${uid()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) =>
          subscriber.next(payload),
        )
        .subscribe();
      return () => void client.removeChannel(channel);
    });
  }

  /**
   * Usuarios conectados ahora mismo (Realtime **Presence**, estado efímero
   * compartido entre clientes sin persistencia en base de datos).
   */
  presence$(me: PresenciaUsuario): Observable<PresenciaUsuario[]> {
    return new Observable<PresenciaUsuario[]>((subscriber) => {
      const client = this.supa.client;
      const channel = client.channel('presence:nexostock', { config: { presence: { key: me.user_id } } });
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<PresenciaUsuario>();
          const users = Object.values(state)
            .map((metas) => metas[0])
            .filter((u): u is NonNullable<typeof u> => !!u)
            .map(({ user_id, nombre, role, online_at }) => ({ user_id, nombre, role, online_at }));
          subscriber.next(users);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await channel.track(me);
        });
      return () => {
        void channel.untrack();
        void client.removeChannel(channel);
      };
    });
  }

  /** Inserta un documento en una colección. */
  async add<T extends object>(coleccion: string, data: T): Promise<Documento<T>> {
    const { data: row, error } = await this.supa.client.from('documentos').insert({ coleccion, data }).select().single();
    if (error) throw { status: 400, code: error.code, message: traducir(error.code, error.message) } satisfies ApiError;
    return row as Documento<T>;
  }

  /** Elimina un documento. */
  async remove(id: string): Promise<void> {
    const { error, count } = await this.supa.client.from('documentos').delete({ count: 'exact' }).eq('id', id);
    if (error) throw { status: 400, code: error.code, message: traducir(error.code, error.message) } satisfies ApiError;
    if (!count) throw { status: 403, code: '42501', message: 'No tienes permisos para eliminar este documento' } satisfies ApiError;
  }
}

function traducir(code: string | undefined, fallback: string): string {
  return code === '42501' ? 'No tienes permisos para realizar esta operación' : fallback;
}
