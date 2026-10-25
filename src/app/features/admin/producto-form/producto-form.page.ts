import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonCol, IonContent, IonGrid, IonIcon, IonInput, IonRow, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonToggle } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeCircle, saveOutline, arrowBackOutline } from 'ionicons/icons';
import { map, startWith } from 'rxjs';
import { Categoria, ProductoInput } from '../../../core/models';
import { NotifyService } from '../../../core/services/notify.service';
import { ProductosService } from '../../../core/services/productos.service';
import { valueOr } from '../../../core/utils/resource';
import { SKU_PATTERN, errorText, remoteUniqueValidator, stockCoherente } from '../../../core/validators/validators';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

/**
 * **Alta / edición de producto** (solo administrador).
 *
 * Formulario reactivo con validación síncrona (formato, rangos, coherencia de
 * stock a nivel de grupo) y **validación asíncrona** del SKU contra la base de
 * datos, que excluye el propio producto cuando se está editando.
 */
@Component({
  selector: 'app-producto-form',
  templateUrl: './producto-form.page.html',
  styleUrls: ['../../auth/auth.scss', './producto-form.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, IonContent, IonGrid, IonRow, IonCol, IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle, IonButton,
    IonIcon, IonSpinner, PageHeaderComponent, EmptyStateComponent,
  ],
})
export class ProductoFormPage implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly productosSvc = inject(ProductosService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  /** Parámetro de ruta `:id` (ausente en el alta) */
  readonly id = input<string>();

  protected readonly productoId = computed(() => (this.id() ? Number(this.id()) : null));
  protected readonly esEdicion = computed(() => this.productoId() !== null);
  protected readonly guardando = signal(false);
  protected readonly cargando = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly errorText = errorText;

  protected readonly categoriasRes = rxResource({ stream: () => this.productosSvc.categorias() });
  protected readonly categorias = valueOr(this.categoriasRes, [] as Categoria[]);

  protected readonly form = this.fb.group(
    {
      sku: this.fb.control('', {
        validators: [Validators.required, Validators.pattern(SKU_PATTERN)],
        asyncValidators: [remoteUniqueValidator((v) => this.productosSvc.skuDisponible(v, this.productoId()), 'skuTaken')],
      }),
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
      descripcion: ['', Validators.maxLength(500)],
      categoria_id: this.fb.control<number | null>(null, Validators.required),
      precio: this.fb.control<number>(0, [Validators.required, Validators.min(0), Validators.max(100000)]),
      stock: this.fb.control<number>(0, [Validators.required, Validators.min(0), Validators.max(1000000)]),
      stock_minimo: this.fb.control<number>(5, [Validators.required, Validators.min(0)]),
      activo: [true],
    },
    { validators: stockCoherente },
  );

  protected readonly skuStatus = toSignal(
    this.form.controls.sku.statusChanges.pipe(
      startWith(this.form.controls.sku.status),
      map(() => this.form.controls.sku.status),
    ),
    { initialValue: 'VALID' },
  );

  constructor() {
    addIcons({ checkmarkCircle, closeCircle, saveOutline, arrowBackOutline });
  }

  ngOnInit(): void {
    const id = this.productoId();
    if (id === null) return;
    this.cargando.set(true);
    this.productosSvc.get(id).subscribe({
      next: (p) => {
        this.form.reset({
          sku: p.sku,
          nombre: p.nombre,
          descripcion: p.descripcion ?? '',
          categoria_id: p.categoria_id,
          precio: Number(p.precio),
          stock: p.stock,
          stock_minimo: p.stock_minimo,
          activo: p.activo,
        });
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.noEncontrado.set(true);
      },
    });
  }

  protected skuError(): string {
    return errorText(this.form.controls.sku.errors, {
      pattern: 'Formato AAA-0000 (tres letras, guion y cuatro dígitos)',
      skuTaken: 'Ya existe un producto con este SKU',
    });
  }

  protected guardar(): void {
    if (this.form.invalid || this.form.pending) {
      this.form.markAllAsTouched();
      void this.notify.error('Revisa los campos marcados');
      return;
    }
    const raw = this.form.getRawValue();
    const input: ProductoInput = {
      ...raw,
      categoria_id: Number(raw.categoria_id),
      precio: Number(raw.precio),
      stock: Number(raw.stock),
      stock_minimo: Number(raw.stock_minimo),
      descripcion: raw.descripcion || null,
    };
    const id = this.productoId();
    this.guardando.set(true);
    const op = id === null ? this.productosSvc.create(input) : this.productosSvc.update(id, input);
    op.subscribe({
      next: (p) => {
        this.guardando.set(false);
        void this.notify.success(id === null ? `Producto ${p.sku} creado` : `Producto ${p.sku} actualizado`);
        void this.router.navigateByUrl('/app/catalogo');
      },
      error: (err) => {
        this.guardando.set(false);
        void this.notify.error(err);
      },
    });
  }

  protected cancelar(): void {
    void this.router.navigateByUrl('/app/catalogo');
  }
}
