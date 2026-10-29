import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';

/**
 * Maquetación compartida de las pantallas de acceso: panel de marca (solo en
 * pantallas anchas) + tarjeta con el formulario. Mobile-first con CSS Grid.
 * Si se indica `backLink`, muestra un enlace «Volver» en la parte superior.
 */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonIcon],
  template: `
    <div class="auth-grid">
      <aside class="auth-brand" aria-hidden="true">
        <div class="auth-brand-inner">
          <span class="logo">N</span>
          <p class="brand-name">NexoStock</p>
          <p class="brand-claim">Inventario, pedidos y métricas de tu empresa en tiempo real.</p>
          <ul>
            <li>Catálogo y stock sincronizados</li>
            <li>Pedidos con trazabilidad completa</li>
            <li>Cuadro de mando e informes PDF / CSV</li>
          </ul>
        </div>
      </aside>
      <div class="auth-main">
        <div class="auth-card">
          @if (backLink()) {
            <a class="back-link" [routerLink]="backLink()"><ion-icon name="arrow-back-outline" aria-hidden="true"></ion-icon>{{ backLabel() }}</a>
          }
          <p class="auth-logo-mobile"><span class="logo small" aria-hidden="true">N</span> NexoStock</p>
          <h1>{{ title() }}</h1>
          @if (subtitle()) { <p class="auth-subtitle">{{ subtitle() }}</p> }
          <ng-content />
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; min-height: 100%; }
    .auth-grid { display: grid; min-height: 100vh; min-height: 100dvh; grid-template-columns: 1fr; }
    .auth-brand { display: none; }
    .auth-main { display: flex; align-items: center; justify-content: center; padding: 1.5rem 1rem; }
    .auth-card {
      width: 100%; max-width: 27rem; padding: 1.75rem 1.5rem;
      border-radius: 1.1rem; background: var(--app-surface); border: 1px solid var(--app-border);
      box-shadow: 0 10px 30px rgb(15 23 42 / 8%);
    }
    h1 { margin: .25rem 0 .25rem; font-size: 1.6rem; font-weight: 800; }
    .back-link {
      display: inline-flex; align-items: center; gap: .4rem; min-height: 2.75rem; margin: -.5rem 0 .5rem -.5rem; padding: 0 .6rem;
      border-radius: .6rem; color: var(--app-text-primary); font-weight: 700; text-decoration: none;
      ion-icon { font-size: 1.15rem; transition: transform .15s ease; }
      &:hover { background: var(--app-hover); ion-icon { transform: translateX(-3px); } }
      &:focus-visible { outline: 3px solid var(--app-focus); outline-offset: 2px; }
    }
    .auth-subtitle { margin: 0 0 1.25rem; color: var(--app-muted); }
    .auth-logo-mobile { display: flex; align-items: center; gap: .5rem; margin: 0 0 .75rem; font-weight: 800; color: var(--app-text-primary); }
    .logo {
      display: grid; place-items: center; width: 3.5rem; height: 3.5rem; border-radius: 1rem;
      background: #fff; color: #2f3fb8; font-size: 2rem; font-weight: 900;
    }
    .logo.small { width: 2rem; height: 2rem; font-size: 1.1rem; border-radius: .55rem; background: var(--ion-color-primary); color: #fff; }
    @media (min-width: 992px) {
      .auth-grid { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); }
      .auth-brand {
        display: flex; align-items: center; padding: 3rem;
        background: linear-gradient(150deg, #1f2a86 0%, #2f3fb8 55%, #0b7a75 140%); color: #fff;
      }
      .auth-brand-inner { max-width: 26rem; }
      .brand-name { margin: 1rem 0 .25rem; font-size: 2.25rem; font-weight: 800; }
      .brand-claim { margin: 0 0 1.5rem; font-size: 1.15rem; line-height: 1.5; }
      ul { margin: 0; padding-left: 1.2rem; line-height: 2; }
      .auth-logo-mobile { display: none; }
      .auth-card { padding: 2.25rem 2rem; }
    }
  `,
})
export class AuthLayoutComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  /** Ruta del enlace «Volver» (sin valor no se muestra) */
  readonly backLink = input<string | null>(null);
  readonly backLabel = input('Volver');

  constructor() {
    addIcons({ arrowBackOutline });
  }
}
