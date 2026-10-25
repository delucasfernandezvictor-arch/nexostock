import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonIcon, IonSkeletonText } from '@ionic/angular';
import { formatCompact, formatCurrency, formatNumber } from '../../../core/utils/format';

/** Formato del valor de un KPI. */
export type KpiFormat = 'number' | 'currency' | 'compact' | 'percent' | 'text';

/** Tono visual del KPI. */
export type KpiTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * **`<app-kpi-card>`** — widget estadístico reutilizable.
 *
 * Muestra un indicador con icono, valor formateado, tendencia respecto al
 * periodo anterior y texto de ayuda. Si `interactive` es `true` se renderiza
 * como `<button>` y emite `selected` al pulsarlo (p. ej. para filtrar el
 * dashboard por ese indicador).
 */
@Component({
  selector: 'app-kpi-card',
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, IonIcon, IonSkeletonText],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number | string | null>();
  readonly format = input<KpiFormat>('number');
  /** Nombre de icono de Ionicons (debe estar registrado con `addIcons`) */
  readonly icon = input('stats-chart-outline');
  readonly tone = input<KpiTone>('primary');
  /** Variación porcentual respecto al periodo anterior (null = sin dato) */
  readonly trend = input<number | null>(null);
  /** Si true, una tendencia negativa es buena (p. ej. cancelaciones) */
  readonly invertTrend = input(false);
  readonly hint = input<string>('');
  readonly loading = input(false);
  readonly interactive = input(false);
  /** Estado seleccionado (cuando actúa como filtro) */
  readonly active = input(false);

  /** Se emite al pulsar la tarjeta interactiva */
  readonly selected = output<void>();

  protected readonly display = computed(() => {
    const v = this.value();
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string') return v;
    switch (this.format()) {
      case 'currency':
        return formatCurrency(v);
      case 'compact':
        return formatCompact(v);
      case 'percent':
        return `${formatNumber(v)} %`;
      default:
        return formatNumber(v);
    }
  });

  protected readonly trendInfo = computed(() => {
    const t = this.trend();
    if (t === null || !Number.isFinite(t)) return null;
    const up = t >= 0;
    const good = this.invertTrend() ? !up : up;
    return {
      text: `${up ? '+' : ''}${formatNumber(Math.round(t * 10) / 10)} %`,
      sr: `${up ? 'sube' : 'baja'} un ${formatNumber(Math.abs(Math.round(t * 10) / 10))} % respecto al periodo anterior`,
      arrow: up ? '▲' : '▼',
      good,
    };
  });
}
