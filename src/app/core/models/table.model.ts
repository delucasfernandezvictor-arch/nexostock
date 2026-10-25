/** Tipo de dato de una columna: determina el formateo y la ordenación. */
export type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'badge';

/**
 * Definición de una columna para `app-data-table`.
 * @typeParam T tipo de la fila
 */
export interface TableColumn<T = object> {
  /** Clave de la propiedad de la fila */
  key: keyof T & string;
  /** Cabecera visible */
  label: string;
  type?: ColumnType;
  /** Permite ordenar por esta columna (por defecto true) */
  sortable?: boolean;
  /** Participa en la búsqueda de texto (por defecto true) */
  searchable?: boolean;
  /** Oculta la columna en pantallas estrechas */
  hideOnMobile?: boolean;
  /** Función opcional de formateo personalizado */
  format?: (row: T) => string;
  align?: 'start' | 'end' | 'center';
}

/** Acción por fila de `app-data-table`. */
export interface TableAction<T = object> {
  id: string;
  label: string;
  icon: string;
  color?: string;
  /** Si devuelve false, la acción no se muestra para esa fila */
  visible?: (row: T) => boolean;
}

/** Evento emitido cuando se pulsa una acción de fila. */
export interface TableActionEvent<T = object> {
  action: string;
  row: T;
}

/** Estado de ordenación. */
export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}
