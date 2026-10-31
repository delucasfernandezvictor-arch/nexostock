import { PedidoResumen, Producto, Profile } from '../../../core/models';
import { BriefingData, buildBriefing, eurosVoz, frasesVoz } from './asistente.briefing';
import { elegirVoz } from './voz.service';

const iso = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString();

function pedido(id: number, extra: Partial<PedidoResumen>): PedidoResumen {
  return {
    id, created_at: iso(2026, 10, 30), updated_at: iso(2026, 10, 30), estado: 'pendiente', prioridad: 'normal', notas: null,
    total: 100, usuario_id: 'u1', usuario_email: 'lucia.herrera@example.com', usuario_nombre: 'Lucía Herrera', num_lineas: 1, unidades: 1,
    ...extra,
  };
}

function producto(id: number, nombre: string, stock: number, stock_minimo = 5): Producto {
  return {
    id, sku: `SKU-${id}`, nombre, descripcion: null, categoria_id: 1, precio: 10, stock, stock_minimo, activo: true,
    imagen_path: null, created_at: iso(2026, 1, 1), updated_at: iso(2026, 1, 1),
  };
}

const vacio: BriefingData = { productos: [], pedidos: [], usuarios: [] };

describe('asistente: resumen diario', () => {
  it('dice la fecha de hoy y cambia los recordatorios al cambiar de día', () => {
    const sabado31 = buildBriefing(vacio, new Date(2026, 9, 31, 9), 'Admin', true);
    const domingo1 = buildBriefing(vacio, new Date(2026, 10, 1, 9), 'Admin');

    expect(sabado31.fecha).toBe('Hoy es sábado, 31 de octubre de 2026.');
    expect(sabado31.saludo).toContain('Buenos días, Admin. Soy Nexa');
    expect(sabado31.saludo).toContain('Encantada de conocerte');
    expect(sabado31.items.map((i) => i.titulo)).toEqual(expect.arrayContaining(['Cierre de octubre', 'Fin de semana']));

    expect(domingo1.fecha).toBe('Hoy es domingo, 1 de noviembre de 2026.');
    expect(domingo1.saludo).toContain('Me alegra verte de nuevo');
    const inicio = domingo1.items.find((i) => i.titulo === 'Inicio de noviembre');
    expect(inicio?.texto).toContain('resumen de octubre');
    expect(domingo1.dia).not.toBe(sabado31.dia);
  });

  it('propone primero el pedido más urgente y, a igual prioridad, el más antiguo', () => {
    const b = buildBriefing(
      {
        ...vacio,
        pedidos: [
          pedido(1, { prioridad: 'normal', created_at: iso(2026, 10, 20) }),
          pedido(2, { prioridad: 'urgente', created_at: iso(2026, 10, 30), usuario_nombre: 'Marcos Vidal' }),
          pedido(3, { prioridad: 'urgente', created_at: iso(2026, 10, 28), usuario_nombre: 'Sara Ibáñez' }),
          pedido(4, { estado: 'entregado', prioridad: 'urgente' }),
        ],
      },
      new Date(2026, 9, 31, 11),
      'Admin',
    );
    const urgente = b.items[0]!;
    expect(urgente.titulo).toBe('3 pedidos pendientes de aprobar');
    expect(urgente.texto).toContain('PED-00003 de Sara Ibáñez');
    expect(urgente.texto).toContain('desde hace 3 días');
    expect(urgente.voz).toContain('el pedido 3');
    expect(urgente.accion?.url).toBe('/app/pedidos');
  });

  it('avisa de productos agotados y con poco stock (solo activos)', () => {
    const b = buildBriefing(
      {
        ...vacio,
        productos: [producto(1, 'Webcam 1080p', 0), producto(2, 'Ratón vertical', 3), producto(3, 'Monitor 27"', 40), { ...producto(4, 'Retirado', 0), activo: false }],
      },
      new Date(2026, 9, 31, 9),
      'Admin',
    );
    const stock = b.items.find((i) => i.tipo === 'stock')!;
    expect(stock.texto).toContain('1 producto agotado: Webcam 1080p');
    expect(stock.texto).toContain('Ratón vertical (3 uds.)');
    expect(stock.texto).not.toContain('Retirado');
    expect(stock.voz).toContain('Ratón vertical, con 3 unidades');
  });

  it('calcula las ventas de hoy frente a ayer sin contar cancelados', () => {
    const b = buildBriefing(
      {
        ...vacio,
        pedidos: [
          pedido(1, { estado: 'entregado', total: 300, created_at: iso(2026, 10, 31, 8) }),
          pedido(2, { estado: 'aprobado', total: 300, created_at: iso(2026, 10, 31, 9) }),
          pedido(3, { estado: 'cancelado', total: 999, created_at: iso(2026, 10, 31, 9) }),
          pedido(4, { estado: 'entregado', total: 500, created_at: iso(2026, 10, 30, 12) }),
        ],
      },
      new Date(2026, 9, 31, 18),
      'Admin',
    );
    const ventas = b.items.find((i) => i.tipo === 'ventas')!;
    expect(ventas.texto).toMatch(/^600,00\s€ en 2 pedidos, un 20 % más que ayer\.$/);
    expect(ventas.voz).toContain('600 euros');
    expect(b.saludo).toMatch(/^Buenas tardes/);
  });

  it('lee saludo, fecha, cada punto y despedida en orden', () => {
    const b = buildBriefing(vacio, new Date(2026, 9, 31, 9), 'Admin');
    const frases = frasesVoz(b);
    expect(frases.length).toBe(b.items.length + 3);
    expect(frases[1]).toBe(b.fecha);
    expect(eurosVoz(1234.5)).toBe('1234 euros con 50');
  });
});

describe('asistente: elección de voz', () => {
  it('prefiere una voz femenina, neuronal y de España; descarta voces masculinas', () => {
    const voces = [
      { name: 'Microsoft Pablo - Spanish (Spain)', lang: 'es-ES' },
      { name: 'Microsoft Elvira Online (Natural) - Spanish (Spain)', lang: 'es-ES' },
      { name: 'Microsoft Helena - Spanish (Spain)', lang: 'es-ES' },
      { name: 'Google US English', lang: 'en-US' },
    ];
    expect(elegirVoz(voces)?.name).toContain('Elvira');
    expect(elegirVoz([voces[0]!, voces[2]!])?.name).toContain('Helena');
    expect(elegirVoz([{ name: 'Samantha', lang: 'en-US' }])).toBeNull();
  });
});
