import { PedidoPrioridad, PedidoResumen, Producto, Profile, codigoPedido, nivelStock } from '../../../core/models';

/** Datos que necesita el asistente para preparar el resumen del día. */
export interface BriefingData {
  productos: readonly Producto[];
  pedidos: readonly PedidoResumen[];
  usuarios: readonly Profile[];
}

/** Tipo de aviso (decide icono y color). */
export type BriefingTipo = 'urgente' | 'stock' | 'ventas' | 'recordatorio' | 'equipo';

/** Un punto del resumen: lo que se lee en pantalla y lo que se dice en voz alta. */
export interface BriefingItem {
  tipo: BriefingTipo;
  titulo: string;
  texto: string;
  /** Versión para la voz (sin símbolos ni códigos difíciles de pronunciar) */
  voz: string;
  accion?: { label: string; url: string };
}

/** Resumen completo del día. */
export interface Briefing {
  /** Clave del día (AAAA-MM-DD): cambia cada día y renueva el resumen */
  dia: string;
  saludo: string;
  fecha: string;
  items: BriefingItem[];
  despedida: string;
}

/** Nombre de la asistente. */
export const ASISTENTE_NOMBRE = 'Nexa';

/** Días que un pedido aprobado puede esperar antes de avisar de que no se ha enviado. */
export const DIAS_ENVIO = 2;

const PRIORIDAD_RANGO: Record<PedidoPrioridad, number> = { urgente: 0, alta: 1, normal: 2, baja: 3 };
const DIA_MS = 86_400_000;

const fechaLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const mesNombre = new Intl.DateTimeFormat('es-ES', { month: 'long' });
const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** Clave local del día (no UTC): «2026-10-31». */
export function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Importe en palabras para la voz: 1234.5 → «1234 euros con 50». */
export function eurosVoz(n: number): string {
  const total = Math.round(n * 100);
  const e = Math.trunc(total / 100);
  const c = total % 100;
  return c ? `${e} euros con ${c}` : `${e} euros`;
}

/** «1 pedido» / «3 pedidos». */
function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Une una lista en castellano: «A, B y C». */
function lista(nombres: string[]): string {
  return nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

/** Días completos transcurridos desde una fecha ISO. */
function diasDesde(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DIA_MS));
}

function hace(dias: number): string {
  return dias === 0 ? 'desde hoy' : dias === 1 ? 'desde ayer' : `desde hace ${dias} días`;
}

/** Saludo según la hora local. */
function saludoHora(now: Date): string {
  const h = now.getHours();
  return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

/** Consejos de uso: cambia uno cada día. */
const CONSEJOS: readonly string[] = [
  'En Informes puedes exportar los pedidos en PDF o CSV con un clic.',
  'El cuadro de mando muestra el top 10 de productos: pulsa uno para editarlo.',
  'Desde Usuarios y roles puedes dar permisos de administrador a otra persona.',
  'Publica un aviso y todo el equipo lo verá al momento, en tiempo real.',
  'Revisa el stock mínimo de los productos que más se piden para no quedarte sin existencias.',
  'En el catálogo, la vista de tabla te deja ordenar por stock para ver primero lo que falta.',
  'Activa el modo oscuro desde el menú si trabajas muchas horas delante de la pantalla.',
];

/**
 * Recordatorios que dependen del **calendario**: así el resumen cambia de un
 * día para otro aunque los datos sean los mismos.
 */
function recordatoriosCalendario(now: Date): BriefingItem[] {
  const items: BriefingItem[] = [];
  const dia = now.getDate();
  const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const mes = mesNombre.format(now);
  const mesAnterior = mesNombre.format(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const semana = now.getDay(); // 0 domingo … 6 sábado

  if (dia === 1) {
    const t = `Empieza ${mes}. Exporta desde Informes el resumen de ${mesAnterior} y revisa qué productos se movieron más.`;
    items.push({ tipo: 'recordatorio', titulo: `Inicio de ${mes}`, texto: t, voz: t, accion: { label: 'Ir a Informes', url: '/app/informes' } });
  } else if (dia === ultimoDia) {
    const t = `Hoy cierra ${mes}. Deja resueltos los pedidos pendientes y prepara el informe mensual antes de terminar la jornada.`;
    items.push({ tipo: 'recordatorio', titulo: `Cierre de ${mes}`, texto: t, voz: t, accion: { label: 'Ir a Informes', url: '/app/informes' } });
  }

  if (semana === 1) {
    const t = 'Es lunes: buen momento para revisar el inventario de la semana y publicar los avisos para el equipo.';
    items.push({ tipo: 'recordatorio', titulo: 'Planificación semanal', texto: t, voz: t, accion: { label: 'Publicar aviso', url: '/app/avisos' } });
  } else if (semana === 5) {
    const t = 'Es viernes: aprueba los pedidos urgentes antes del fin de semana para que salgan a tiempo.';
    items.push({ tipo: 'recordatorio', titulo: 'Antes del fin de semana', texto: t, voz: t });
  } else if (semana === 0 || semana === 6) {
    const t = 'Es fin de semana: los pedidos que lleguen hoy se tramitarán el lunes. ¡Descansa!';
    items.push({ tipo: 'recordatorio', titulo: 'Fin de semana', texto: t, voz: t });
  }

  const inicioAnio = new Date(now.getFullYear(), 0, 0).getTime();
  const consejo = CONSEJOS[Math.floor((now.getTime() - inicioAnio) / DIA_MS) % CONSEJOS.length]!;
  items.push({ tipo: 'recordatorio', titulo: 'Consejo del día', texto: consejo, voz: `Un consejo: ${consejo}` });
  return items;
}

/**
 * Prepara el **resumen diario** del administrador a partir de los datos reales.
 *
 * Es una función pura (no consulta nada ni lee el reloj): recibe los datos y la
 * fecha, así que se puede probar con cualquier día.
 *
 * @param data productos, pedidos y usuarios (ya filtrados por RLS)
 * @param now fecha y hora de referencia
 * @param nombre nombre con el que saludar
 * @param primeraVez true la primera vez que se habla con la asistente
 */
export function buildBriefing(data: BriefingData, now: Date, nombre: string, primeraVez = false): Briefing {
  const hoy = claveDia(now);
  const ayer = claveDia(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const items: BriefingItem[] = [];

  // 1. Pedidos pendientes: primero los más urgentes y, a igual prioridad, los más antiguos
  const pendientes = data.pedidos
    .filter((p) => p.estado === 'pendiente')
    .sort((a, b) => PRIORIDAD_RANGO[a.prioridad] - PRIORIDAD_RANGO[b.prioridad] || a.created_at.localeCompare(b.created_at));
  if (pendientes.length) {
    const top = pendientes[0]!;
    const quien = top.usuario_nombre || top.usuario_email;
    const urgentes = pendientes.filter((p) => p.prioridad === 'urgente' || p.prioridad === 'alta').length;
    const extra = urgentes > 1 ? ` Hay ${urgentes} con prioridad alta o urgente.` : '';
    items.push({
      tipo: 'urgente',
      titulo: `${plural(pendientes.length, 'pedido pendiente', 'pedidos pendientes')} de aprobar`,
      texto: `El primero que deberías revisar es ${codigoPedido(top.id)} de ${quien}: prioridad ${top.prioridad}, ${euros.format(top.total)}, ${hace(diasDesde(top.created_at, now))}.${extra}`,
      voz: `Tienes ${plural(pendientes.length, 'pedido pendiente', 'pedidos pendientes')} de aprobar. El primero que deberías revisar es el pedido ${top.id} de ${quien}, con prioridad ${top.prioridad}, ${hace(diasDesde(top.created_at, now))}.${extra}`,
      accion: { label: 'Revisar pedidos', url: '/app/pedidos' },
    });
  }

  // 2. Pedidos aprobados que llevan días sin enviarse
  const sinEnviar = data.pedidos.filter((p) => p.estado === 'aprobado' && diasDesde(p.updated_at, now) >= DIAS_ENVIO);
  if (sinEnviar.length) {
    const t = `${plural(sinEnviar.length, 'pedido aprobado lleva', 'pedidos aprobados llevan')} más de ${DIAS_ENVIO} días sin enviarse.`;
    items.push({ tipo: 'urgente', titulo: 'Envíos atrasados', texto: t, voz: t, accion: { label: 'Ver pedidos', url: '/app/pedidos' } });
  }

  // 3. Stock: agotados y por debajo del mínimo (solo productos activos)
  const activos = data.productos.filter((p) => p.activo);
  const agotados = activos.filter((p) => nivelStock(p) === 'agotado');
  const bajos = activos.filter((p) => nivelStock(p) === 'bajo').sort((a, b) => a.stock - b.stock);
  if (agotados.length || bajos.length) {
    const partes: string[] = [];
    if (agotados.length) partes.push(`${plural(agotados.length, 'producto agotado', 'productos agotados')}: ${lista(agotados.slice(0, 3).map((p) => p.nombre))}`);
    if (bajos.length) {
      const nombres = bajos.slice(0, 3).map((p) => `${p.nombre} (${p.stock} uds.)`);
      partes.push(`${plural(bajos.length, 'producto', 'productos')} con poco stock: ${lista(nombres)}${bajos.length > 3 ? '…' : ''}`);
    }
    const vozBajos = bajos.slice(0, 3).map((p) => `${p.nombre}, con ${plural(p.stock, 'unidad', 'unidades')}`);
    items.push({
      tipo: 'stock',
      titulo: 'Stock en el almacén',
      texto: `${partes.join('. ')}.`,
      voz: [
        agotados.length ? `En el almacén hay ${plural(agotados.length, 'producto agotado', 'productos agotados')}: ${lista(agotados.slice(0, 3).map((p) => p.nombre))}.` : '',
        bajos.length ? `${agotados.length ? 'Y quedan' : 'En el almacén quedan'} pocas unidades de ${lista(vozBajos)}.` : '',
      ].filter(Boolean).join(' '),
      accion: { label: 'Ver catálogo', url: '/app/catalogo' },
    });
  } else {
    const t = 'Todo el stock está por encima del mínimo. ¡Buen trabajo!';
    items.push({ tipo: 'stock', titulo: 'Stock en el almacén', texto: t, voz: t });
  }

  // 4. Ventas de hoy comparadas con ayer (pedidos no cancelados)
  const validos = data.pedidos.filter((p) => p.estado !== 'cancelado');
  const deHoy = validos.filter((p) => claveDia(new Date(p.created_at)) === hoy);
  const deAyer = validos.filter((p) => claveDia(new Date(p.created_at)) === ayer);
  const totalHoy = deHoy.reduce((s, p) => s + p.total, 0);
  const totalAyer = deAyer.reduce((s, p) => s + p.total, 0);
  let comparacion = '';
  if (totalHoy > 0 && totalAyer > 0) {
    const pct = Math.round(((totalHoy - totalAyer) / totalAyer) * 100);
    comparacion = pct === 0 ? ', lo mismo que ayer' : `, un ${Math.abs(pct)} % ${pct > 0 ? 'más' : 'menos'} que ayer`;
  }
  items.push(
    totalHoy > 0
      ? {
          tipo: 'ventas',
          titulo: 'Ventas de hoy',
          texto: `${euros.format(totalHoy)} en ${plural(deHoy.length, 'pedido')}${comparacion}.`,
          voz: `Hoy llevas ${eurosVoz(totalHoy)} en ventas, en ${plural(deHoy.length, 'pedido')}${comparacion}.`,
          accion: { label: 'Cuadro de mando', url: '/app/dashboard' },
        }
      : {
          tipo: 'ventas',
          titulo: 'Ventas de hoy',
          texto: `Todavía no hay pedidos hoy.${totalAyer > 0 ? ` Ayer se vendieron ${euros.format(totalAyer)} en ${plural(deAyer.length, 'pedido')}.` : ''}`,
          voz: `Todavía no hay ventas hoy.${totalAyer > 0 ? ` Ayer se vendieron ${eurosVoz(totalAyer)}.` : ''}`,
          accion: { label: 'Cuadro de mando', url: '/app/dashboard' },
        },
  );

  // 5. Equipo: altas recientes
  const nuevos = data.usuarios.filter((u) => diasDesde(u.created_at, now) < 7);
  if (nuevos.length) {
    const t = `${plural(nuevos.length, 'persona nueva se ha', 'personas nuevas se han')} registrado esta semana: ${lista(nuevos.slice(0, 3).map((u) => u.nombre || u.email))}. Revisa si necesitan otro rol.`;
    items.push({ tipo: 'equipo', titulo: 'Equipo', texto: t, voz: t, accion: { label: 'Usuarios y roles', url: '/app/usuarios' } });
  }

  // 6. Recordatorios de calendario y consejo del día
  items.push(...recordatoriosCalendario(now));

  const fecha = fechaLarga.format(now);
  return {
    dia: hoy,
    saludo: `${saludoHora(now)}, ${nombre}. Soy ${ASISTENTE_NOMBRE}, la asistente de NexoStock. ${primeraVez ? 'Encantada de conocerte.' : 'Me alegra verte de nuevo.'} Te cuento lo que tienes para hoy.`,
    fecha: `Hoy es ${fecha}.`,
    items,
    despedida: pendientes.length ? 'Eso es todo. Te recomiendo empezar por los pedidos pendientes. ¡Que tengas un buen día!' : 'Eso es todo por hoy. ¡Que tengas un buen día!',
  };
}

/** Frases que se leen en voz alta, en orden (saludo, fecha, cada punto y despedida). */
export function frasesVoz(b: Briefing): string[] {
  return [b.saludo, b.fecha, ...b.items.map((i) => i.voz), b.despedida];
}
