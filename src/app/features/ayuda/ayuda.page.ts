import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonAccordion, IonAccordionGroup, IonButton, IonContent, IonIcon, IonItem, IonLabel } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  accessibilityOutline, barChartOutline, cartOutline, createOutline, cubeOutline, documentTextOutline, logInOutline, menuOutline,
  peopleOutline, receiptOutline, searchOutline, bulbOutline, arrowForwardOutline,
} from 'ionicons/icons';
import { AuthStore } from '../../core/state/auth.store';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { normalizeText } from '../../shared/components/data-table/data-table.component';
import { AYUDA } from './ayuda.content';

/**
 * **Ayuda**: manual de usuario integrado en la aplicación.
 * Las secciones se filtran por rol y por texto, y cada una enlaza con la
 * pantalla a la que se refiere (ayuda contextual).
 */
@Component({
  selector: 'app-ayuda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IonContent, IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonIcon, IonButton, PageHeaderComponent],
  template: `
    <app-page-header title="Ayuda" />
    <ion-content>
      <div class="page narrow">
        <section class="panel intro">
          <h2>Manual de usuario de NexoStock</h2>
          <p>
            Guía de uso para el rol <strong>{{ auth.isAdmin() ? 'Administrador' : 'Usuario estándar' }}</strong>.
            Busca un tema o despliega una sección.
          </p>
          <label class="search-field" for="ayuda-q">
            <span class="sr-only">Buscar en la ayuda</span>
            <ion-icon name="search-outline" aria-hidden="true"></ion-icon>
            <input id="ayuda-q" type="search" placeholder="Buscar en la ayuda (p. ej. «cancelar», «PDF»)" [(ngModel)]="q" autocomplete="off" />
          </label>
          <p class="sr-only" role="status" aria-live="polite">{{ secciones().length }} secciones encontradas</p>
        </section>

        <ion-accordion-group [multiple]="true" [value]="abiertas()">
          @for (s of secciones(); track s.id) {
            <ion-accordion [value]="s.id">
              <ion-item slot="header">
                <ion-icon slot="start" [name]="s.icon" aria-hidden="true"></ion-icon>
                <ion-label><h3 class="acc-title">{{ s.titulo }}</h3></ion-label>
              </ion-item>
              <div slot="content" class="acc-body">
                <ol>
                  @for (p of s.pasos; track $index) { <li>{{ p }}</li> }
                </ol>
                @if (s.consejo) {
                  <p class="tip"><ion-icon name="bulb-outline" aria-hidden="true"></ion-icon><span><strong>Consejo:</strong> {{ s.consejo }}</span></p>
                }
                @if (s.ruta) {
                  <ion-button fill="outline" size="small" [routerLink]="s.ruta">
                    Ir a la pantalla <ion-icon slot="end" name="arrow-forward-outline" aria-hidden="true"></ion-icon>
                  </ion-button>
                }
              </div>
            </ion-accordion>
          } @empty {
            <p class="muted">No hay resultados para «{{ q() }}».</p>
          }
        </ion-accordion-group>

        <p class="muted foot">
          ¿Necesitas más ayuda? Contacta con el departamento de Sistemas. Versión 1.0.0 ·
          <a href="docs/index.html" target="_blank" rel="noopener">Documentación técnica</a>
        </p>
      </div>
    </ion-content>
  `,
  styles: `
    .intro h2 { margin: 0 0 .35rem; font-size: 1.2rem; }
    .intro p { margin: 0 0 .75rem; color: var(--app-muted); }
    .search-field {
      display: flex; align-items: center; gap: .5rem; min-height: 3rem; padding: 0 .85rem;
      border: 1px solid var(--app-border-strong); border-radius: .5rem; background: var(--app-surface);
      &:focus-within { outline: 3px solid var(--app-focus); outline-offset: 1px; }
      input { flex: 1; min-width: 0; border: 0; background: transparent; color: inherit; font: inherit; &:focus { outline: none; } }
    }
    ion-accordion-group { margin-top: 1rem; }
    ion-accordion { border: 1px solid var(--app-border); border-radius: .75rem; margin-bottom: .6rem; overflow: hidden; }
    .acc-title { margin: 0; font-size: 1rem; font-weight: 600; }
    .acc-body { padding: .25rem 1rem 1rem; }
    ol { margin: .5rem 0 .75rem; padding-left: 1.25rem; line-height: 1.6; }
    .tip { display: flex; gap: .5rem; padding: .65rem .75rem; border-radius: .6rem; background: var(--app-badge-warning-bg); color: var(--app-badge-warning-fg); }
    .tip ion-icon { flex: none; font-size: 1.2rem; }
    .foot { margin-top: 1.5rem; font-size: .875rem; text-align: center; }
  `,
})
export class AyudaPage {
  protected readonly auth = inject(AuthStore);
  protected readonly q = signal('');

  protected readonly secciones = computed(() => {
    const q = normalizeText(this.q().trim());
    return AYUDA.filter((s) => !s.soloAdmin || this.auth.isAdmin()).filter(
      (s) => !q || normalizeText(`${s.titulo} ${s.pasos.join(' ')} ${s.consejo ?? ''}`).includes(q),
    );
  });

  /** Con búsqueda activa se despliegan todas las coincidencias. */
  protected readonly abiertas = computed(() => (this.q().trim() ? this.secciones().map((s) => s.id) : ['acceso']));

  constructor() {
    addIcons({
      accessibilityOutline, barChartOutline, cartOutline, createOutline, cubeOutline, documentTextOutline, logInOutline, menuOutline,
      peopleOutline, receiptOutline, searchOutline, bulbOutline, arrowForwardOutline,
    });
  }
}
