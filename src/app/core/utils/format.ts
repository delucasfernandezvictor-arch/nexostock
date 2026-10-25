/** Formateadores reutilizables con configuración regional española. */

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const month = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' });

/** 1234.5 → "1234,50 €" */
export const formatCurrency = (v: number | null | undefined): string => eur.format(Number(v ?? 0));
/** 1234.5 → "1234,5" */
export const formatNumber = (v: number | null | undefined): string => num.format(Number(v ?? 0));
/** 15300 → "15,3 mil" */
export const formatCompact = (v: number | null | undefined): string => compact.format(Number(v ?? 0));
/** ISO → "25/10/2026" */
export const formatDate = (v: string | Date | null | undefined): string => (v ? date.format(new Date(v)) : '');
/** ISO → "25/10/2026, 12:30" */
export const formatDateTime = (v: string | Date | null | undefined): string => (v ? dateTime.format(new Date(v)) : '');
/** Fecha → "oct 26" */
export const formatMonth = (v: Date): string => month.format(v);

/** Clave `AAAA-MM` de una fecha (agrupación mensual). */
export function monthKey(v: string | Date): string {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Últimos `n` meses (el actual incluido) como fechas del día 1. */
export function lastMonths(n: number, from = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => new Date(from.getFullYear(), from.getMonth() - (n - 1 - i), 1));
}

/** Tiempo relativo legible: "hace 5 min". */
export function timeAgo(v: string | Date, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(v).getTime()) / 1000));
  if (s < 45) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : formatDate(v);
}

/** Primera letra en mayúscula. */
export const capitalize = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
