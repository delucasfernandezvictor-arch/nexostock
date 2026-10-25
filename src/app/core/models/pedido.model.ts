/** Estados posibles (enum `public.pedido_estado`). */
export type PedidoEstado = 'pendiente' | 'aprobado' | 'enviado' | 'entregado' | 'cancelado';

/** Prioridad del pedido. */
export type PedidoPrioridad = 'baja' | 'normal' | 'alta' | 'urgente';

/** Lista ordenada de estados, útil para selects y gráficos. */
export const PEDIDO_ESTADOS: readonly PedidoEstado[] = ['pendiente', 'aprobado', 'enviado', 'entregado', 'cancelado'];

/** Lista ordenada de prioridades. */
export const PEDIDO_PRIORIDADES: readonly PedidoPrioridad[] = ['baja', 'normal', 'alta', 'urgente'];

/** Transiciones de estado permitidas al administrador (máquina de estados). */
export const TRANSICIONES: Readonly<Record<PedidoEstado, readonly PedidoEstado[]>> = {
  pendiente: ['aprobado', 'cancelado'],
  aprobado: ['enviado', 'cancelado'],
  enviado: ['entregado'],
  entregado: [],
  cancelado: [],
};

/** Fila de la vista `v_pedidos_resumen`. */
export interface PedidoResumen {
  id: number;
  created_at: string;
  updated_at: string;
  estado: PedidoEstado;
  prioridad: PedidoPrioridad;
  notas: string | null;
  total: number;
  usuario_id: string;
  usuario_email: string;
  usuario_nombre: string | null;
  num_lineas: number;
  unidades: number;
}

/** Línea de pedido con datos de producto (vista `v_lineas_detalle`). */
export interface LineaDetalle {
  linea_id: number;
  pedido_id: number;
  fecha: string;
  estado: PedidoEstado;
  prioridad: PedidoPrioridad;
  usuario_id: string;
  usuario_email: string;
  departamento: string | null;
  producto_id: number;
  sku: string;
  producto: string;
  categoria_id: number;
  categoria: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

/** Línea que se envía a la RPC `crear_pedido`. */
export interface NuevaLinea {
  producto_id: number;
  cantidad: number;
}

/** Datos para crear un pedido. */
export interface NuevoPedido {
  lineas: NuevaLinea[];
  notas?: string | null;
  prioridad: PedidoPrioridad;
}

/**
 * Formatea el identificador visible de un pedido.
 * @example codigoPedido(7) // 'PED-00007'
 */
export function codigoPedido(id: number): string {
  return `PED-${String(id).padStart(5, '0')}`;
}
