import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon, IonSkeletonText } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addCircleOutline, cartOutline, megaphoneOutline, swapHorizontalOutline, warningOutline, shieldOutline, pulseOutline } from 'ionicons/icons';
import { Documento } from '../../../core/models';
import { timeAgo } from '../../../core/utils/format';

/** Elemento genérico que puede mostrar el feed. */
export interface FeedItem {
  tipo?: string;
  mensaje?: string;
  titulo?: string;
  texto?: string;
  nivel?: string;
  [k: string]: unknown;
}

const ICONS: Record<string, string> = {
  pedido_creado: 'cart-outline',
  pedido_estado: 'swap-horizontal-outline',
  producto_creado: 'add-circle-outline',
  stock_bajo: 'warning-outline',
  rol_cambiado: 'shield-outline',
  aviso: 'megaphone-outline',
};

/**
 * **`<app-activity-feed>`** — lista cronológica de documentos en tiempo real.
 *
 * Recibe documentos NoSQL por `input()` y emite `itemSelect` cuando el usuario
 * activa uno. Refresca los tiempos relativos cada 30 s con un temporizador que
 * se **limpia al destruir el componente** (`DestroyRef.onDestroy`).
 */
@Component({
  selector: 'app-activity-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonSkeletonText],
  template: `
    @if (loading()) {
      @for (s of [1, 2, 3, 4]; track s) {
        <div class="feed-skeleton" aria-hidden="true"><ion-skeleton-text [animated]="true"></ion-skeleton-text></div>
      }
    } @else {
      <ol class="feed" [attr.aria-label]="label()">
        @for (it of view(); track it.id) {
          <li [class.fresh]="it.fresh">
            <button type="button" class="feed-item" (click)="itemSelect.emit(it.doc)">
              <span class="feed-icon" [attr.data-tipo]="it.tipo" aria-hidden="true"><ion-icon [name]="it.icon"></ion-icon></span>
              <span class="feed-text">
                <span class="feed-msg">{{ it.text }}</span>
                <time [attr.datetime]="it.doc.created_at">{{ it.ago }}</time>
              </span>
            </button>
          </li>
        } @empty {
          <li class="feed-empty">{{ emptyText() }}</li>
        }
      </ol>
    }
  `,
  styles: `
    :host { display: block; }
    .feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .25rem; }
    .feed-item {
      display: flex; gap: .75rem; align-items: flex-start; width: 100%; padding: .6rem .5rem;
      border: 0; border-radius: .6rem; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer;
      &:hover { background: var(--app-hover); }
      &:focus-visible { outline: 3px solid var(--app-focus); }
    }
    .fresh .feed-item { animation: flash 2s ease-out; }
    .feed-icon {
      display: grid; place-items: center; flex: none; width: 2.25rem; height: 2.25rem; border-radius: 50%;
      background: var(--app-badge-primary-bg); color: var(--app-badge-primary-fg); font-size: 1.1rem;
    }
    .feed-icon[data-tipo='stock_bajo'] { background: var(--app-badge-warning-bg); color: var(--app-badge-warning-fg); }
    .feed-icon[data-tipo='pedido_creado'] { background: var(--app-badge-success-bg); color: var(--app-badge-success-fg); }
    .feed-text { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
    .feed-msg { font-size: .9375rem; overflow-wrap: anywhere; }
    time { font-size: .8125rem; color: var(--app-muted); }
    .feed-empty { padding: 1rem; color: var(--app-muted); text-align: center; }
    .feed-skeleton { padding: .6rem .5rem; ion-skeleton-text { height: 2.25rem; border-radius: .5rem; } }
    @keyframes flash { from { background: var(--app-badge-success-bg); } to { background: transparent; } }
    @media (prefers-reduced-motion: reduce) { .fresh .feed-item { animation: none; } }
  `,
})
export class ActivityFeedComponent {
  readonly items = input.required<readonly Documento<FeedItem>[]>();
  readonly loading = input(false);
  readonly label = input('Actividad reciente');
  readonly emptyText = input('Todavía no hay actividad');

  /** Se emite al activar un elemento del feed */
  readonly itemSelect = output<Documento<FeedItem>>();

  private readonly now = signal(Date.now());

  protected readonly view = computed(() => {
    const now = this.now();
    return this.items().map((doc) => {
      const tipo = doc.data.tipo ?? (doc.coleccion === 'avisos' ? 'aviso' : 'otro');
      return {
        id: doc.id,
        doc,
        tipo,
        icon: ICONS[tipo] ?? 'pulse-outline',
        text: doc.data.mensaje ?? doc.data.titulo ?? '(sin mensaje)',
        ago: timeAgo(doc.created_at, now),
        fresh: now - new Date(doc.created_at).getTime() < 15_000,
      };
    });
  });

  constructor() {
    addIcons({ addCircleOutline, cartOutline, megaphoneOutline, swapHorizontalOutline, warningOutline, shieldOutline, pulseOutline });
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
