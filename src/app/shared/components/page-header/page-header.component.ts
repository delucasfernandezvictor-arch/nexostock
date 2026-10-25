import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonBackButton, IonButtons, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * **`<app-page-header>`** — cabecera común de las páginas internas.
 * El título se renderiza como `<h1>` (jerarquía de encabezados correcta) y
 * admite botones adicionales en el extremo derecho mediante `<ng-content>`.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonBackButton],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          @if (backHref()) {
            <ion-back-button [defaultHref]="backHref()" text="" aria-label="Volver"></ion-back-button>
          } @else {
            <ion-menu-button aria-label="Abrir menú de navegación"></ion-menu-button>
          }
        </ion-buttons>
        <ion-title><h1 class="page-title" tabindex="-1">{{ title() }}</h1></ion-title>
        <ion-buttons slot="end"><ng-content /></ion-buttons>
      </ion-toolbar>
    </ion-header>
  `,
  styles: `
    :host { display: contents; }
    .page-title { margin: 0; font-size: 1.125rem; font-weight: 700; line-height: 1.3; outline: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  /** Si se indica, muestra un botón "Volver" en lugar del menú */
  readonly backHref = input<string | null>(null);
}
