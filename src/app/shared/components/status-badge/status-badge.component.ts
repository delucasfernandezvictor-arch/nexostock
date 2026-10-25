import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline, arrowDownOutline, arrowUpOutline, banOutline, checkmarkCircleOutline, checkmarkDoneOutline,
  closeCircleOutline, cubeOutline, flameOutline, removeOutline, timeOutline, warningOutline, shieldCheckmarkOutline, personOutline,
} from 'ionicons/icons';

interface BadgeStyle {
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';
  icon: string;
  label?: string;
}

/** Mapa de valores conocidos → tono, icono y etiqueta legible. */
const STYLES: Record<string, BadgeStyle> = {
  pendiente: { tone: 'warning', icon: 'time-outline', label: 'Pendiente' },
  aprobado: { tone: 'info', icon: 'checkmark-circle-outline', label: 'Aprobado' },
  enviado: { tone: 'primary', icon: 'cube-outline', label: 'Enviado' },
  entregado: { tone: 'success', icon: 'checkmark-done-outline', label: 'Entregado' },
  cancelado: { tone: 'neutral', icon: 'close-circle-outline', label: 'Cancelado' },
  baja: { tone: 'neutral', icon: 'arrow-down-outline', label: 'Baja' },
  normal: { tone: 'info', icon: 'remove-outline', label: 'Normal' },
  alta: { tone: 'warning', icon: 'arrow-up-outline', label: 'Alta' },
  urgente: { tone: 'danger', icon: 'flame-outline', label: 'Urgente' },
  ok: { tone: 'success', icon: 'checkmark-circle-outline', label: 'En stock' },
  bajo: { tone: 'warning', icon: 'warning-outline', label: 'Stock bajo' },
  agotado: { tone: 'danger', icon: 'alert-circle-outline', label: 'Agotado' },
  inactivo: { tone: 'neutral', icon: 'ban-outline', label: 'Inactivo' },
  admin: { tone: 'primary', icon: 'shield-checkmark-outline', label: 'Administrador' },
  user: { tone: 'neutral', icon: 'person-outline', label: 'Usuario estándar' },
};

/**
 * **`<app-status-badge>`** — etiqueta de estado reutilizable.
 * Combina color, icono y **texto** para no transmitir información solo con el
 * color (WCAG 1.4.1 Uso del color).
 */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `<span class="badge" [attr.data-tone]="style().tone">
    <ion-icon [name]="style().icon" aria-hidden="true"></ion-icon>{{ style().label ?? value() }}
  </span>`,
  styles: `
    .badge {
      display: inline-flex; align-items: center; gap: .3rem;
      padding: .15rem .6rem; border-radius: 999px;
      font-size: .8125rem; font-weight: 600; line-height: 1.6; white-space: nowrap;
      background: var(--badge-bg); color: var(--badge-fg); border: 1px solid var(--badge-border);
    }
    [data-tone='neutral'] { --badge-bg: var(--app-badge-neutral-bg); --badge-fg: var(--app-badge-neutral-fg); --badge-border: var(--app-badge-neutral-bd); }
    [data-tone='info']    { --badge-bg: var(--app-badge-info-bg);    --badge-fg: var(--app-badge-info-fg);    --badge-border: var(--app-badge-info-bd); }
    [data-tone='primary'] { --badge-bg: var(--app-badge-primary-bg); --badge-fg: var(--app-badge-primary-fg); --badge-border: var(--app-badge-primary-bd); }
    [data-tone='success'] { --badge-bg: var(--app-badge-success-bg); --badge-fg: var(--app-badge-success-fg); --badge-border: var(--app-badge-success-bd); }
    [data-tone='warning'] { --badge-bg: var(--app-badge-warning-bg); --badge-fg: var(--app-badge-warning-fg); --badge-border: var(--app-badge-warning-bd); }
    [data-tone='danger']  { --badge-bg: var(--app-badge-danger-bg);  --badge-fg: var(--app-badge-danger-fg);  --badge-border: var(--app-badge-danger-bd); }
  `,
})
export class StatusBadgeComponent {
  /** Valor a representar (estado, prioridad, nivel de stock, rol...) */
  readonly value = input.required<string>();

  protected readonly style = computed<BadgeStyle>(() => STYLES[this.value()] ?? { tone: 'neutral', icon: 'remove-outline' });

  constructor() {
    addIcons({
      alertCircleOutline, arrowDownOutline, arrowUpOutline, banOutline, checkmarkCircleOutline, checkmarkDoneOutline,
      closeCircleOutline, cubeOutline, flameOutline, removeOutline, timeOutline, warningOutline, shieldCheckmarkOutline, personOutline,
    });
  }
}
