import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonCol, IonContent, IonGrid, IonIcon, IonLabel, IonRow, IonSegment, IonSegmentButton, IonSelect, IonSelectOption } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cashOutline, closeCircleOutline, documentOutline, downloadOutline, filterOutline, peopleOutline, pricetagOutline, radioOutline,
  receiptOutline, refreshOutline, warningOutline,
} from 'ionicons/icons';
import { catchError, debounceTime, forkJoin, of, retry, timer } from 'rxjs';
import { Actividad, Categoria, LineaDetalle, PEDIDO_ESTADOS, PedidoEstado, Producto, TableColumn } from '../../../core/models';
import { ExportService } from '../../../core/services/export.service';
import { NotifyService } from '../../../core/services/notify.service';
import { PedidosService } from '../../../core/services/pedidos.service';
import { ProductosService } from '../../../core/services/productos.service';
import { RealtimeDocsService } from '../../../core/services/realtime-docs.service';
import { AuthStore } from '../../../core/state/auth.store';
import { capitalize, formatCurrency, formatDate, formatNumber } from '../../../core/utils/format';
import { errorOf, valueOr } from '../../../core/utils/resource';
import { ActivityFeedComponent, FeedItem } from '../../../shared/components/activity-feed/activity-feed.component';
import { ChartCardComponent, ChartSelection } from '../../../shared/components/chart-card/chart-card.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import {
  DashboardFiltro, MIN_PEDIDOS_COMPARACION, agrupar, calcularMetricas, filtrarLineas, inicioPeriodo, pedidosPorEstado, serieMensual, stockCritico, variacion,
} from './dashboard.metrics';
import { Documento } from '../../../core/models';

/**
 * **Cuadro de mando** (solo administrador).
 *
 * - **Orquestación asíncrona**: carga en paralelo líneas de pedido, productos y
 *   categorías con `forkJoin` (una sola espera, peticiones concurrentes).
 * - **Filtros en tiempo real**: periodo, categoría y estado se aplican en
 *   memoria con señales `computed`, sin volver a consultar al servidor.
 * - **Interactividad**: pulsar un sector/barra filtra el resto del panel
 *   (*drill-down*); las tarjetas KPI de estado también actúan como filtro.
 * - **Tiempo real**: se recarga al cambiar cualquier pedido y muestra el feed
 *   de actividad (NoSQL) y los usuarios conectados (Presence).
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, IonContent, IonGrid, IonRow, IonCol, IonSegment, IonSegmentButton, IonLabel, IonSelect, IonSelectOption, IonButton, IonIcon,
    PageHeaderComponent, KpiCardComponent, ChartCardComponent, ActivityFeedComponent, DataTableComponent, EmptyStateComponent,
  ],
})
export class DashboardPage {
  private readonly pedidosSvc = inject(PedidosService);
  private readonly productosSvc = inject(ProductosService);
  private readonly exportSvc = inject(ExportService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  protected readonly realtime = inject(RealtimeDocsService);

  // --- Filtros (two-way binding con ngModel / segment)
  protected readonly meses = signal(12);
  protected readonly categoriaId = signal<number | null>(null);
  protected readonly estado = signal<PedidoEstado | null>(null);
  protected readonly estados = PEDIDO_ESTADOS;
  protected readonly capitalize = capitalize;

  private readonly filtro = computed<DashboardFiltro>(() => ({ meses: this.meses(), categoriaId: this.categoriaId(), estado: this.estado() }));

  /** Carga concurrente de los orígenes SQL (24 meses para comparar con el periodo anterior). */
  protected readonly data = rxResource({
    stream: () =>
      forkJoin({
        lineas: this.pedidosSvc.lineasDetalle({ desde: inicioPeriodo(24).toISOString(), limit: 5000 }),
        productos: this.productosSvc.list(false),
        categorias: this.productosSvc.categorias(),
      }),
  });
  private readonly value = valueOr(this.data, { lineas: [] as LineaDetalle[], productos: [] as Producto[], categorias: [] as Categoria[] });
  protected readonly error = errorOf(this.data);
  protected readonly categorias = computed(() => this.value().categorias);
  protected readonly loading = computed(() => this.data.isLoading() && !this.data.hasValue());

  /** Feed de actividad en tiempo real (colección NoSQL "actividad"). */
  protected readonly actividad = toSignal(
    this.realtime.collection$<FeedItem>('actividad', 15).pipe(catchError(() => of([] as Documento<FeedItem>[]))),
    { initialValue: null },
  );

  // --- Datos derivados (se recalculan solo cuando cambia su dependencia)
  private readonly actuales = computed(() => filtrarLineas(this.value().lineas, this.filtro()));
  private readonly anteriores = computed(() => filtrarLineas(this.value().lineas, this.filtro(), 1));
  /** Mismas líneas sin filtro de estado (para el gráfico por estado). */
  private readonly sinEstado = computed(() => filtrarLineas(this.value().lineas, { ...this.filtro(), estado: null }));

  protected readonly kpi = computed(() => {
    const a = calcularMetricas(this.actuales());
    const b = calcularMetricas(this.anteriores());
    // Sin histórico suficiente en el periodo anterior no se muestra tendencia
    const comparable = b.pedidos >= MIN_PEDIDOS_COMPARACION;
    return {
      ...a,
      comparable,
      trendFacturacion: comparable ? variacion(a.facturacion, b.facturacion) : null,
      trendPedidos: comparable ? variacion(a.pedidos, b.pedidos) : null,
      trendTicket: comparable ? variacion(a.ticketMedio, b.ticketMedio) : null,
      trendCancelados: comparable ? variacion(a.cancelados, b.cancelados) : null,
    };
  });

  protected readonly mensual = computed(() => serieMensual(this.actuales(), this.meses()));

  protected readonly porCategoria = computed(() => {
    const grupos = agrupar(this.sinCategoria(), (l) => l.categoria_id, (l) => l.categoria);
    const colores = new Map(this.categorias().map((c) => [c.id, c.color]));
    return { ids: grupos.map((g) => g.key), labels: grupos.map((g) => g.label), data: grupos.map((g) => Math.round(g.total)), colors: grupos.map((g) => colores.get(g.key) ?? '#2f3fb8') };
  });
  /** El donut de categorías ignora el filtro de categoría (para poder cambiarlo desde él). */
  private readonly sinCategoria = computed(() => filtrarLineas(this.value().lineas, { ...this.filtro(), categoriaId: null }));

  /** Top de productos para el treemap: área = facturación, color = categoría del producto. */
  protected readonly topProductos = computed(() => {
    const g = agrupar(this.actuales(), (l) => l.producto_id, (l) => l.producto, 10);
    const colores = new Map(this.categorias().map((c) => [c.id, c.color]));
    const categoriaDe = new Map(this.value().lineas.map((l) => [l.producto_id, l.categoria_id]));
    return {
      ids: g.map((x) => x.key),
      labels: g.map((x) => x.label),
      data: g.map((x) => Math.round(x.total)),
      colors: g.map((x) => colores.get(categoriaDe.get(x.key) ?? -1) ?? '#2f3fb8'),
    };
  });

  /** Colores semánticos por estado (los mismos tonos que las etiquetas de estado). */
  private readonly coloresEstado: Record<PedidoEstado, string> = {
    pendiente: '#d97706',
    aprobado: '#2563eb',
    enviado: '#7c3aed',
    entregado: '#16a34a',
    cancelado: '#64748b',
  };

  protected readonly porEstado = computed(() => ({
    labels: this.estados.map(capitalize),
    data: pedidosPorEstado(this.sinEstado()),
    colors: this.estados.map((e) => this.coloresEstado[e]),
  }));

  protected readonly criticos = computed(() =>
    stockCritico(this.value().productos).map((p) => ({ ...p, categoria_nombre: p.categoria?.nombre ?? '', nivel: p.stock <= 0 ? 'agotado' : 'bajo' })),
  );
  protected readonly criticosCols: TableColumn<Producto & { categoria_nombre: string; nivel: string }>[] = [
    { key: 'sku', label: 'SKU' },
    { key: 'nombre', label: 'Producto' },
    { key: 'stock', label: 'Stock', type: 'number' },
    { key: 'stock_minimo', label: 'Mínimo', type: 'number', hideOnMobile: true },
    { key: 'nivel', label: 'Estado', type: 'badge', searchable: false },
  ];

  /** Descripción legible de los filtros activos. */
  protected readonly filtroTexto = computed(() => {
    const partes = [`Últimos ${this.meses()} meses`];
    const cat = this.categorias().find((c) => c.id === this.categoriaId());
    if (cat) partes.push(`categoría ${cat.nombre}`);
    if (this.estado()) partes.push(`estado ${this.estado()}`);
    return partes.join(' · ');
  });

  protected readonly hayFiltros = computed(() => this.categoriaId() !== null || this.estado() !== null);

  constructor() {
    addIcons({
      cashOutline, closeCircleOutline, documentOutline, downloadOutline, filterOutline, peopleOutline, pricetagOutline, radioOutline,
      receiptOutline, refreshOutline, warningOutline,
    });
    this.realtime
      .tableChanges$('pedidos')
      .pipe(debounceTime(1000), retry({ delay: () => timer(5000) }), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.data.reload());
  }

  protected setMeses(v: unknown): void {
    this.meses.set(Number(v) || 12);
  }

  protected toggleEstado(e: PedidoEstado): void {
    this.estado.set(this.estado() === e ? null : e);
  }

  protected limpiarFiltros(): void {
    this.categoriaId.set(null);
    this.estado.set(null);
    this.notify.announce('Filtros eliminados');
  }

  /** Drill-down: al pulsar una categoría del donut se filtra todo el panel. */
  protected onCategoria(sel: ChartSelection): void {
    const id = this.porCategoria().ids[sel.index] ?? null;
    this.categoriaId.set(this.categoriaId() === id ? null : id);
    this.notify.announce(`Filtrando por categoría ${sel.label}`);
  }

  protected onEstado(sel: ChartSelection): void {
    const e = this.estados[sel.index];
    if (e) this.toggleEstado(e);
  }

  /** Drill-down desde el treemap: abre la ficha del producto. */
  protected onTopProducto(sel: ChartSelection): void {
    const id = this.topProductos().ids[sel.index];
    if (id !== undefined) void this.router.navigate(['/app/productos', id]);
  }

  protected onProductoCritico(p: Producto): void {
    void this.router.navigate(['/app/productos', p.id]);
  }

  protected onActividad(doc: Documento<FeedItem>): void {
    const pedidoId = doc.data['pedido_id'] as number | undefined;
    const productoId = doc.data['producto_id'] as number | undefined;
    if (pedidoId) void this.router.navigate(['/app/pedidos'], { queryParams: { id: pedidoId } });
    else if (productoId) void this.router.navigate(['/app/productos', productoId]);
  }

  /** Exporta el informe de ventas con los filtros actuales. */
  protected async exportar(formato: 'pdf' | 'csv'): Promise<void> {
    const rows = this.actuales();
    const k = this.kpi();
    const columns = [
      { label: 'Pedido', value: (l: LineaDetalle) => `PED-${String(l.pedido_id).padStart(5, '0')}` },
      { label: 'Fecha', value: (l: LineaDetalle) => formatDate(l.fecha) },
      { label: 'Estado', value: (l: LineaDetalle) => capitalize(l.estado) },
      { label: 'Categoría', value: (l: LineaDetalle) => l.categoria },
      { label: 'SKU', value: (l: LineaDetalle) => l.sku },
      { label: 'Producto', value: (l: LineaDetalle) => l.producto },
      { label: 'Cantidad', value: (l: LineaDetalle) => l.cantidad, align: 'right' as const },
      { label: 'Precio', value: (l: LineaDetalle) => (formato === 'pdf' ? formatCurrency(l.precio_unitario) : l.precio_unitario), align: 'right' as const },
      { label: 'Subtotal', value: (l: LineaDetalle) => (formato === 'pdf' ? formatCurrency(l.subtotal) : l.subtotal), align: 'right' as const },
    ];
    try {
      const nombre =
        formato === 'csv'
          ? this.exportSvc.exportCsv({ title: 'Informe de ventas', columns, rows })
          : await this.exportSvc.exportPdf({
              title: 'Informe de ventas',
              subtitle: this.filtroTexto(),
              columns,
              rows,
              author: this.auth.displayName(),
              kpis: [
                { label: 'Facturación', value: formatCurrency(k.facturacion) },
                { label: 'Pedidos', value: formatNumber(k.pedidos) },
                { label: 'Ticket medio', value: formatCurrency(k.ticketMedio) },
                { label: 'Unidades', value: formatNumber(k.unidades) },
              ],
              totals: ['TOTAL', '', '', '', '', '', formatNumber(k.unidades), '', formatCurrency(rows.reduce((a, l) => a + Number(l.subtotal), 0))],
            });
      void this.notify.success(`Informe descargado: ${nombre}`);
    } catch (e) {
      void this.notify.error(e);
    }
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly actividadTipo = (d: Documento<Actividad>) => d.data.tipo;
}
