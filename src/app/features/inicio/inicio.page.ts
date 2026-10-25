import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonCol, IonContent, IonGrid, IonIcon, IonRefresher, IonRefresherContent, IonRow } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addCircleOutline, barChartOutline, cartOutline, cashOutline, cubeOutline, documentTextOutline, megaphoneOutline, receiptOutline,
  timeOutline, warningOutline, refreshOutline, radioOutline,
} from 'ionicons/icons';
import { catchError, forkJoin, of } from 'rxjs';
import { Aviso, PedidoResumen, TableColumn, codigoPedido, nivelStock } from '../../core/models';
import { PedidosService } from '../../core/services/pedidos.service';
import { ProductosService } from '../../core/services/productos.service';
import { RealtimeDocsService } from '../../core/services/realtime-docs.service';
import { AuthStore } from '../../core/state/auth.store';
import { errorOf, valueOr } from '../../core/utils/resource';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * **Inicio**: resumen personal del usuario (o global si es administrador),
 * avisos de empresa en tiempo real (colección NoSQL `avisos`) y accesos rápidos.
 *
 * Los datos SQL se cargan en paralelo con `forkJoin` dentro de un `rxResource`.
 */
@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, IonContent, IonGrid, IonRow, IonCol, IonButton, IonIcon, IonRefresher, IonRefresherContent, PageHeaderComponent,
    KpiCardComponent, DataTableComponent, EmptyStateComponent,
  ],
})
export class InicioPage {
  protected readonly auth = inject(AuthStore);
  private readonly pedidosSvc = inject(PedidosService);
  private readonly productosSvc = inject(ProductosService);
  private readonly realtime = inject(RealtimeDocsService);
  private readonly router = inject(Router);

  /** Carga concurrente de pedidos y productos (se recarga si cambia el usuario o el rol). */
  protected readonly data = rxResource({
    params: () => ({ userId: this.auth.userId(), admin: this.auth.isAdmin() }),
    stream: ({ params }) =>
      forkJoin({
        pedidos: this.pedidosSvc.list({ usuarioId: params.admin ? null : params.userId, limit: 500 }),
        productos: this.productosSvc.list(true),
      }),
  });

  private readonly value = valueOr(this.data, { pedidos: [] as PedidoResumen[], productos: [] });
  protected readonly error = errorOf(this.data);

  /** Avisos en tiempo real (NoSQL). Si falla la conexión se muestra la lista vacía. */
  protected readonly avisos = toSignal(this.realtime.collection$<Aviso>('avisos', 6).pipe(catchError(() => of([]))), {
    initialValue: null,
  });

  protected readonly kpis = computed(() => {
    const { pedidos, productos } = this.value();
    const year = new Date().getFullYear();
    const activos = pedidos.filter((p) => p.estado !== 'cancelado');
    return {
      pedidos: pedidos.length,
      pendientes: pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'aprobado').length,
      importeAnual: activos.filter((p) => new Date(p.created_at).getFullYear() === year).reduce((a, p) => a + Number(p.total), 0),
      disponibles: productos.filter((p) => p.stock > 0).length,
      stockBajo: productos.filter((p) => nivelStock(p) !== 'ok').length,
    };
  });

  protected readonly ultimos = computed(() => this.value().pedidos.slice(0, 5));

  protected readonly columns: TableColumn<PedidoResumen>[] = [
    { key: 'id', label: 'Pedido', format: (r) => codigoPedido(r.id) },
    { key: 'created_at', label: 'Fecha', type: 'date' },
    { key: 'estado', label: 'Estado', type: 'badge' },
    { key: 'total', label: 'Total', type: 'currency' },
  ];

  protected readonly saludo = computed(() => {
    const h = new Date().getHours();
    return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  });

  constructor() {
    addIcons({
      addCircleOutline, barChartOutline, cartOutline, cashOutline, cubeOutline, documentTextOutline, megaphoneOutline, receiptOutline,
      timeOutline, warningOutline, refreshOutline, radioOutline,
    });
  }

  protected abrirPedido(p: PedidoResumen): void {
    void this.router.navigate(['/app/pedidos'], { queryParams: { id: p.id } });
  }

  protected refresh(event: CustomEvent): void {
    this.data.reload();
    setTimeout(() => (event.target as HTMLIonRefresherElement).complete(), 600);
  }
}
