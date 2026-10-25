import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonSelect, IonSelectOption, IonSpinner, IonTextarea } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, cartOutline, removeOutline, sendOutline, trashOutline, cubeOutline } from 'ionicons/icons';
import { map, startWith } from 'rxjs';
import { PEDIDO_PRIORIDADES, PedidoPrioridad, Producto, codigoPedido } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { ProductosService } from '../../core/services/productos.service';
import { CartStore } from '../../core/state/cart.store';
import { capitalize, formatCurrency } from '../../core/utils/format';
import { valueOr } from '../../core/utils/resource';
import { errorText } from '../../core/validators/validators';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Controles de una línea del pedido. */
type LineaForm = FormGroup<{ producto_id: FormControl<number>; cantidad: FormControl<number> }>;

/**
 * **Alta de pedido**: formulario reactivo con `FormArray` dinámico de líneas.
 *
 * - Cada línea valida la cantidad contra el stock real (`Validators.max`).
 * - El carrito (`CartStore`) se sincroniza con el formulario en ambos sentidos,
 *   de modo que no se pierde el pedido en curso al navegar o recargar.
 * - El envío llama a la RPC transaccional `crear_pedido`; si otro usuario ha
 *   agotado el stock entretanto, el servidor rechaza la operación y se muestra
 *   su mensaje.
 */
@Component({
  selector: 'app-nuevo-pedido',
  templateUrl: './nuevo-pedido.page.html',
  styleUrls: ['./nuevo-pedido.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, IonContent, IonButton, IonIcon, IonInput, IonSelect, IonSelectOption, IonTextarea, IonSpinner,
    PageHeaderComponent, EmptyStateComponent,
  ],
})
export class NuevoPedidoPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly cart = inject(CartStore);
  private readonly pedidosSvc = inject(PedidosService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  protected readonly prioridades = PEDIDO_PRIORIDADES;
  protected readonly enviando = signal(false);
  protected readonly errorText = errorText;
  protected readonly capitalize = capitalize;
  protected readonly formatCurrency = formatCurrency;

  private readonly productosSvc = inject(ProductosService);
  protected readonly productos = rxResource({ stream: () => this.productosSvc.list(true) });
  private readonly catalogo = valueOr(this.productos, [] as Producto[]);
  private readonly porId = computed(() => new Map(this.catalogo().map((p) => [p.id, p])));

  protected readonly form = this.fb.group({
    lineas: this.fb.array<LineaForm>([], { validators: Validators.minLength(1) }),
    prioridad: this.fb.control<PedidoPrioridad>('normal', Validators.required),
    notas: this.fb.control('', Validators.maxLength(500)),
  });

  /** Selector para añadir un producto nuevo al pedido */
  protected readonly nuevoProducto = new FormControl<number | null>(null);

  /** Valor del formulario como señal (totales en vivo). */
  private readonly lineasValue = toSignal(
    this.form.controls.lineas.valueChanges.pipe(
      startWith(null),
      map(() => this.form.controls.lineas.getRawValue()),
    ),
    { initialValue: [] as { producto_id: number; cantidad: number }[] },
  );

  protected readonly resumen = computed(() => {
    const mapa = this.porId();
    const lineas = this.lineasValue().map((l) => {
      const p = mapa.get(l.producto_id);
      return { ...l, producto: p, subtotal: (p?.precio ?? 0) * (Number(l.cantidad) || 0) };
    });
    return {
      lineas,
      total: lineas.reduce((a, l) => a + l.subtotal, 0),
      unidades: lineas.reduce((a, l) => a + (Number(l.cantidad) || 0), 0),
    };
  });

  /** Productos que aún no están en el pedido. */
  protected readonly disponibles = computed(() => {
    const usados = new Set(this.lineasValue().map((l) => l.producto_id));
    return this.catalogo().filter((p) => p.stock > 0 && !usados.has(p.id));
  });

  get lineas(): FormArray<LineaForm> {
    return this.form.controls.lineas;
  }

  constructor() {
    addIcons({ addOutline, cartOutline, removeOutline, sendOutline, trashOutline, cubeOutline });

    // Carrito → formulario (estado inicial)
    for (const l of this.cart.lineas()) this.lineas.push(this.crearLinea(l.producto.id, l.cantidad, l.producto.stock));

    // Formulario → carrito (persistencia del pedido en curso)
    this.lineas.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      const mapa = this.porId();
      for (const l of this.lineas.getRawValue()) {
        const p = mapa.get(l.producto_id);
        if (p && this.cart.cantidadDe(p.id) !== l.cantidad && l.cantidad > 0) this.cart.setCantidad(p.id, l.cantidad);
      }
    });
  }

  private crearLinea(productoId: number, cantidad: number, stock: number): LineaForm {
    return this.fb.group({
      producto_id: this.fb.control(productoId, Validators.required),
      cantidad: this.fb.control(cantidad, [Validators.required, Validators.min(1), Validators.max(Math.max(stock, 1))]),
    });
  }

  protected anadirLinea(): void {
    const id = this.nuevoProducto.value;
    const p = id ? this.porId().get(Number(id)) : undefined;
    if (!p) return;
    this.lineas.push(this.crearLinea(p.id, 1, p.stock));
    this.cart.add(p, 1);
    this.nuevoProducto.reset();
    this.notify.announce(`${p.nombre} añadido. ${this.lineas.length} líneas en el pedido`);
  }

  protected cambiarCantidad(i: number, delta: number): void {
    const ctrl = this.lineas.at(i).controls.cantidad;
    const stock = this.porId().get(this.lineas.at(i).controls.producto_id.value)?.stock ?? 1;
    ctrl.setValue(Math.max(1, Math.min(stock, (Number(ctrl.value) || 0) + delta)));
    ctrl.markAsTouched();
  }

  protected quitarLinea(i: number): void {
    const id = this.lineas.at(i).controls.producto_id.value;
    const nombre = this.porId().get(id)?.nombre ?? 'Producto';
    this.lineas.removeAt(i);
    this.cart.remove(id);
    this.notify.announce(`${nombre} eliminado del pedido`);
  }

  protected cantidadError(i: number): string {
    const stock = this.porId().get(this.lineas.at(i).controls.producto_id.value)?.stock;
    return errorText(this.lineas.at(i).controls.cantidad.errors, { max: `Solo hay ${stock} unidades disponibles` });
  }

  protected enviar(): void {
    if (this.form.invalid || this.lineas.length === 0) {
      this.form.markAllAsTouched();
      void this.notify.error('Revisa las líneas del pedido');
      return;
    }
    const { lineas, prioridad, notas } = this.form.getRawValue();
    this.enviando.set(true);
    this.pedidosSvc.crear({ lineas, prioridad, notas }).subscribe({
      next: (pedido) => {
        this.enviando.set(false);
        this.cart.clear();
        void this.notify.success(`Pedido ${codigoPedido(pedido.id)} creado correctamente`);
        void this.router.navigate(['/app/pedidos'], { queryParams: { id: pedido.id }, replaceUrl: true });
      },
      error: (err) => {
        this.enviando.set(false);
        void this.notify.error(err);
        this.productos.reload();
      },
    });
  }
}
