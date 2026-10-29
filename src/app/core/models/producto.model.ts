/** Categoría de producto (tabla `public.categorias`). */
export interface Categoria {
  id: number;
  nombre: string;
  /** Color hexadecimal usado en gráficos y etiquetas */
  color: string;
}

/** Producto del inventario (tabla `public.productos`). */
export interface Producto {
  id: number;
  sku: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: number;
  precio: number;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  /** Ruta de la imagen en el bucket `productos` de Supabase Storage (null = sin imagen) */
  imagen_path: string | null;
  created_at: string;
  updated_at: string;
  /** Relación embebida por PostgREST (`select=*,categoria:categorias(*)`) */
  categoria?: Categoria;
}

/** Datos editables de un producto (alta / edición). */
export type ProductoInput = Pick<
  Producto,
  'sku' | 'nombre' | 'descripcion' | 'categoria_id' | 'precio' | 'stock' | 'stock_minimo' | 'activo'
> & { imagen_path?: string | null };

/** Estado de stock derivado de `stock` y `stock_minimo`. */
export type NivelStock = 'agotado' | 'bajo' | 'ok';

/**
 * Calcula el nivel de stock de un producto.
 * @param p producto a evaluar
 * @returns `agotado` si no quedan unidades, `bajo` si está en o por debajo del mínimo
 */
export function nivelStock(p: Pick<Producto, 'stock' | 'stock_minimo'>): NivelStock {
  if (p.stock <= 0) return 'agotado';
  if (p.stock <= p.stock_minimo) return 'bajo';
  return 'ok';
}
