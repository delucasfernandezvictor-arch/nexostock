import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterNextRender, computed, effect, inject, input, output, signal, untracked,
  viewChild,
} from '@angular/core';
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, ChartConfiguration, ChartType, DoughnutController, Filler, Legend,
  LineController, LineElement, LinearScale, PieController, PointElement, Tooltip,
} from 'chart.js';
import { IonSkeletonText } from '@ionic/angular';
import { UiStore } from '../../../core/state/ui.store';
import { formatCurrency, formatNumber } from '../../../core/utils/format';

// Registro selectivo: solo los controladores usados (tree-shaking)
Chart.register(
  BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, PieController, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
);

/** Serie de datos de un gráfico. */
export interface ChartSeries {
  label: string;
  data: number[];
  /** Un color para toda la serie o uno por punto/segmento */
  color?: string | string[];
}

/** Evento al seleccionar una barra, punto o sector. */
export interface ChartSelection {
  index: number;
  label: string;
  value: number;
  series: string;
}

/** Tipos de gráfico soportados. */
export type ChartKind = 'bar' | 'line' | 'doughnut' | 'pie';

let nextId = 0;

/**
 * **`<app-chart-card>`** — tarjeta de gráfico reutilizable basada en Chart.js.
 *
 * - Agnóstica: recibe `labels` y `series` por `input()` y emite
 *   `segmentSelect` al pulsar un elemento (permite *drill-down* desde el padre).
 * - Ciclo de vida: crea el gráfico tras el primer render
 *   (`afterNextRender`), lo **actualiza sin recrearlo** cuando cambian los
 *   datos (`effect`) y lo **destruye en `ngOnDestroy`** para liberar el canvas
 *   y los listeners (evita *memory leaks*).
 * - Accesible: el canvas tiene `role="img"` con un resumen textual y se ofrece
 *   la misma información como tabla de datos navegable por teclado.
 */
@Component({
  selector: 'app-chart-card',
  templateUrl: './chart-card.component.html',
  styleUrls: ['./chart-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonSkeletonText],
})
export class ChartCardComponent implements OnDestroy {
  readonly title = input.required<string>();
  /** Descripción breve que se muestra bajo el título */
  readonly subtitle = input('');
  readonly type = input<ChartKind>('bar');
  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly valueFormat = input<'number' | 'currency'>('number');
  /** Barras horizontales */
  readonly horizontal = input(false);
  readonly stacked = input(false);
  readonly height = input(280);
  readonly loading = input(false);

  /** Se emite al seleccionar un elemento del gráfico o de la tabla de datos */
  readonly segmentSelect = output<ChartSelection>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly ui = inject(UiStore);
  private chart: Chart | null = null;

  protected readonly uid = `chart-${++nextId}`;
  protected readonly showTable = signal(false);

  /** Resumen textual del gráfico para lectores de pantalla. */
  protected readonly summary = computed(() => {
    const labels = this.labels();
    const parts = this.series().map((s) => {
      if (!s.data.length) return `${s.label}: sin datos`;
      const max = Math.max(...s.data);
      const i = s.data.indexOf(max);
      const total = s.data.reduce((a, b) => a + b, 0);
      return `${s.label}: total ${this.fmt(total)}, máximo ${this.fmt(max)} en ${labels[i] ?? ''}`;
    });
    return `${this.title()}. ${parts.join('. ')}.`;
  });

  /** Filas de la tabla de datos alternativa. */
  protected readonly tableRows = computed(() =>
    this.labels().map((label, i) => ({ label, index: i, values: this.series().map((s) => s.data[i] ?? 0) })),
  );

  constructor() {
    afterNextRender(() => this.create());

    // Reacciona a cambios de datos, tipo o tema sin recrear el canvas
    effect(() => {
      const config = this.buildConfig();
      this.ui.theme();
      this.ui.highContrast();
      untracked(() => {
        if (!this.chart) return;
        if ((this.chart.config as { type?: string }).type !== config.type) {
          this.create();
          return;
        }
        this.chart.data = config.data;
        this.chart.options = config.options ?? {};
        this.chart.update();
      });
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  protected toggleTable(): void {
    this.showTable.update((v) => !v);
  }

  protected select(index: number, seriesIndex = 0): void {
    const s = this.series()[seriesIndex];
    if (!s) return;
    this.segmentSelect.emit({ index, label: this.labels()[index] ?? '', value: s.data[index] ?? 0, series: s.label });
  }

  protected fmt(v: number): string {
    return this.valueFormat() === 'currency' ? formatCurrency(v) : formatNumber(v);
  }

  private create(): void {
    this.chart?.destroy();
    const ctx = this.canvas().nativeElement;
    this.chart = new Chart(ctx, this.buildConfig());
  }

  private buildConfig(): ChartConfiguration {
    const type = this.type();
    const circular = type === 'doughnut' || type === 'pie';
    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue('--ion-text-color').trim() || '#1e2230';
    const grid = css.getPropertyValue('--app-border').trim() || '#d9dce6';
    const palette = ['--app-chart-1', '--app-chart-2', '--app-chart-3', '--app-chart-4', '--app-chart-5', '--app-chart-6']
      .map((v) => css.getPropertyValue(v).trim())
      .filter(Boolean);
    const fallback = palette.length ? palette : ['#2f3fb8', '#0b7a75', '#b45309', '#be185d', '#7c3aed', '#15803d'];
    const fmt = (v: number) => this.fmt(v);

    const datasets = this.series().map((s, i) => {
      const color = s.color ?? (circular ? this.labels().map((_, j) => fallback[j % fallback.length]!) : fallback[i % fallback.length]!);
      return {
        label: s.label,
        data: [...s.data],
        backgroundColor: type === 'line' ? `${String(color)}22` : color,
        borderColor: circular ? css.getPropertyValue('--app-surface').trim() || '#fff' : color,
        borderWidth: circular ? 2 : type === 'line' ? 2.5 : 0,
        borderRadius: type === 'bar' ? 6 : 0,
        fill: type === 'line' && this.series().length === 1,
        tension: 0.35,
        pointRadius: type === 'line' ? 3 : 0,
        pointHoverRadius: 6,
      };
    });

    return {
      type: type as ChartType,
      data: { labels: [...this.labels()], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: this.horizontal() ? 'y' : 'x',
        animation: { duration: matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 450 },
        onClick: (_e, elements) => {
          const el = elements[0];
          if (el) this.select(el.index, el.datasetIndex);
        },
        onHover: (e, elements) => {
          const target = e.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        plugins: {
          legend: {
            display: circular || this.series().length > 1,
            position: circular ? 'bottom' : 'top',
            labels: { color: text, usePointStyle: true, boxWidth: 10, font: { size: 12 } },
          },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.dataset.label}: ${fmt(Number(item.raw))}`,
            },
          },
        },
        scales: circular
          ? {}
          : {
              // El eje de categorías conserva el formateador por defecto (etiquetas);
              // solo el eje de valores usa el formato numérico / moneda.
              x: {
                stacked: this.stacked(),
                ticks: this.horizontal() ? { color: text, callback: (v: unknown) => fmt(Number(v)) } : { color: text },
                grid: { color: this.horizontal() ? grid : 'transparent' },
              },
              y: {
                stacked: this.stacked(),
                beginAtZero: true,
                ticks: this.horizontal() ? { color: text } : { color: text, callback: (v: unknown) => fmt(Number(v)) },
                grid: { color: this.horizontal() ? 'transparent' : grid },
              },
            },
      } as ChartConfiguration['options'],
    };
  }
}
