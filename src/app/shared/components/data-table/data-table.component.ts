import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, model, output } from '@angular/core';
import { IonButton, IonIcon, IonSkeletonText } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowDown, arrowUp, chevronBack, chevronForward, swapVertical, searchOutline } from 'ionicons/icons';
import { SortState, TableAction, TableActionEvent, TableColumn } from '../../../core/models';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../../core/utils/format';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

/** Fila preparada para la vista (se calcula una vez por cambio de datos). */
interface ViewRow<T> {
  key: string | number;
  row: T;
  cells: { key: string; text: string; raw: unknown }[];
  actions: TableAction<T>[];
}

let nextId = 0;

/** Normaliza texto para búsquedas sin acentos ni mayúsculas. */
export function normalizeText(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Compara dos valores de celda (números, fechas ISO o texto en castellano). */
export function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

/**
 * **`<app-data-table>`** — tabla de datos avanzada, genérica y reutilizable.
 *
 * Es **agnóstica** de la vista que la contiene: recibe columnas y filas por
 * `input()` y comunica las interacciones con `output()`:
 *  - Búsqueda en vivo con *two-way binding* (`[(search)]`), sin acentos.
 *  - Ordenación por columna (`aria-sort`) y paginación accesible.
 *  - Acciones por fila → evento `action`; clic/Enter en fila → `rowClick`.
 *  - En móvil cada fila se muestra como tarjeta (enfoque *mobile-first*).
 *
 * Usa `ChangeDetectionStrategy.OnPush` y señales `computed` encadenadas: solo
 * se recalcula la etapa afectada (filtrar → ordenar → paginar).
 *
 * @example
 * <app-data-table [columns]="cols" [rows]="productos()" [(search)]="texto"
 *   [actions]="acciones" (action)="onAction($event)" caption="Inventario" />
 */
@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon, IonSkeletonText, StatusBadgeComponent],
})
export class DataTableComponent<T extends object> {
  /** Definición de columnas */
  readonly columns = input.required<readonly TableColumn<T>[]>();
  /** Datos */
  readonly rows = input.required<readonly T[]>();
  /** Acciones disponibles por fila */
  readonly actions = input<readonly TableAction<T>[]>([]);
  /** Título accesible de la tabla (`<caption>`) */
  readonly caption = input.required<string>();
  /** Muestra el caption visualmente (si no, solo para lectores de pantalla) */
  readonly showCaption = input(false);
  /** Propiedad que identifica cada fila */
  readonly rowKey = input<keyof T & string>('id' as keyof T & string);
  readonly pageSize = input(10);
  readonly loading = input(false);
  readonly searchable = input(true);
  readonly searchPlaceholder = input('Buscar…');
  readonly emptyText = input('No hay registros que mostrar');
  /** Las filas son interactivas (emiten `rowClick`) */
  readonly clickableRows = input(false);
  /** Ordenación inicial */
  readonly initialSort = input<SortState | null>(null);

  /** Texto de búsqueda (two-way binding: `[(search)]`) */
  readonly search = model('');

  /** Se emite al activar una fila (clic, Enter o Espacio) */
  readonly rowClick = output<T>();
  /** Se emite al pulsar una acción de fila */
  readonly action = output<TableActionEvent<T>>();
  /** Se emite al cambiar la ordenación */
  readonly sortChange = output<SortState | null>();

  protected readonly uid = `dt-${++nextId}`;

  /** Ordenación actual; se reinicia si cambia la ordenación inicial */
  protected readonly sort = linkedSignal<SortState | null>(() => this.initialSort());

  /** Página actual: vuelve a 0 cuando cambian los datos o la búsqueda */
  protected readonly page = linkedSignal<number>(() => {
    this.rows();
    this.search();
    return 0;
  });

  protected readonly filtered = computed(() => {
    const q = normalizeText(this.search().trim());
    const rows = this.rows();
    if (!q) return rows;
    const cols = this.columns().filter((c) => c.searchable !== false);
    return rows.filter((r) => cols.some((c) => normalizeText(this.text(r, c)).includes(q)));
  });

  protected readonly sorted = computed(() => {
    const s = this.sort();
    const rows = [...this.filtered()];
    if (!s) return rows;
    const dir = s.direction === 'asc' ? 1 : -1;
    return rows.sort((a, b) => dir * compareValues((a as Record<string, unknown>)[s.key], (b as Record<string, unknown>)[s.key]));
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize())));

  protected readonly viewRows = computed<ViewRow<T>[]>(() => {
    const size = this.pageSize();
    const start = Math.min(this.page(), this.totalPages() - 1) * size;
    const cols = this.columns();
    const acts = this.actions();
    const key = this.rowKey();
    return this.sorted()
      .slice(start, start + size)
      .map((row, i) => ({
        key: ((row as Record<string, unknown>)[key] as string | number) ?? start + i,
        row,
        cells: cols.map((c) => ({ key: c.key, text: this.text(row, c), raw: (row as Record<string, unknown>)[c.key] })),
        actions: acts.filter((a) => !a.visible || a.visible(row)),
      }));
  });

  protected readonly rangeText = computed(() => {
    const total = this.sorted().length;
    if (!total) return 'Sin resultados';
    const size = this.pageSize();
    const start = Math.min(this.page(), this.totalPages() - 1) * size;
    return `Mostrando ${start + 1}–${Math.min(start + size, total)} de ${total}`;
  });

  protected readonly skeletonRows = Array.from({ length: 5 });

  constructor() {
    addIcons({ arrowDown, arrowUp, chevronBack, chevronForward, swapVertical, searchOutline });
  }

  /** Texto formateado de una celda. */
  protected text(row: T, col: TableColumn<T>): string {
    if (col.format) return col.format(row);
    const v = (row as Record<string, unknown>)[col.key];
    if (v === null || v === undefined) return '—';
    switch (col.type) {
      case 'currency':
        return formatCurrency(Number(v));
      case 'number':
        return formatNumber(Number(v));
      case 'date':
        return formatDate(String(v));
      case 'datetime':
        return formatDateTime(String(v));
      default:
        return String(v);
    }
  }

  protected align(col: TableColumn<T>): string {
    return col.align ?? (col.type === 'number' || col.type === 'currency' ? 'end' : 'start');
  }

  protected ariaSort(col: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (col.sortable === false) return null;
    const s = this.sort();
    if (s?.key !== col.key) return 'none';
    return s.direction === 'asc' ? 'ascending' : 'descending';
  }

  /** Ciclo de ordenación: ascendente → descendente → sin ordenar. */
  protected toggleSort(col: TableColumn<T>): void {
    if (col.sortable === false) return;
    const s = this.sort();
    const next: SortState | null =
      s?.key !== col.key ? { key: col.key, direction: 'asc' } : s.direction === 'asc' ? { key: col.key, direction: 'desc' } : null;
    this.sort.set(next);
    this.sortChange.emit(next);
  }

  protected goTo(page: number): void {
    this.page.set(Math.max(0, Math.min(page, this.totalPages() - 1)));
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onRowKey(event: KeyboardEvent, row: T): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.rowClick.emit(row);
    }
  }

  protected onRowClick(event: Event, row: T): void {
    if ((event.target as HTMLElement).closest('button, ion-button, a')) return;
    if (this.clickableRows()) this.rowClick.emit(row);
  }

  protected emitAction(event: Event, action: TableAction<T>, row: T): void {
    event.stopPropagation();
    this.action.emit({ action: action.id, row });
  }

  protected labelFor(row: ViewRow<T>): string {
    return row.cells[0]?.text ?? '';
  }
}
