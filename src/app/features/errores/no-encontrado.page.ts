import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { compassOutline } from 'ionicons/icons';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

/** Página 404. */
@Component({
  selector: 'app-no-encontrado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonContent, IonButton, EmptyStateComponent],
  template: `
    <ion-content>
      <div class="nf">
        <h1 class="sr-only">Página no encontrada</h1>
        <app-empty-state icon="compass-outline" title="Error 404 · Página no encontrada" message="La dirección no existe o ha cambiado.">
          <ion-button routerLink="/app/inicio">Ir al inicio</ion-button>
        </app-empty-state>
      </div>
    </ion-content>
  `,
  styles: `.nf { margin-top: 10vh; }`,
})
export class NoEncontradoPage {
  constructor() {
    addIcons({ compassOutline });
  }
}
