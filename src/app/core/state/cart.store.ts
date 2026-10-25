import { computed } from '@angular/core';
import { getState, patchState, signalStore, watchState, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Producto } from '../models';

/** Línea del carrito de pedido. */
export interface LineaCarrito {
  producto: Pick<Producto, 'id' | 'sku' | 'nombre' | 'precio' | 'stock'>;
  cantidad: number;
}

interface CartState {
  lineas: LineaCarrito[];
}

const STORAGE_KEY = 'nexostock.carrito';

function readStorage(): LineaCarrito[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as LineaCarrito[]) : [];
  } catch {
    return [];
  }
}

/** Limita una cantidad al rango [1, stock]. */
export function clampCantidad(cantidad: number, stock: number): number {
  if (!Number.isFinite(cantidad)) return 1;
  return Math.max(1, Math.min(Math.floor(cantidad), Math.max(stock, 1)));
}

/**
 * **CartStore** — carrito del pedido en curso (NgRx Signals Store).
 * Las actualizaciones son inmutables (se crean nuevos arrays) y el estado se
 * persiste en `localStorage` para no perderlo al recargar.
 */
export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>({ lineas: [] }),
  withComputed(({ lineas }) => ({
    total: computed(() => lineas().reduce((acc, l) => acc + l.cantidad * l.producto.precio, 0)),
    unidades: computed(() => lineas().reduce((acc, l) => acc + l.cantidad, 0)),
    count: computed(() => lineas().length),
    isEmpty: computed(() => lineas().length === 0),
  })),
  withMethods((store) => {
    /** Fija la cantidad de una línea. */
    const setCantidad = (productoId: number, cantidad: number): void => {
      patchState(store, {
        lineas: store.lineas().map((l) =>
          l.producto.id === productoId ? { ...l, cantidad: clampCantidad(cantidad, l.producto.stock) } : l,
        ),
      });
    };
    return {
    setCantidad,
    /** Añade un producto (o incrementa su cantidad) respetando el stock. */
    add(producto: LineaCarrito['producto'], cantidad = 1): void {
      const actual = store.lineas().find((l) => l.producto.id === producto.id);
      if (actual) {
        setCantidad(producto.id, actual.cantidad + cantidad);
      } else {
        patchState(store, { lineas: [...store.lineas(), { producto, cantidad: clampCantidad(cantidad, producto.stock) }] });
      }
    },
    /** Elimina una línea. */
    remove(productoId: number): void {
      patchState(store, { lineas: store.lineas().filter((l) => l.producto.id !== productoId) });
    },
    /** Vacía el carrito. */
    clear(): void {
      patchState(store, { lineas: [] });
    },
    /** Cantidad actual de un producto en el carrito (0 si no está). */
    cantidadDe(productoId: number): number {
      return store.lineas().find((l) => l.producto.id === productoId)?.cantidad ?? 0;
    },
    };
  }),
  withHooks({
    onInit(store) {
      patchState(store, { lineas: readStorage() });
      watchState(store, () => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(getState(store).lineas));
        } catch {
          /* almacenamiento no disponible (modo privado): se ignora */
        }
      });
    },
  }),
);
