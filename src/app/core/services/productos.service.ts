import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Categoria, Producto, ProductoInput } from '../models';
import { SKIP_LOADING, SILENT_ERRORS } from '../interceptors/http-context';
import { SqlApiService } from './sql-api.service';

/** Acceso a productos y categorías (origen SQL vía API REST). */
@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly api = inject(SqlApiService);

  /** Lista de productos con su categoría embebida. */
  list(soloActivos = false): Observable<Producto[]> {
    return this.api.select<Producto>('productos', {
      select: '*,categoria:categorias(*)',
      order: 'nombre.asc',
      ...(soloActivos ? { activo: 'eq.true' } : {}),
    });
  }

  /** Obtiene un producto por id. */
  get(id: number): Observable<Producto> {
    return this.api.selectOne<Producto>('productos', { id: `eq.${id}`, select: '*,categoria:categorias(*)' });
  }

  /** Crea un producto (solo admin, lo garantiza RLS). */
  create(input: ProductoInput): Observable<Producto> {
    return this.api.insert<Producto>('productos', normalizar(input));
  }

  /** Actualiza un producto. */
  update(id: number, input: Partial<ProductoInput>): Observable<Producto> {
    return this.api.update<Producto>('productos', { id: `eq.${id}` }, normalizar(input)).pipe(map((rows) => rows[0]!));
  }

  /** Activa o desactiva un producto (borrado lógico). */
  setActivo(id: number, activo: boolean): Observable<Producto> {
    return this.update(id, { activo });
  }

  /** Elimina definitivamente un producto (falla si tiene pedidos asociados: 23503). */
  delete(id: number): Observable<void> {
    return this.api.remove('productos', { id: `eq.${id}` }).pipe(map(() => undefined));
  }

  /**
   * ¿Está libre el SKU? Lo usa la **validación asíncrona** del formulario.
   * @param sku código a comprobar
   * @param excluirId id del producto en edición (su propio SKU es válido)
   */
  skuDisponible(sku: string, excluirId?: number | null): Observable<boolean> {
    return this.api
      .select<{ id: number }>(
        'productos',
        { select: 'id', sku: `eq.${sku.toUpperCase()}`, ...(excluirId ? { id: `neq.${excluirId}` } : {}) },
        { context: new HttpContext().set(SKIP_LOADING, true).set(SILENT_ERRORS, true) },
      )
      .pipe(map((rows) => rows.length === 0));
  }

  /** Categorías ordenadas por nombre. */
  categorias(): Observable<Categoria[]> {
    return this.api.select<Categoria>('categorias', { select: '*', order: 'nombre.asc' });
  }
}

function normalizar<T extends Partial<ProductoInput>>(input: T): T {
  return {
    ...input,
    ...(input.sku !== undefined ? { sku: input.sku.trim().toUpperCase() } : {}),
    ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
    ...(input.descripcion !== undefined ? { descripcion: input.descripcion?.trim() || null } : {}),
  };
}
