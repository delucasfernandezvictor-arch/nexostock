import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableColumn } from '../../../core/models';
import { DataTableComponent, compareValues, normalizeText } from './data-table.component';

interface Fila {
  id: number;
  nombre: string;
  precio: number;
}

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent<Fila>>;
  const columns: TableColumn<Fila>[] = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'precio', label: 'Precio', type: 'number' },
  ];
  const rows: Fila[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, nombre: i === 0 ? 'Cámara' : `Producto ${i + 1}`, precio: (i * 7) % 13 }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(DataTableComponent<Fila>);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('caption', 'Productos');
    fixture.componentRef.setInput('pageSize', 10);
    await fixture.whenStable();
  });

  const bodyRows = () => fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;

  it('pagina los resultados', () => {
    expect(bodyRows().length).toBe(10);
    expect(fixture.nativeElement.textContent).toContain('Página 1 de 3');
  });

  it('busca sin tener en cuenta acentos (two-way binding de search)', async () => {
    fixture.componentRef.setInput('search', 'camara');
    await fixture.whenStable();
    expect(bodyRows().length).toBe(1);
    expect(bodyRows()[0]!.textContent).toContain('Cámara');
  });

  it('ordena por columna y expone aria-sort', async () => {
    const btn = fixture.nativeElement.querySelector('th:nth-child(2) button') as HTMLButtonElement;
    btn.click();
    await fixture.whenStable();
    const th = fixture.nativeElement.querySelector('th:nth-child(2)') as HTMLElement;
    expect(th.getAttribute('aria-sort')).toBe('ascending');
  });

  it('emite rowClick al pulsar Enter en una fila interactiva', async () => {
    fixture.componentRef.setInput('clickableRows', true);
    await fixture.whenStable();
    let clicked: Fila | undefined;
    fixture.componentInstance.rowClick.subscribe((r) => (clicked = r));
    const tr = bodyRows()[0]!;
    tr.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(clicked?.id).toBe(1);
  });

  it('helpers de comparación y normalización', () => {
    expect(normalizeText('ÁrBOL')).toBe('arbol');
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues('Producto 2', 'Producto 10')).toBeLessThan(0);
    expect(compareValues(null, 'a')).toBe(1);
  });
});
