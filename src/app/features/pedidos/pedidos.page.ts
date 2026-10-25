import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  AlertController, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonLabel, IonModal, IonSegment, IonSegmentButton, IonSpinner,
  IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline, eyeOutline, refreshOutline, arrowForwardOutline } from 'ionicons/icons';
import { debounceTime, of, retry, timer } from 'rxjs';
import {
  LineaDetalle, PEDIDO_ESTADOS, PedidoEstado, PedidoResumen, TRANSICIONES, TableAction, TableActionEvent, TableColumn, codigoPedido,
} from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { RealtimeDocsService } from '../../core/services/realtime-docs.service';
import { AuthStore } from '../../core/state/auth.store';
import { capitalize, formatCurrency, formatDateTime } from '../../core/utils/format';
import { errorOf, valueOr } from '../../core/utils/resource';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

/** Fila de la tabla de pedidos. */
type PedidoFila = PedidoResumen & { codigo: string; usuario: string };

/**
 * **Pedidos**: el usuario estándar ve los suyos y puede cancelarlos mientras
 * estén pendientes; el administrador ve todos y gestiona su ciclo de vida
 * (pendiente → aprobado → enviado → entregado). La lista se actualiza en vivo.
 */
@Component({
  selector: 'app-pedidos',
  templateUrl: './pedidos.page.html',
  styleUrls: ['./pedidos.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, IonContent, IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonModal, IonHeader, IonToolbar, IonTitle,
    IonButtons, IonSpinner, PageHeaderComponent, DataTableComponent, EmptyStateComponent, StatusBadgeComponent,
  ],
})
export class PedidosPage {
  protected readonly auth = inject(AuthStore);
  private readonly pedidosSvc = inject(PedidosService);
  private readonly notify = inject(NotifyService);
  private readonly alertCtrl = inject(AlertController);

  /** Pedido a abrir al entrar (`?id=`), vía `withComponentInputBinding` */
  readonly id = input<string | undefined>(undefined);

  protected readonly estados = PEDIDO_ESTADOS;
  protected readonly filtroEstado = signal<PedidoEstado | 'todos'>('todos');

  protected readonly data = rxResource({
    params: () => ({ userId: this.auth.userId(), admin: this.auth.isAdmin() }),
    stream: ({ params }) => this.pedidosSvc.list({ usuarioId: params.admin ? null : params.userId }),
  });
  private readonly pedidos = valueOr(this.data, [] as PedidoResumen[]);
  protected readonly error = errorOf(this.data);

  protected readonly conteo = computed(() => {
    const c: Record<string, number> = { todos: this.pedidos().length };
    for (const p of this.pedidos()) c[p.estado] = (c[p.estado] ?? 0) + 1;
    return c;
  });

  protected readonly filas = computed<PedidoFila[]>(() => {
    const f = this.filtroEstado();
    return this.pedidos()
      .filter((p) => f === 'todos' || p.estado === f)
      .map((p) => ({ ...p, codigo: codigoPedido(p.id), usuario: p.usuario_nombre || p.usuario_email }));
  });

  protected readonly columns = computed<TableColumn<PedidoFila>[]>(() => [
    { key: 'codigo', label: 'Pedido' },
    { key: 'created_at', label: 'Fecha', type: 'datetime' },
    ...(this.auth.isAdmin() ? [{ key: 'usuario', label: 'Solicitante', hideOnMobile: true } as TableColumn<PedidoFila>] : []),
    { key: 'prioridad', label: 'Prioridad', type: 'badge', hideOnMobile: true },
    { key: 'num_lineas', label: 'Líneas', type: 'number', hideOnMobile: true },
    { key: 'estado', label: 'Estado', type: 'badge' },
    { key: 'total', label: 'Total', type: 'currency' },
  ]);

  protected readonly acciones: TableAction<PedidoFila>[] = [{ id: 'ver', label: 'Ver detalle', icon: 'eye-outline' }];

  // --- Detalle (modal)
  protected readonly seleccionado = signal<PedidoResumen | null>(null);
  protected readonly lineas = rxResource({
    params: () => this.seleccionado()?.id,
    stream: ({ params }) => (params ? this.pedidosSvc.lineas(params) : of([] as LineaDetalle[])),
  });
  protected readonly lineasValue = valueOr(this.lineas, [] as LineaDetalle[]);
  protected readonly cambiando = signal(false);

  /** Transiciones disponibles para el pedido abierto según el rol. */
  protected readonly transiciones = computed<PedidoEstado[]>(() => {
    const p = this.seleccionado();
    if (!p) return [];
    if (this.auth.isAdmin()) return [...TRANSICIONES[p.estado]];
    return p.estado === 'pendiente' && p.usuario_id === this.auth.userId() ? ['cancelado'] : [];
  });

  protected readonly codigoPedido = codigoPedido;
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDateTime = formatDateTime;
  protected readonly capitalize = capitalize;

  constructor() {
    addIcons({ addOutline, closeOutline, eyeOutline, refreshOutline, arrowForwardOutline });

    // Abre el pedido indicado en la URL cuando los datos están disponibles
    effect(() => {
      const id = Number(this.id());
      const lista = this.pedidos();
      if (!id || !lista.length) return;
      untracked(() => {
        if (this.seleccionado()?.id !== id) this.seleccionado.set(lista.find((p) => p.id === id) ?? null);
      });
    });

    // Tiempo real: recarga cuando cambia cualquier pedido visible
    inject(RealtimeDocsService)
      .tableChanges$('pedidos')
      .pipe(debounceTime(500), retry({ delay: () => timer(5000) }), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.data.reload());
  }

  protected setFiltro(value: unknown): void {
    this.filtroEstado.set((value as PedidoEstado | 'todos') ?? 'todos');
  }

  protected onAction(e: TableActionEvent<PedidoFila>): void {
    this.seleccionado.set(e.row);
  }

  protected cerrar(): void {
    this.seleccionado.set(null);
  }

  protected async cambiarEstado(estado: PedidoEstado): Promise<void> {
    const p = this.seleccionado();
    if (!p) return;
    if (estado === 'cancelado') {
      const alert = await this.alertCtrl.create({
        header: 'Cancelar pedido',
        message: `¿Seguro que quieres cancelar el pedido ${codigoPedido(p.id)}? Se repondrá el stock reservado.`,
        buttons: [
          { text: 'Volver', role: 'cancel' },
          { text: 'Cancelar pedido', role: 'destructive' },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'destructive') return;
    }
    this.cambiando.set(true);
    this.pedidosSvc.cambiarEstado(p.id, estado).subscribe({
      next: (actualizado) => {
        this.cambiando.set(false);
        this.seleccionado.set({ ...p, estado: actualizado?.estado ?? estado });
        void this.notify.success(`Pedido ${codigoPedido(p.id)} marcado como ${estado}`);
        this.data.reload();
      },
      error: (err) => {
        this.cambiando.set(false);
        void this.notify.error(err);
      },
    });
  }

  protected etiquetaTransicion(e: PedidoEstado): string {
    const labels: Record<PedidoEstado, string> = {
      aprobado: 'Aprobar',
      enviado: 'Marcar como enviado',
      entregado: 'Marcar como entregado',
      cancelado: 'Cancelar pedido',
      pendiente: 'Pendiente',
    };
    return labels[e];
  }
}
