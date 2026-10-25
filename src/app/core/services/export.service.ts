import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/core';
import { ExportColumn, fileName, toCsv } from '../utils/csv';
import { formatDateTime } from '../utils/format';

/** Indicador destacado en la cabecera del informe PDF. */
export interface ReportKpi {
  label: string;
  value: string;
}

/** Definición de un informe tabulado. */
export interface ReportDefinition<T> {
  /** Título del informe (también da nombre al fichero) */
  title: string;
  /** Subtítulo: filtros aplicados, periodo... */
  subtitle?: string;
  columns: readonly ExportColumn<T>[];
  rows: readonly T[];
  /** Indicadores resumen que se muestran sobre la tabla */
  kpis?: readonly ReportKpi[];
  /** Fila de totales (una celda por columna) */
  totals?: readonly (string | number)[];
  /** Autor que genera el informe */
  author?: string;
  orientation?: 'portrait' | 'landscape';
}

/** Colores corporativos del PDF (RGB). */
const BRAND: [number, number, number] = [47, 63, 184];
const INK: [number, number, number] = [30, 34, 48];
const MUTED: [number, number, number] = [95, 100, 112];

/**
 * **Generación y descarga de informes** en formatos estándar:
 *  - **CSV** (RFC 4180, UTF-8 con BOM para Excel).
 *  - **PDF** maquetado: cabecera corporativa, KPIs, tabla con filas alternas,
 *    totales y pie con paginación "Página X de Y".
 *
 * jsPDF se carga bajo demanda (`import()` dinámico) para no penalizar la carga
 * inicial de la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly document = inject(DOCUMENT);

  /** Descarga un CSV con los datos del informe. */
  exportCsv<T>(report: Pick<ReportDefinition<T>, 'title' | 'columns' | 'rows'>): string {
    const csv = toCsv(report.rows, report.columns);
    const name = fileName(report.title, 'csv');
    this.download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), name);
    return name;
  }

  /** Genera y descarga el informe en PDF. */
  async exportPdf<T>(report: ReportDefinition<T>): Promise<string> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: report.orientation ?? 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;

    // --- Cabecera corporativa
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('NexoStock', margin, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Sistema de Gestión de Inventario y Pedidos', margin, 18);
    doc.text(`Generado: ${formatDateTime(new Date())}`, pageW - margin, 12, { align: 'right' });
    if (report.author) doc.text(`Por: ${report.author}`, pageW - margin, 18, { align: 'right' });

    // --- Título y subtítulo
    let y = 37;
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(report.title, margin, y);
    if (report.subtitle) {
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      doc.text(report.subtitle, margin, y);
    }

    // --- Tarjetas KPI
    if (report.kpis?.length) {
      y += 6;
      const gap = 4;
      const w = (pageW - margin * 2 - gap * (report.kpis.length - 1)) / report.kpis.length;
      report.kpis.forEach((k, i) => {
        const x = margin + i * (w + gap);
        doc.setFillColor(240, 242, 252);
        doc.setDrawColor(208, 213, 240);
        doc.roundedRect(x, y, w, 17, 2, 2, 'FD');
        doc.setTextColor(...MUTED);
        doc.setFontSize(8);
        doc.text(k.label.toUpperCase(), x + 4, y + 6);
        doc.setTextColor(...BRAND);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(k.value, x + 4, y + 13);
        doc.setFont('helvetica', 'normal');
      });
      y += 17;
    }

    // --- Tabla
    autoTable(doc, {
      startY: y + 6,
      margin: { left: margin, right: margin, top: 20, bottom: 18 },
      head: [report.columns.map((c) => c.label)],
      body: report.rows.map((r) => report.columns.map((c) => String(c.value(r) ?? ''))),
      foot: report.totals ? [report.totals.map(String)] : undefined,
      showFoot: 'lastPage',
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: INK, overflow: 'linebreak' },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [226, 230, 248], textColor: INK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 248, 252] },
      columnStyles: Object.fromEntries(report.columns.map((c, i) => [i, { halign: c.align ?? 'left' }])),
      didDrawPage: () => {
        // Cabecera reducida en páginas siguientes
        if (doc.getCurrentPageInfo().pageNumber > 1) {
          doc.setFillColor(...BRAND);
          doc.rect(0, 0, pageW, 10, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.text(`NexoStock · ${report.title}`, margin, 6.5);
        }
      },
    });

    // --- Pie con paginación (se dibuja al final para conocer el total)
    const pages = doc.getNumberOfPages();
    const pageH = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(208, 213, 240);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`${report.rows.length} registros · Datos sintéticos de demostración`, margin, pageH - 7);
      doc.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 7, { align: 'right' });
    }

    doc.setProperties({ title: `NexoStock · ${report.title}`, subject: report.subtitle ?? '', author: report.author ?? 'NexoStock', creator: 'NexoStock' });
    const name = fileName(report.title, 'pdf');
    doc.save(name);
    return name;
  }

  /** Fuerza la descarga de un Blob en el navegador. */
  private download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    this.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
