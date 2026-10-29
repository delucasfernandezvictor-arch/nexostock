import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonCol, IonContent, IonGrid, IonIcon, IonInput, IonRow, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonToggle } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeCircle, saveOutline, arrowBackOutline } from 'ionicons/icons';
import { firstValueFrom, map, startWith } from 'rxjs';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { Categoria, ProductoInput, errorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/services/notify.service';
import { PreparedImage, ProductImagesService } from '../../../core/services/product-images.service';
import { ProductosService } from '../../../core/services/productos.service';
import { valueOr } from '../../../core/utils/resource';
import { SKU_PATTERN, errorText, remoteUniqueValidator, stockCoherente } from '../../../core/validators/validators';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ImagePickerComponent } from '../../../shared/components/image-picker/image-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

/**
 * **Alta / edición de producto** (solo administrador).
 *
 * Formulario reactivo con validación síncrona (formato, rangos, coherencia de
 * stock a nivel de grupo) y **validación asíncrona** del SKU contra la base de
 * datos, que excluye el propio producto cuando se está editando.
 *
 * La **imagen del producto** se guarda en Supabase Storage: se optimiza en el
 * navegador, se sube al guardar y se borra la anterior para no dejar huérfanos.
 *
 * Implementa {@link HasPendingChanges}: `pendingChangesGuard` pide confirmación
 * antes de salir con cambios sin guardar (también si solo cambia la imagen).
 */
@Component({
  selector: 'app-producto-form',
  templateUrl: './producto-form.page.html',
  styleUrls: ['../../auth/auth.scss', './producto-form.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, IonContent, IonGrid, IonRow, IonCol, IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle, IonButton,
    IonIcon, IonSpinner, PageHeaderComponent, EmptyStateComponent, ImagePickerComponent,
  ],
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ProductoFormPage implements OnInit, HasPendingChanges {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly productosSvc = inject(ProductosService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly images = inject(ProductImagesService);

  /** Parámetro de ruta `:id` (ausente en el alta) */
  readonly id = input<string>();

  protected readonly productoId = computed(() => (this.id() ? Number(this.id()) : null));
  protected readonly esEdicion = computed(() => this.productoId() !== null);
  protected readonly guardando = signal(false);
  protected readonly cargando = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly errorText = errorText;

  // --- Imagen (Supabase Storage)
  /** Ruta actual de la imagen en el bucket (la guardada en la base de datos) */
  private readonly imagenActual = signal<string | null>(null);
  /** Imagen nueva optimizada, pendiente de subir al guardar */
  private readonly imagenNueva = signal<PreparedImage | null>(null);
  /** El usuario ha pedido quitar la imagen actual */
  private readonly quitarImagen = signal(false);
  private readonly previewObjectUrl = signal<string | null>(null);
  protected readonly procesandoImagen = signal(false);
  protected readonly imagenError = signal<string | null>(null);
  /** Lo que muestra el selector: la nueva, la actual o ninguna */
  protected readonly vistaPrevia = computed(() =>
    this.previewObjectUrl() ?? (this.quitarImagen() ? null : this.images.url(this.imagenActual())),
  );
  protected readonly imagenCambiada = computed(() => this.imagenNueva() !== null || this.quitarImagen());

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
    // Libera la URL temporal de la vista previa al salir (evita fugas de memoria)
    inject(DestroyRef).onDestroy(() => this.setPreview(null));
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
        this.imagenActual.set(p.imagen_path ?? null);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.noEncontrado.set(true);
      },
    });
  }

  /** Hay cambios sin guardar (lo consulta `pendingChangesGuard`). */
  hasPendingChanges(): boolean {
    return (this.form.dirty || this.imagenCambiada()) && !this.guardando();
  }

  /** Aviso nativo del navegador al recargar o cerrar la pestaña con cambios. */
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  protected skuError(): string {
    return errorText(this.form.controls.sku.errors, {
      pattern: 'Formato AAA-0000 (tres letras, guion y cuatro dígitos)',
      skuTaken: 'Ya existe un producto con este SKU',
    });
  }

  /** El usuario elige o suelta una imagen: se optimiza y se muestra la vista previa. */
  protected async onImagen(file: File): Promise<void> {
    this.imagenError.set(null);
    this.procesandoImagen.set(true);
    try {
      const prepared = await this.images.prepare(file);
      this.imagenNueva.set(prepared);
      this.quitarImagen.set(false);
      this.setPreview(URL.createObjectURL(prepared.blob));
      this.notify.announce(`Imagen preparada: ${prepared.width} × ${prepared.height} píxeles, ${Math.round(prepared.blob.size / 1024)} KB`);
    } catch (e) {
      this.imagenError.set(errorMessage(e));
    } finally {
      this.procesandoImagen.set(false);
    }
  }

  protected onQuitarImagen(): void {
    this.imagenNueva.set(null);
    this.setPreview(null);
    this.quitarImagen.set(this.imagenActual() !== null);
    this.notify.announce('Imagen retirada. Se aplicará al guardar');
  }

  protected async guardar(): Promise<void> {
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
    try {
      // 1. Datos del producto (API REST SQL)
      const p = await firstValueFrom(id === null ? this.productosSvc.create(input) : this.productosSvc.update(id, input));
      // 2. Imagen (Supabase Storage): subir la nueva o quitar la actual, y borrar la anterior
      await this.guardarImagen(p.id, p.sku);
      this.form.markAsPristine(); // ya está guardado: salir no debe pedir confirmación
      this.imagenNueva.set(null);
      this.quitarImagen.set(false);
      void this.notify.success(id === null ? `Producto ${p.sku} creado` : `Producto ${p.sku} actualizado`);
      await this.router.navigateByUrl('/app/catalogo');
    } catch (err) {
      void this.notify.error(err);
    } finally {
      this.guardando.set(false);
    }
  }

  /** Aplica en Storage el cambio de imagen pendiente. */
  private async guardarImagen(productoId: number, sku: string): Promise<void> {
    const anterior = this.imagenActual();
    const nueva = this.imagenNueva();
    if (nueva) {
      const path = await this.images.upload(sku, nueva);
      await firstValueFrom(this.productosSvc.setImagen(productoId, path));
      this.imagenActual.set(path);
      if (anterior) await this.images.remove(anterior).catch(() => undefined); // limpieza sin bloquear
    } else if (this.quitarImagen() && anterior) {
      await firstValueFrom(this.productosSvc.setImagen(productoId, null));
      this.imagenActual.set(null);
      await this.images.remove(anterior).catch(() => undefined);
    }
  }

  private setPreview(url: string | null): void {
    const prev = this.previewObjectUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.previewObjectUrl.set(url);
  }

  protected cancelar(): void {
    void this.router.navigateByUrl('/app/catalogo');
  }
}
