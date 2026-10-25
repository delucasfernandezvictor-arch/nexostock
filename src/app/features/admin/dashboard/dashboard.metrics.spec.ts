import { LineaDetalle, Producto } from '../../../core/models';
import { agrupar, calcularMetricas, filtrarLineas, pedidosPorEstado, serieMensual, stockCritico, variacion } from './dashboard.metrics';

const NOW = new Date(2026, 9, 25); // 25/10/2026

function linea(partial: Partial<LineaDetalle>): LineaDetalle {
  return {
    linea_id: 1, pedido_id: 1, fecha: new Date(2026, 9, 10).toISOString(), estado: 'entregado', prioridad: 'normal', usuario_id: 'u',
    usuario_email: 'u@example.com', departamento: null, producto_id: 1, sku: 'INF-0001', producto: 'Portátil', categoria_id: 1,
    categoria: 'Informática', cantidad: 1, precio_unitario: 100, subtotal: 100, ...partial,
  };
}

describe('dashboard.metrics', () => {
  const lineas = [
    linea({ linea_id: 1, pedido_id: 1, subtotal: 100, cantidad: 1 }),
    linea({ linea_id: 2, pedido_id: 1, subtotal: 50, cantidad: 2, categoria_id: 2, categoria: 'Papelería', producto_id: 2, producto: 'Folios' }),
    linea({ linea_id: 3, pedido_id: 2, subtotal: 300, estado: 'cancelado' }),
    linea({ linea_id: 4, pedido_id: 3, subtotal: 80, fecha: new Date(2026, 3, 2).toISOString() }), // abril: fuera de 3 meses
  ];

  it('calcula facturación, pedidos y ticket medio sin cancelados', () => {
    const m = calcularMetricas(lineas);
    expect(m.facturacion).toBe(230);
    expect(m.pedidos).toBe(2);
    expect(m.ticketMedio).toBe(115);
    expect(m.cancelados).toBe(1);
  });

  it('filtra por periodo, categoría y estado', () => {
    expect(filtrarLineas(lineas, { meses: 3, categoriaId: null, estado: null }, 0, NOW)).toHaveLength(3);
    expect(filtrarLineas(lineas, { meses: 3, categoriaId: 2, estado: null }, 0, NOW)).toHaveLength(1);
    expect(filtrarLineas(lineas, { meses: 12, categoriaId: null, estado: 'cancelado' }, 0, NOW)).toHaveLength(1);
  });

  it('el periodo anterior no se solapa con el actual', () => {
    const prev = filtrarLineas(lineas, { meses: 3, categoriaId: null, estado: null }, 1, NOW);
    expect(prev.map((l) => l.linea_id)).toEqual([]);
    // Con 6 meses el periodo actual es may–oct y el anterior nov–abr: incluye la línea de abril
    const prev6 = filtrarLineas(lineas, { meses: 6, categoriaId: null, estado: null }, 1, NOW);
    expect(prev6.map((l) => l.linea_id)).toEqual([4]);
    expect(filtrarLineas(lineas, { meses: 6, categoriaId: null, estado: null }, 0, NOW).map((l) => l.linea_id)).toEqual([1, 2, 3]);
  });

  it('variación porcentual y sin base', () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(10, 0)).toBeNull();
  });

  it('serie mensual con todos los meses aunque no haya datos', () => {
    const s = serieMensual(lineas, 3, NOW);
    expect(s.data).toHaveLength(3);
    expect(s.data[2]).toBe(150); // octubre sin el cancelado
    expect(s.data[0]).toBe(0);
  });

  it('agrupa por categoría ordenado de mayor a menor', () => {
    const g = agrupar(lineas, (l) => l.categoria_id, (l) => l.categoria);
    expect(g[0]).toEqual({ key: 1, label: 'Informática', total: 180 });
  });

  it('cuenta pedidos distintos por estado', () => {
    expect(pedidosPorEstado(lineas)).toEqual([0, 0, 0, 2, 1]);
  });

  it('ordena el stock crítico del más al menos urgente', () => {
    const base = { activo: true, precio: 1 } as Producto;
    const r = stockCritico([
      { ...base, id: 1, stock: 4, stock_minimo: 5 },
      { ...base, id: 2, stock: 0, stock_minimo: 5 },
      { ...base, id: 3, stock: 50, stock_minimo: 5 },
    ]);
    expect(r.map((p) => p.id)).toEqual([2, 1]);
  });
});
