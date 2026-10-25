import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Maquetación compartida de las pantallas de acceso: panel de marca (solo en
 * pantallas anchas) + tarjeta con el formulario. Mobile-first con CSS Grid.
 */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
}
