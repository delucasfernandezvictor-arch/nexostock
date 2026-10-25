import { TestBed } from '@angular/core/testing';
import { CartStore, clampCantidad } from './cart.store';

describe('CartStore', () => {
  const portatil = { id: 1, sku: 'INF-0001', nombre: 'Portátil', precio: 800, stock: 3 };
  const folios = { id: 2, sku: 'PAP-0001', nombre: 'Folios', precio: 5, stock: 100 };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('añade productos y calcula totales', () => {
    const cart = TestBed.inject(CartStore);
    cart.add(portatil);
    cart.add(folios, 10);
    expect(cart.count()).toBe(2);
    expect(cart.unidades()).toBe(11);
    expect(cart.total()).toBe(850);
  });

  it('acumula cantidades y nunca supera el stock', () => {
    const cart = TestBed.inject(CartStore);
    cart.add(portatil, 2);
    cart.add(portatil, 5);
    expect(cart.cantidadDe(1)).toBe(3);
  });

  it('elimina líneas y se vacía', () => {
    const cart = TestBed.inject(CartStore);
    cart.add(portatil);
    cart.add(folios);
    cart.remove(1);
    expect(cart.cantidadDe(1)).toBe(0);
    cart.clear();
    expect(cart.isEmpty()).toBe(true);
  });

  it('clampCantidad limita al rango [1, stock]', () => {
    expect(clampCantidad(0, 5)).toBe(1);
    expect(clampCantidad(9, 5)).toBe(5);
    expect(clampCantidad(Number.NaN, 5)).toBe(1);
  });
});
