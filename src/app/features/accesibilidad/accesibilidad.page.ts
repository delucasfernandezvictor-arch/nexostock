import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonLabel, IonSegment, IonSegmentButton, IonToggle } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { contrastOutline, moonOutline, phonePortraitOutline, sunnyOutline, textOutline, removeOutline, addOutline } from 'ionicons/icons';
import { ThemePref, UiStore } from '../../core/state/ui.store';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * **Accesibilidad**: preferencias de visualización (tamaño de texto, tema,
 * alto contraste) y declaración de conformidad con WCAG 2.2 AA.
 */
@Component({
  selector: 'app-accesibilidad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel, IonToggle, PageHeaderComponent],
  template: `
    <app-page-header title="Accesibilidad" />
    <ion-content>
      <div class="page narrow">
        <section class="panel" aria-labelledby="pref-title">
          <h2 id="pref-title">Preferencias de visualización</h2>

          <div class="pref">
            <h3 id="font-label"><ion-icon name="text-outline" aria-hidden="true"></ion-icon> Tamaño del texto</h3>
            <div class="font-ctrl" role="group" aria-labelledby="font-label">
              <ion-button fill="outline" (click)="ui.stepFont(-1)" [disabled]="ui.fontScale() <= 0.875" aria-label="Reducir tamaño del texto">
                <ion-icon slot="icon-only" name="remove-outline" aria-hidden="true"></ion-icon>
              </ion-button>
              <output aria-live="polite">{{ ui.fontPercent() }} %</output>
              <ion-button fill="outline" (click)="ui.stepFont(1)" [disabled]="ui.fontScale() >= 1.5" aria-label="Aumentar tamaño del texto">
                <ion-icon slot="icon-only" name="add-outline" aria-hidden="true"></ion-icon>
              </ion-button>
              <ion-button fill="clear" (click)="ui.resetFont()">Restablecer</ion-button>
            </div>
          </div>

          <div class="pref">
            <h3 id="theme-label"><ion-icon name="moon-outline" aria-hidden="true"></ion-icon> Tema</h3>
            <ion-segment [value]="ui.theme()" (ionChange)="setTheme($event.detail.value)" aria-labelledby="theme-label">
              <ion-segment-button value="system"><ion-icon name="phone-portrait-outline" aria-hidden="true"></ion-icon><ion-label>Sistema</ion-label></ion-segment-button>
              <ion-segment-button value="light"><ion-icon name="sunny-outline" aria-hidden="true"></ion-icon><ion-label>Claro</ion-label></ion-segment-button>
              <ion-segment-button value="dark"><ion-icon name="moon-outline" aria-hidden="true"></ion-icon><ion-label>Oscuro</ion-label></ion-segment-button>
            </ion-segment>
          </div>

          <div class="pref">
            <ion-toggle [checked]="ui.highContrast()" (ionChange)="ui.toggleHighContrast()" labelPlacement="start" justify="space-between">
              <span class="toggle-label"><ion-icon name="contrast-outline" aria-hidden="true"></ion-icon> Alto contraste (bordes y textos reforzados)</span>
            </ion-toggle>
          </div>
          <p class="muted">Las preferencias se guardan en este navegador.</p>
        </section>

        <section class="panel declaracion" aria-labelledby="decl-title">
          <h2 id="decl-title">Declaración de accesibilidad</h2>
          <p>NexoStock se ha diseñado para cumplir las pautas <strong>WCAG 2.2 nivel AA</strong>:</p>
          <ul>
            <li><strong>Perceptible:</strong> contraste mínimo de 4,5:1 en texto, estados que no dependen solo del color (icono y texto), gráficos con resumen textual y tabla de datos alternativa, texto redimensionable hasta el 200 % sin pérdida de contenido.</li>
            <li><strong>Operable:</strong> todas las funciones se pueden usar con teclado, con orden de tabulación lógico y foco visible. Hay un enlace para saltar al contenido, no hay límites de tiempo y se respeta «reducir movimiento».</li>
            <li><strong>Comprensible:</strong> idioma declarado (es), etiquetas visibles en todos los campos, mensajes de error concretos junto a cada campo y validación en vivo.</li>
            <li><strong>Robusto:</strong> HTML semántico (main, nav, h1–h3, tablas con caption y scope) y atributos WAI-ARIA (aria-live, aria-sort, aria-current, aria-expanded, aria-pressed) para tecnologías de asistencia.</li>
          </ul>
          <h3>Atajos de teclado</h3>
          <dl class="keys">
            <div><dt><kbd>Tab</kbd> / <kbd>Mayús</kbd>+<kbd>Tab</kbd></dt><dd>Moverse entre elementos</dd></div>
            <div><dt><kbd>Enter</kbd> / <kbd>Espacio</kbd></dt><dd>Activar botones, enlaces y filas</dd></div>
            <div><dt><kbd>Esc</kbd></dt><dd>Cerrar diálogos, menús y desplegables</dd></div>
            <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Cambiar de opción en los selectores segmentados</dd></div>
          </dl>
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    h2 { margin: 0 0 1rem; font-size: 1.15rem; }
    .pref { padding: .75rem 0; border-bottom: 1px solid var(--app-border); }
    .pref h3 { display: flex; align-items: center; gap: .4rem; margin: 0 0 .5rem; font-size: 1rem; }
    .font-ctrl { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    output { min-width: 4rem; text-align: center; font-weight: 700; font-size: 1.1rem; }
    .toggle-label { display: inline-flex; align-items: center; gap: .4rem; font-weight: 600; }
    .declaracion ul { padding-left: 1.2rem; line-height: 1.6; }
    .declaracion h3 { font-size: 1rem; margin: 1rem 0 .5rem; }
    .keys { margin: 0; display: grid; gap: .4rem; }
    .keys div { display: flex; flex-wrap: wrap; gap: .5rem 1rem; }
    .keys dt { min-width: 11rem; }
    .keys dd { margin: 0; color: var(--app-muted); }
    kbd { display: inline-block; padding: .05rem .4rem; border: 1px solid var(--app-border-strong); border-radius: .3rem; font-size: .85em; background: var(--app-surface-2); }
  `,
})
export class AccesibilidadPage {
  protected readonly ui = inject(UiStore);

  constructor() {
    addIcons({ contrastOutline, moonOutline, phonePortraitOutline, sunnyOutline, textOutline, removeOutline, addOutline });
  }

  protected setTheme(v: unknown): void {
    this.ui.setTheme((v as ThemePref) ?? 'system');
  }
}
