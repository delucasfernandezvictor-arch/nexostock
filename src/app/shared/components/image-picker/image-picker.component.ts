import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cloudUploadOutline, imageOutline, swapHorizontalOutline, trashOutline } from 'ionicons/icons';

let nextId = 0;

/**
 * **`<app-image-picker>`** — selector de imagen reutilizable.
 *
 * - Arrastrar y soltar o elegir desde el equipo (botón accesible con teclado).
 * - Muestra la vista previa de la imagen actual o de la elegida.
 * - Es agnóstico: no sube nada; emite el `File` elegido (`fileSelect`) o la
 *   orden de quitar la imagen (`remove`) y el padre decide qué hacer.
 */
@Component({
  selector: 'app-image-picker',
  templateUrl: './image-picker.component.html',
  styleUrls: ['./image-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon, IonSpinner],
})
export class ImagePickerComponent {
  /** URL de la imagen a mostrar (actual o vista previa) */
  readonly previewUrl = input<string | null>(null);
  /** Texto alternativo de la vista previa */
  readonly alt = input('Imagen del producto');
  /** Etiqueta visible del campo */
  readonly label = input('Imagen');
  readonly disabled = input(false);
  /** Procesando la imagen (muestra un indicador) */
  readonly busy = input(false);
  /** Mensaje de error a mostrar bajo el selector */
  readonly error = input<string | null>(null);

  /** Se emite con el archivo elegido o soltado */
  readonly fileSelect = output<File>();
  /** Se emite al pulsar «Quitar imagen» */
  readonly remove = output<void>();

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly uid = `img-${++nextId}`;
  protected readonly dragging = signal(false);

  constructor() {
    addIcons({ cloudUploadOutline, imageOutline, swapHorizontalOutline, trashOutline });
  }

  protected browse(): void {
    if (!this.disabled()) this.fileInput().nativeElement.click();
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.fileSelect.emit(file);
    input.value = ''; // permite volver a elegir el mismo archivo
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && !this.disabled()) this.fileSelect.emit(file);
  }
}
