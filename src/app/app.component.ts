import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonApp, IonProgressBar, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline, closeOutline, informationCircleOutline, settingsOutline } from 'ionicons/icons';
import { NotifyService } from './core/services/notify.service';
import { SupabaseClientService } from './core/services/supabase-client.service';
import { AuthStore } from './core/state/auth.store';
import { UiStore } from './core/state/ui.store';

/**
 * Componente raíz. Contiene:
 *  - la barra de progreso global (peticiones HTTP en curso),
 *  - la región `aria-live` donde se anuncian mensajes a lectores de pantalla,
 *  - la pantalla de "configuración pendiente" si faltan las variables de entorno.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet, IonProgressBar],
  template: `
    <ion-app>
      @if (ui.busy()) {
        <ion-progress-bar type="indeterminate" class="global-progress" aria-label="Cargando datos"></ion-progress-bar>
      }
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ notify.announcement() }}</div>

      @if (configured) {
        <ion-router-outlet></ion-router-outlet>
      } @else {
        <main class="config-missing">
          <h1>NexoStock</h1>
          <p>La aplicación no tiene configurada la conexión con Supabase.</p>
          <p>Define las variables <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> y vuelve a compilar (ver README).</p>
        </main>
      }
    </ion-app>
  `,
  styles: `
    .global-progress { position: fixed; top: 0; left: 0; right: 0; z-index: 9999; }
    .config-missing { max-width: 36rem; margin: 15vh auto; padding: 1rem; text-align: center; }
  `,
})
export class AppComponent {
  protected readonly ui = inject(UiStore);
  protected readonly notify = inject(NotifyService);
  protected readonly configured = inject(SupabaseClientService).configured;

  constructor() {
    // Instancia el store de sesión lo antes posible (recupera la sesión guardada)
    inject(AuthStore);
    addIcons({ alertCircleOutline, checkmarkCircleOutline, closeOutline, informationCircleOutline, settingsOutline });
  }
}
