import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController, IonButton, IonContent, IonFooter, IonIcon, IonLabel, IonSegment, IonSegmentButton, IonSelect, IonSelectOption,
  IonToggle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline, cartOutline, createOutline, eyeOffOutline, eyeOutline, gridOutline, listOutline, trashOutline, arrowForwardOutline,
  searchOutline, refreshOutline,
} from 'ionicons/icons';
import { debounceTime, forkJoin, retry, timer } from 'rxjs';
import { Producto, TableAction, TableActionEvent, TableColumn, nivelStock } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { ProductosService } from '../../core/services/productos.service';
import { RealtimeDocsService } from '../../core/services/realtime-docs.service';
import { AuthStore } from '../../core/state/auth.store';
import { CartStore } from '../../core/state/cart.store';
import { formatCurrency } from '../../core/utils/format';
import { errorOf, valueOr } from '../../core/utils/resource';
import { normalizeText } from '../../shared/components/data-table/data-table.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

/** Fila de la vista de tabla (producto con campos derivados). */
type ProductoFila = Producto & { categoria_nombre: string; nivel: string };

/**
 * **Catálogo de productos**.
 *
 * - Filtros con *two-way data binding* (`[(ngModel)]` y `[(search)]`).
 * - Vista de tarjetas (usuarios) o de tabla con acciones de gestión (admin).
 * - El stock se actualiza en vivo al escuchar los cambios de la tabla
 *   `productos` (Supabase Realtime) y recargar con *debounce*.
 */
@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink, IonContent, IonButton, IonIcon, IonSelect, IonSelectOption, IonToggle, IonSegment, IonSegmentButton,
    IonLabel, IonFooter, IonToolbar, PageHeaderComponent, DataTableComponent, EmptyStateComponent, StatusBadgeComponent,
  ],
})
export class CatalogoPage {
  protected readonly auth = inject(AuthStore);
  protected readonly cart = inject(CartStore);
  private readonly productosSvc = inject(ProductosService);
  private readonly notify = inject(NotifyService);
  private readonly alertCtrl = inject(AlertController);
  private readonly router = inject(Router);

  // --- Estado de los filtros (two-way binding desde la plantilla)
  protected readonly texto = signal('');
  protected readonly categoria = signal<number | 'todas'>('todas');
  protected readonly soloDisponibles = signal(false);
  protected readonly vista = signal<'tarjetas' | 'tabla'>('tarjetas');

  protected readonly data = rxResource({
    params: () => ({ admin: this.auth.isAdmin() }),
    stream: ({ params }) => forkJoin({ productos: this.productosSvc.list(!params.admin), categorias: this.productosSvc.categorias() }),
  });
  private readonly value = valueOr(this.data, { productos: [] as Producto[], categorias: [] });
  protected readonly error = errorOf(this.data);
  protected readonly categorias = computed(() => this.value().categorias);

  /** Productos tras aplicar categoría y disponibilidad (la búsqueda de texto se aplica aquí en tarjetas y en la tabla). */
  protected readonly filtrados = computed(() => {
    const cat = this.categoria();
    const solo = this.soloDisponibles();
    return this.value().productos.filter((p) => (cat === 'todas' || p.categoria_id === cat) && (!solo || p.stock > 0));
  });

  protected readonly tarjetas = computed(() => {
    const q = normalizeText(this.texto().trim());
    const list = this.filtrados();
    return q ? list.filter((p) => normalizeText(`${p.nombre} ${p.sku} ${p.categoria?.nombre ?? ''}`).includes(q)) : list;
  });

  protected readonly filas = computed<ProductoFila[]>(() =>
    this.filtrados().map((p) => ({ ...p, categoria_nombre: p.categoria?.nombre ?? '', nivel: p.activo ? nivelStock(p) : 'inactivo' })),
  );

  protected readonly columns: TableColumn<ProductoFila>[] = [
    { key: 'sku', label: 'SKU' },
    { key: 'nombre', label: 'Producto' },
    { key: 'categoria_nombre', label: 'Categoría', hideOnMobile: true },
    { key: 'precio', label: 'Precio', type: 'currency' },
    { key: 'stock', label: 'Stock', type: 'number' },
    { key: 'nivel', label: 'Estado', type: 'badge', searchable: false },
  ];

  protected readonly acciones = computed<TableAction<ProductoFila>[]>(() => {
    const base: TableAction<ProductoFila>[] = [
      { id: 'carrito', label: 'Añadir al pedido', icon: 'cart-outline', visible: (p) => p.activo && p.stock > 0 },
    ];
    if (!this.auth.isAdmin()) return base;
    return [
      ...base,
      { id: 'editar', label: 'Editar', icon: 'create-outline' },
      { id: 'desactivar', label: 'Desactivar', icon: 'eye-off-outline', color: 'medium', visible: (p) => p.activo },
      { id: 'activar', label: 'Activar', icon: 'eye-outline', color: 'success', visible: (p) => !p.activo },
      { id: 'eliminar', label: 'Eliminar', icon: 'trash-outline', color: 'danger' },
    ];
  });

  protected readonly formatCurrency = formatCurrency;
  protected readonly nivelStock = nivelStock;

  constructor() {
    addIcons({
      addOutline, cartOutline, createOutline, eyeOffOutline, eyeOutline, gridOutline, listOutline, trashOutline, arrowForwardOutline,
      searchOutline, refreshOutline,
    });
    if (this.auth.isAdmin()) this.vista.set('tabla');

    // Stock en tiempo real: cualquier cambio en productos recarga el catálogo
    inject(RealtimeDocsService)
      .tableChanges$('productos')
      .pipe(debounceTime(800), retry({ delay: () => timer(5000) }), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.data.reload());
  }

  protected setCategoria(value: number | 'todas' | string): void {
    this.categoria.set(value === 'todas' ? 'todas' : Number(value));
  }

  protected anadir(p: Producto): void {
    if (this.cart.cantidadDe(p.id) >= p.stock) {
      void this.notify.error(`No hay más stock disponible de ${p.nombre}`);
      return;
    }
    this.cart.add(p, 1);
    void this.notify.success(`${p.nombre} añadido al pedido`);
  }

  protected async onAction(e: TableActionEvent<ProductoFila>): Promise<void> {
    const p = e.row;
    switch (e.action) {
      case 'carrito':
        this.anadir(p);
        break;
      case 'editar':
        await this.router.navigate(['/app/productos', p.id]);
        break;
      case 'activar':
      case 'desactivar':
        this.productosSvc.setActivo(p.id, e.action === 'activar').subscribe({
          next: () => {
            void this.notify.success(`Producto ${e.action === 'activar' ? 'activado' : 'desactivado'}`);
            this.data.reload();
          },
          error: (err) => void this.notify.error(err),
        });
        break;
      case 'eliminar':
        await this.confirmarEliminar(p);
        break;
    }
  }

  private async confirmarEliminar(p: Producto): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar producto',
      message: `¿Eliminar definitivamente "${p.nombre}" (${p.sku})? Si tiene pedidos asociados, desactívalo en su lugar.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () =>
            this.productosSvc.delete(p.id).subscribe({
              next: () => {
                void this.notify.success('Producto eliminado');
                this.cart.remove(p.id);
                this.data.reload();
              },
              error: (err) => void this.notify.error(err),
            }),
        },
      ],
    });
    await alert.present();
  }
}
