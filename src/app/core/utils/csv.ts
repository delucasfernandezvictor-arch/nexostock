/** Columna de exportación tabular (CSV / PDF). */
export interface ExportColumn<T> {
  label: string;
  /** Valor de la celda (texto ya formateado o número) */
  value: (row: T) => string | number | null | undefined;
  /** Alineación en el PDF */
  align?: 'left' | 'right' | 'center';
}

/**
 * Escapa un valor según RFC 4180: si contiene separador, comillas o saltos de
 * línea se envuelve en comillas dobles y las comillas internas se duplican.
 * También neutraliza la **inyección de fórmulas** en hojas de cálculo
 * (valores que empiezan por `= + - @`).
 */
export function escapeCsv(value: unknown, separator = ';'): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'number' ? String(value).replace('.', ',') : String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /["\r\n]/.test(s) || s.includes(separator) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Genera el contenido CSV (separador `;` y coma decimal, compatible con Excel
 * en configuración regional española).
 */
export function toCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[], separator = ';'): string {
  const header = columns.map((c) => escapeCsv(c.label, separator)).join(separator);
  const body = rows.map((r) => columns.map((c) => escapeCsv(c.value(r), separator)).join(separator));
  return [header, ...body].join('\r\n');
}

/** Nombre de fichero seguro con fecha: `informe-pedidos_2026-10-25.csv`. */
export function fileName(base: string, ext: string, date = new Date()): string {
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}_${date.toISOString().slice(0, 10)}.${ext}`;
}
