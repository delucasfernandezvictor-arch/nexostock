import { LineaDetalle, PEDIDO_ESTADOS, PedidoEstado, Producto, nivelStock } from '../../../core/models';
import { formatMonth, lastMonths, monthKey } from '../../../core/utils/format';

/** Filtros del cuadro de mando. */
export interface DashboardFiltro {
  /** Meses hacia atrás desde hoy */
  meses: number;
  categoriaId: number | null;
  estado: PedidoEstado | null;
}

/** Indicadores agregados de un periodo. */
export interface Metricas {
  facturacion: number;
  pedidos: number;
  unidades: number;
  ticketMedio: number;
  cancelados: number;
}

/** Inicio del periodo (día 1 del mes, `meses - 1` meses atrás). */
export function inicioPeriodo(meses: number, offsetMeses = 0, now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - (meses - 1) - offsetMeses, 1);
}

/**
 * Filtra las líneas por periodo, categoría y estado.
 * @param offset desplaza el periodo hacia atrás (para comparar con el anterior)
 */
export function filtrarLineas(lineas: readonly LineaDetalle[], f: DashboardFiltro, offset = 0, now = new Date()): LineaDetalle[] {
  const desde = inicioPeriodo(f.meses, offset * f.meses, now).getTime();
  const hasta = offset === 0 ? Number.POSITIVE_INFINITY : inicioPeriodo(f.meses, (offset - 1) * f.meses, now).getTime();
  return lineas.filter((l) => {
    const t = new Date(l.fecha).getTime();
    return t >= desde && t < hasta && (f.categoriaId === null || l.categoria_id === f.categoriaId) && (f.estado === null || l.estado === f.estado);
  });
}

/** Calcula los indicadores de un conjunto de líneas (excluye cancelados de la facturación). */
export function calcularMetricas(lineas: readonly LineaDetalle[]): Metricas {
  const validas = lineas.filter((l) => l.estado !== 'cancelado');
  const facturacion = validas.reduce((a, l) => a + Number(l.subtotal), 0);
  const pedidos = new Set(validas.map((l) => l.pedido_id)).size;
  return {
    facturacion,
    pedidos,
    unidades: validas.reduce((a, l) => a + l.cantidad, 0),
    ticketMedio: pedidos ? facturacion / pedidos : 0,
    cancelados: new Set(lineas.filter((l) => l.estado === 'cancelado').map((l) => l.pedido_id)).size,
  };
}

/** Mínimo de pedidos en el periodo anterior para que la comparación sea representativa. */
export const MIN_PEDIDOS_COMPARACION = 5;

/** Variación porcentual (null si no hay base de comparación). */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((actual - anterior) / anterior) * 100;
}

/** Facturación agrupada por mes para el gráfico de evolución. */
export function serieMensual(lineas: readonly LineaDetalle[], meses: number, now = new Date()): { labels: string[]; data: number[]; keys: string[] } {
  const months = lastMonths(meses, now);
  const keys = months.map((m) => monthKey(m));
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const l of lineas) {
    if (l.estado === 'cancelado') continue;
    const k = monthKey(l.fecha);
    if (totals.has(k)) totals.set(k, totals.get(k)! + Number(l.subtotal));
  }
  return { labels: months.map(formatMonth), data: keys.map((k) => Math.round(totals.get(k)!)), keys };
}

/** Agrupa y suma un campo, devolviendo las `top` claves mayores. */
export function agrupar<K extends string | number>(
  lineas: readonly LineaDetalle[],
  key: (l: LineaDetalle) => K,
  label: (l: LineaDetalle) => string,
  top = Infinity,
): { key: K; label: string; total: number }[] {
  const acc = new Map<K, { key: K; label: string; total: number }>();
  for (const l of lineas) {
    if (l.estado === 'cancelado') continue;
    const k = key(l);
    const cur = acc.get(k) ?? { key: k, label: label(l), total: 0 };
    cur.total += Number(l.subtotal);
    acc.set(k, cur);
  }
  return [...acc.values()].sort((a, b) => b.total - a.total).slice(0, top);
}

/** Número de pedidos distintos por estado. */
export function pedidosPorEstado(lineas: readonly LineaDetalle[]): number[] {
  return PEDIDO_ESTADOS.map((e) => new Set(lineas.filter((l) => l.estado === e).map((l) => l.pedido_id)).size);
}

/** Productos con stock en o por debajo del mínimo, del más crítico al menos. */
export function stockCritico(productos: readonly Producto[]): Producto[] {
  return productos
    .filter((p) => p.activo && nivelStock(p) !== 'ok')
    .sort((a, b) => a.stock / Math.max(a.stock_minimo, 1) - b.stock / Math.max(b.stock_minimo, 1));
}
