import { DOCUMENT, computed, effect, inject } from '@angular/core';
import { getState, patchState, signalStore, watchState, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';

/** Preferencia de tema. */
export type ThemePref = 'system' | 'light' | 'dark';

/** Escalas de texto disponibles (WCAG 1.4.4: redimensionado hasta 200 %). */
export const FONT_SCALES = [0.875, 1, 1.125, 1.25, 1.5] as const;

interface UiState {
  theme: ThemePref;
  fontScale: number;
  highContrast: boolean;
  /** Peticiones HTTP en curso (barra de progreso global) */
  pending: number;
}

const STORAGE_KEY = 'nexostock.ui';

function readPrefs(): Partial<UiState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<UiState>) : {};
  } catch {
    return {};
  }
}

/**
 * **UiStore** — preferencias de accesibilidad y estado visual global.
 * Aplica al documento el tema (claro/oscuro), la escala tipográfica y el modo
 * de alto contraste, y los persiste por usuario de navegador.
 */
export const UiStore = signalStore(
  { providedIn: 'root' },
  withState<UiState>({ theme: 'system', fontScale: 1, highContrast: false, pending: 0 }),
  withComputed(({ pending, fontScale }) => ({
    busy: computed(() => pending() > 0),
    fontPercent: computed(() => Math.round(fontScale() * 100)),
  })),
  withMethods((store) => ({
    setTheme(theme: ThemePref): void {
      patchState(store, { theme });
    },
    toggleHighContrast(): void {
      patchState(store, { highContrast: !store.highContrast() });
    },
    /** Sube (+1) o baja (-1) un paso la escala de texto. */
    stepFont(step: 1 | -1): void {
      const i = FONT_SCALES.indexOf(store.fontScale() as (typeof FONT_SCALES)[number]);
      const next = FONT_SCALES[Math.min(FONT_SCALES.length - 1, Math.max(0, (i < 0 ? 1 : i) + step))];
      patchState(store, { fontScale: next });
    },
    resetFont(): void {
      patchState(store, { fontScale: 1 });
    },
    requestStarted(): void {
      patchState(store, (s) => ({ pending: s.pending + 1 }));
    },
    requestFinished(): void {
      patchState(store, (s) => ({ pending: Math.max(0, s.pending - 1) }));
    },
  })),
  withHooks({
    onInit(store) {
      const doc = inject(DOCUMENT);
      const prefs = readPrefs();
      patchState(store, {
        theme: prefs.theme ?? 'system',
        fontScale: prefs.fontScale ?? 1,
        highContrast: prefs.highContrast ?? false,
      });

      const media = doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
      const applyTheme = () => {
        const dark = store.theme() === 'dark' || (store.theme() === 'system' && !!media?.matches);
        doc.documentElement.classList.toggle('ion-palette-dark', dark);
      };
      media?.addEventListener?.('change', applyTheme);

      effect(() => {
        applyTheme();
        doc.documentElement.style.fontSize = `${store.fontScale() * 100}%`;
        doc.documentElement.classList.toggle('high-contrast', store.highContrast());
      });

      watchState(store, () => {
        const { theme, fontScale, highContrast } = getState(store);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, fontScale, highContrast }));
        } catch {
          /* sin almacenamiento */
        }
      });
    },
  }),
);
