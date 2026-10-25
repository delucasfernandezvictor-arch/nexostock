import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { documentOutline, gridOutline, receiptOutline, cubeOutline, pieChartOutline, listOutline } from 'ionicons/icons';
import { firstValueFrom, forkJoin } from 'rxjs';
import { LineaDetalle, PedidoResumen, Producto, codigoPedido, nivelStock } from '../../core/models';
import { ExportService, ReportDefinition } from '../../core/services/export.service';
import { NotifyService } from '../../core/services/notify.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { ProductosService } from '../../core/services/productos.service';
import { AuthStore } from '../../core/state/auth.store';
import { capitalize, formatCurrency, formatDate, formatNumber } from '../../core/utils/format';
import { ExportColumn } from '../../core/utils/csv';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { inicioPeriodo } from '../admin/dashboard/dashboard.metrics';

/** Identificador de cada informe disponible. */
type InformeId = 'pedidos' | 'inventario' | 'categorias' | 'lineas';

interface InformeDef {
  id: InformeId;
  titulo: string;
  descripcion: string;
  icon: string;
  soloAdmin: boolean;
}

/**
 * **Informes**: generación y descarga de informes tabulados en **PDF** y
 * **CSV**. Los datos se obtienen bajo demanda (con `forkJoin` cuando el
 * informe combina varios orígenes) y respetan el rol: un usuario estándar
 * solo exporta sus propios pedidos (RLS).
 */
@Component({
  selector: 'app-informes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IonContent, IonSelect, IonSelectOption, IonButton, IonIcon, IonSpinner, PageHeaderComponent],
  template: `
    <app-page-header title="Informes" />
    <ion-content>
      <div class="page">
        <section class="panel periodo">
          <h2 id="periodo-title">Periodo de los informes</h2>
          <ion-select aria-labelledby="periodo-title" label="Periodo" labelPlacement="stacked" fill="outline" interface="popover" [(ngModel)]="meses">
            <ion-select-option [value]="1">Mes actual</ion-select-option>
            <ion-select-option [value]="3">Últimos 3 meses</ion-select-option>
            <ion-select-option [value]="6">Últimos 6 meses</ion-select-option>
            <ion-select-option [value]="12">Últimos 12 meses</ion-select-option>
          </ion-select>
          <p class="muted">El informe de inventario refleja siempre el stock actual.</p>
        </section>

        <ul class="informes">
          @for (inf of visibles(); track inf.id) {
            <li class="panel informe">
              <span class="ico" aria-hidden="true"><ion-icon [name]="inf.icon"></ion-icon></span>
              <div class="info">
                <h2>{{ inf.titulo }}</h2>
                <p>{{ inf.descripcion }}</p>
              </div>
              <div class="acciones">
                <ion-button (click)="generar(inf, 'pdf')" [disabled]="generando() !== null" [attr.aria-label]="'Descargar ' + inf.titulo + ' en PDF'">
                  @if (generando() === inf.id + 'pdf') { <ion-spinner name="crescent" aria-hidden="true"></ion-spinner> }
                  @else { <ion-icon slot="start" name="document-outline" aria-hidden="true"></ion-icon> }
                  PDF
                </ion-button>
                <ion-button fill="outline" (click)="generar(inf, 'csv')" [disabled]="generando() !== null" [attr.aria-label]="'Descargar ' + inf.titulo + ' en CSV'">
                  @if (generando() === inf.id + 'csv') { <ion-spinner name="crescent" aria-hidden="true"></ion-spinner> }
                  @else { <ion-icon slot="start" name="grid-outline" aria-hidden="true"></ion-icon> }
                  CSV
                </ion-button>
              </div>
            </li>
          }
        </ul>
      </div>
    </ion-content>
  `,
  styles: `
    .periodo { display: grid; gap: .5rem; h2 { margin: 0; font-size: 1.05rem; } p { margin: 0; font-size: .875rem; } }
    .informes { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); }
    .informe { display: flex; flex-direction: column; gap: .75rem; margin: 0; }
    .ico { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: .75rem; background: var(--app-badge-primary-bg); color: var(--app-badge-primary-fg); font-size: 1.4rem; }
    .info h2 { margin: 0 0 .25rem; font-size: 1.05rem; }
    .info p { margin: 0; color: var(--app-muted); font-size: .9375rem; }
    .acciones { display: flex; gap: .5rem; margin-top: auto; }
    @media (min-width: 768px) { .periodo { grid-template-columns: minmax(14rem, 20rem) 1fr; align-items: center; h2 { grid-column: 1 / -1; } } }
  `,
})
export class InformesPage {
  private readonly auth = inject(AuthStore);
  private readonly pedidosSvc = inject(PedidosService);
  private readonly productosSvc = inject(ProductosService);
  private readonly exportSvc = inject(ExportService);
  private readonly notify = inject(NotifyService);

  protected readonly meses = signal(3);
  protected readonly generando = signal<string | null>(null);

  private readonly informes: InformeDef[] = [
    { id: 'pedidos', titulo: 'Informe de pedidos', descripcion: 'Listado de pedidos con estado, prioridad, unidades y total.', icon: 'receipt-outline', soloAdmin: false },
    { id: 'inventario', titulo: 'Informe de inventario', descripcion: 'Stock actual, stock mínimo, valoración y nivel de cada producto.', icon: 'cube-outline', soloAdmin: false },
    { id: 'categorias', titulo: 'Ventas por categoría', descripcion: 'Facturación, unidades y pedidos consolidados por categoría.', icon: 'pie-chart-outline', soloAdmin: true },
    { id: 'lineas', titulo: 'Detalle de líneas de venta', descripcion: 'Cada línea vendida con producto, solicitante y departamento.', icon: 'list-outline', soloAdmin: true },
  ];

  protected readonly visibles = computed(() => this.informes.filter((i) => !i.soloAdmin || this.auth.isAdmin()));

  constructor() {
    addIcons({ documentOutline, gridOutline, receiptOutline, cubeOutline, pieChartOutline, listOutline });
  }

  private periodo(): string {
    const m = this.meses();
    return m === 1 ? 'Mes actual' : `Últimos ${m} meses (desde ${formatDate(inicioPeriodo(m))})`;
  }

  protected async generar(inf: InformeDef, formato: 'pdf' | 'csv'): Promise<void> {
    this.generando.set(inf.id + formato);
    try {
      const report = await this.construir(inf.id, formato === 'pdf');
      const nombre = formato === 'pdf' ? await this.exportSvc.exportPdf(report) : this.exportSvc.exportCsv(report);
      void this.notify.success(`Informe descargado: ${nombre}`);
    } catch (e) {
      void this.notify.error(e);
    } finally {
      this.generando.set(null);
    }
  }

  /** Construye la definición del informe (columnas, filas, KPIs y totales). */
  private async construir(id: InformeId, pdf: boolean): Promise<ReportDefinition<never>> {
    const money = (v: number) => (pdf ? formatCurrency(v) : Math.round(v * 100) / 100);
    const desde = inicioPeriodo(this.meses()).toISOString();
    const base = { author: this.auth.displayName(), subtitle: this.periodo() };

    if (id === 'pedidos') {
      const rows = await firstValueFrom(this.pedidosSvc.list({ desde, usuarioId: this.auth.isAdmin() ? null : this.auth.userId() }));
      const validos = rows.filter((r) => r.estado !== 'cancelado');
      const total = validos.reduce((a, r) => a + Number(r.total), 0);
      const columns: ExportColumn<PedidoResumen>[] = [
        { label: 'Pedido', value: (r) => codigoPedido(r.id) },
        { label: 'Fecha', value: (r) => formatDate(r.created_at) },
        ...(this.auth.isAdmin() ? [{ label: 'Solicitante', value: (r: PedidoResumen) => r.usuario_nombre || r.usuario_email }] : []),
        { label: 'Estado', value: (r) => capitalize(r.estado) },
        { label: 'Prioridad', value: (r) => capitalize(r.prioridad) },
        { label: 'Líneas', value: (r) => r.num_lineas, align: 'right' },
        { label: 'Unidades', value: (r) => r.unidades, align: 'right' },
        { label: 'Total', value: (r) => money(Number(r.total)), align: 'right' },
      ];
      return {
        ...base,
        title: this.auth.isAdmin() ? 'Informe de pedidos' : 'Mis pedidos',
        columns,
        rows,
        kpis: [
          { label: 'Pedidos', value: formatNumber(rows.length) },
          { label: 'No cancelados', value: formatNumber(validos.length) },
          { label: 'Importe', value: formatCurrency(total) },
          { label: 'Ticket medio', value: formatCurrency(validos.length ? total / validos.length : 0) },
        ],
        totals: [...Array(columns.length - 1).fill(''), formatCurrency(total)].map((v, i) => (i === 0 ? 'TOTAL (sin cancelados)' : v)),
      } as unknown as ReportDefinition<never>;
    }

    if (id === 'inventario') {
      const rows = await firstValueFrom(this.productosSvc.list(!this.auth.isAdmin()));
      const valor = rows.reduce((a, p) => a + p.stock * Number(p.precio), 0);
      const columns: ExportColumn<Producto>[] = [
        { label: 'SKU', value: (p) => p.sku },
        { label: 'Producto', value: (p) => p.nombre },
        { label: 'Categoría', value: (p) => p.categoria?.nombre ?? '' },
        { label: 'Precio', value: (p) => money(Number(p.precio)), align: 'right' },
        { label: 'Stock', value: (p) => p.stock, align: 'right' },
        { label: 'Mínimo', value: (p) => p.stock_minimo, align: 'right' },
        { label: 'Valoración', value: (p) => money(p.stock * Number(p.precio)), align: 'right' },
        { label: 'Nivel', value: (p) => ({ ok: 'En stock', bajo: 'Stock bajo', agotado: 'Agotado' })[nivelStock(p)] },
      ];
      return {
        ...base,
        subtitle: 'Situación del inventario a fecha de hoy',
        title: 'Informe de inventario',
        columns,
        rows,
        kpis: [
          { label: 'Productos', value: formatNumber(rows.length) },
          { label: 'Unidades', value: formatNumber(rows.reduce((a, p) => a + p.stock, 0)) },
          { label: 'Valoración', value: formatCurrency(valor) },
          { label: 'Stock crítico', value: formatNumber(rows.filter((p) => nivelStock(p) !== 'ok').length) },
        ],
        totals: ['TOTAL', '', '', '', formatNumber(rows.reduce((a, p) => a + p.stock, 0)), '', formatCurrency(valor), ''],
      } as unknown as ReportDefinition<never>;
    }

    // Informes de administrador: combinan líneas y categorías en paralelo
    const { lineas, categorias } = await firstValueFrom(
      forkJoin({ lineas: this.pedidosSvc.lineasDetalle({ desde, limit: 5000 }), categorias: this.productosSvc.categorias() }),
    );
    const validas = lineas.filter((l) => l.estado !== 'cancelado');

    if (id === 'categorias') {
      const rows = categorias
        .map((c) => {
          const ls = validas.filter((l) => l.categoria_id === c.id);
          return { categoria: c.nombre, pedidos: new Set(ls.map((l) => l.pedido_id)).size, unidades: ls.reduce((a, l) => a + l.cantidad, 0), total: ls.reduce((a, l) => a + Number(l.subtotal), 0) };
        })
        .sort((a, b) => b.total - a.total);
      const total = rows.reduce((a, r) => a + r.total, 0);
      type Fila = (typeof rows)[number];
      const columns: ExportColumn<Fila>[] = [
        { label: 'Categoría', value: (r) => r.categoria },
        { label: 'Pedidos', value: (r) => r.pedidos, align: 'right' },
        { label: 'Unidades', value: (r) => r.unidades, align: 'right' },
        { label: 'Facturación', value: (r) => money(r.total), align: 'right' },
        { label: '% del total', value: (r) => (total ? `${formatNumber(Math.round((r.total / total) * 1000) / 10)} %` : '0 %'), align: 'right' },
      ];
      return {
        ...base,
        orientation: 'portrait',
        title: 'Ventas por categoría',
        columns,
        rows,
        kpis: [
          { label: 'Facturación', value: formatCurrency(total) },
          { label: 'Líneas vendidas', value: formatNumber(validas.length) },
          { label: 'Categoría líder', value: rows[0]?.categoria ?? '—' },
        ],
        totals: ['TOTAL', '', formatNumber(rows.reduce((a, r) => a + r.unidades, 0)), formatCurrency(total), '100 %'],
      } as unknown as ReportDefinition<never>;
    }

    const columns: ExportColumn<LineaDetalle>[] = [
      { label: 'Pedido', value: (l) => codigoPedido(l.pedido_id) },
      { label: 'Fecha', value: (l) => formatDate(l.fecha) },
      { label: 'Solicitante', value: (l) => l.usuario_email },
      { label: 'Depto.', value: (l) => l.departamento ?? '' },
      { label: 'Producto', value: (l) => `${l.sku} · ${l.producto}` },
      { label: 'Categoría', value: (l) => l.categoria },
      { label: 'Estado', value: (l) => capitalize(l.estado) },
      { label: 'Cant.', value: (l) => l.cantidad, align: 'right' },
      { label: 'Subtotal', value: (l) => money(Number(l.subtotal)), align: 'right' },
    ];
    const total = validas.reduce((a, l) => a + Number(l.subtotal), 0);
    return {
      ...base,
      title: 'Detalle de líneas de venta',
      columns,
      rows: lineas,
      kpis: [
        { label: 'Líneas', value: formatNumber(lineas.length) },
        { label: 'Unidades', value: formatNumber(validas.reduce((a, l) => a + l.cantidad, 0)) },
        { label: 'Facturación', value: formatCurrency(total) },
      ],
      totals: ['TOTAL (sin cancelados)', '', '', '', '', '', '', formatNumber(validas.reduce((a, l) => a + l.cantidad, 0)), formatCurrency(total)],
    } as unknown as ReportDefinition<never>;
  }
}
