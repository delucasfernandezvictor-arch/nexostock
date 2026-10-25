import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { lockClosedOutline } from 'ionicons/icons';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Página 403: el rol del usuario no permite acceder a la ruta solicitada. */
@Component({
  selector: 'app-acceso-denegado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonContent, IonButton, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Acceso denegado" />
    <ion-content>
      <app-empty-state icon="lock-closed-outline" title="No tienes permisos para ver esta sección"
        message="Esta pantalla está reservada a administradores. Si crees que deberías tener acceso, contacta con un administrador.">
        <ion-button routerLink="/app/inicio">Volver al inicio</ion-button>
      </app-empty-state>
    </ion-content>
  `,
})
export class AccesoDenegadoPage {
  constructor() {
    addIcons({ lockClosedOutline });
  }
}
