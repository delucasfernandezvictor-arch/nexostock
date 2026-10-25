import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LineaDetalle, NuevoPedido, PedidoEstado, PedidoResumen } from '../models';
import { QueryParams, SqlApiService } from './sql-api.service';

/** Filtros de consulta de pedidos. */
export interface PedidoFiltro {
  /** Solo los pedidos de este usuario */
  usuarioId?: string | null;
  estado?: PedidoEstado | null;
  /** Fecha ISO mínima (inclusive) */
  desde?: string | null;
  /** Fecha ISO máxima (exclusiva) */
  hasta?: string | null;
  limit?: number;
}

/**
 * Pedidos (origen SQL). La creación y los cambios de estado se hacen con
 * funciones RPC transaccionales para garantizar la coherencia del stock.
 */
@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly api = inject(SqlApiService);

  /** Pedidos con sus totales (vista `v_pedidos_resumen`). RLS filtra por usuario. */
  list(filtro: PedidoFiltro = {}): Observable<PedidoResumen[]> {
    return this.api.select<PedidoResumen>('v_pedidos_resumen', {
      select: '*',
      order: 'created_at.desc',
      limit: filtro.limit ?? 1000,
      ...rango(filtro),
    });
  }

  /** Líneas de un pedido concreto. */
  lineas(pedidoId: number): Observable<LineaDetalle[]> {
    return this.api.select<LineaDetalle>('v_lineas_detalle', { select: '*', pedido_id: `eq.${pedidoId}`, order: 'producto.asc' });
  }

  /** Líneas consolidadas para dashboard e informes. */
  lineasDetalle(filtro: PedidoFiltro = {}): Observable<LineaDetalle[]> {
    return this.api.select<LineaDetalle>('v_lineas_detalle', {
      select: '*',
      order: 'fecha.desc',
      limit: filtro.limit ?? 1000,
      ...rango(filtro, 'fecha'),
    });
  }

  /** Crea un pedido de forma transaccional (RPC `crear_pedido`). */
  crear(pedido: NuevoPedido): Observable<{ id: number; total: number }> {
    return this.api.rpc('crear_pedido', {
      p_lineas: pedido.lineas,
      p_notas: pedido.notas ?? null,
      p_prioridad: pedido.prioridad,
    });
  }

  /** Cambia el estado (RPC `cambiar_estado_pedido`; valida permisos en el servidor). */
  cambiarEstado(pedidoId: number, estado: PedidoEstado): Observable<PedidoResumen> {
    return this.api.rpc('cambiar_estado_pedido', { p_pedido_id: pedidoId, p_estado: estado });
  }
}

function rango(f: PedidoFiltro, campoFecha = 'created_at'): QueryParams {
  const p: QueryParams = {};
  if (f.usuarioId) p['usuario_id'] = `eq.${f.usuarioId}`;
  if (f.estado) p['estado'] = `eq.${f.estado}`;
  if (f.desde && f.hasta) p['and'] = `(${campoFecha}.gte.${f.desde},${campoFecha}.lt.${f.hasta})`;
  else if (f.desde) p[campoFecha] = `gte.${f.desde}`;
  else if (f.hasta) p[campoFecha] = `lt.${f.hasta}`;
  return p;
}
