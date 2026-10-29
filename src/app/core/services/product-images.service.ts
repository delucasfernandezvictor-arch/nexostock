import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';
import { ApiError } from '../models';
import { SupabaseClientService } from './supabase-client.service';

/** Bucket de Supabase Storage con las imágenes de producto. */
export const PRODUCT_BUCKET = 'productos';

/** Tamaño máximo del archivo original que acepta el selector (antes de comprimir). */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/** Lado mayor de la imagen optimizada que se sube. */
export const MAX_DIMENSION = 800;

/** Imagen ya optimizada y lista para subir. */
export interface PreparedImage {
  blob: Blob;
  type: string;
  width: number;
  height: number;
}

/**
 * Comprueba que un archivo es una imagen admitida y no es demasiado grande.
 * @returns mensaje de error o `null` si es válido
 */
export function validateImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type)) return 'El archivo debe ser una imagen (PNG, JPG, WebP, GIF o AVIF)';
  if (file.size > MAX_SOURCE_BYTES) return 'La imagen no puede superar 10 MB';
  return null;
}

/** Dimensiones escaladas para que el lado mayor no supere `max` (nunca amplía). */
export function fitWithin(width: number, height: number, max = MAX_DIMENSION): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * **Imágenes de producto en Supabase Storage**.
 *
 * - Antes de subir, la imagen se **redimensiona y convierte a WebP en el
 *   navegador** (canvas), de modo que una foto de varios MB queda en decenas de KB.
 * - Cada subida usa una ruta nueva (`SKU/marca-de-tiempo.webp`): así la URL
 *   pública se puede cachear un año sin servir nunca una imagen antigua.
 * - Los permisos los aplica el servidor (políticas RLS de `storage.objects`):
 *   cualquiera puede ver, solo un administrador puede subir o borrar.
 */
@Injectable({ providedIn: 'root' })
export class ProductImagesService {
  private readonly supa = inject(SupabaseClientService);
  private readonly baseUrl = `${inject(APP_CONFIG).supabaseUrl}/storage/v1/object/public/${PRODUCT_BUCKET}`;

  /** URL pública de una imagen (o null si el producto no tiene). */
  url(path: string | null | undefined): string | null {
    return path ? `${this.baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}` : null;
  }

  /** Redimensiona y comprime la imagen a WebP (o JPEG si el navegador no admite WebP). */
  async prepare(file: File): Promise<PreparedImage> {
    const error = validateImageFile(file);
    if (error) throw { status: 400, message: error } satisfies ApiError;

    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw { status: 500, message: 'El navegador no puede procesar imágenes' } satisfies ApiError;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
    const webp = await toBlob('image/webp');
    const blob = webp?.type === 'image/webp' ? webp : await toBlob('image/jpeg');
    if (!blob) throw { status: 500, message: 'No se pudo procesar la imagen' } satisfies ApiError;
    return { blob, type: blob.type, width, height };
  }

  /** Sube la imagen de un producto y devuelve su ruta en el bucket. */
  async upload(sku: string, image: PreparedImage): Promise<string> {
    const ext = image.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${sku.toUpperCase()}/${Date.now()}.${ext}`;
    const { error } = await this.supa.client.storage
      .from(PRODUCT_BUCKET)
      .upload(path, image.blob, { contentType: image.type, cacheControl: '31536000', upsert: false });
    if (error) throw { status: 400, message: `No se pudo subir la imagen: ${traducir(error.message)}` } satisfies ApiError;
    return path;
  }

  /** Borra una imagen del bucket (no falla si ya no existe). */
  async remove(path: string | null | undefined): Promise<void> {
    if (!path) return;
    const { error } = await this.supa.client.storage.from(PRODUCT_BUCKET).remove([path]);
    if (error) throw { status: 400, message: `No se pudo borrar la imagen: ${traducir(error.message)}` } satisfies ApiError;
  }
}

function traducir(msg: string): string {
  if (/row-level security|unauthorized/i.test(msg)) return 'no tienes permisos (solo administradores)';
  if (/mime type/i.test(msg)) return 'formato no permitido';
  if (/exceeded|too large|size/i.test(msg)) return 'la imagen es demasiado grande';
  return msg;
}
