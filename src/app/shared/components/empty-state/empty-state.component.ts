import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/**
 * **`<app-empty-state>`** — mensaje para listas vacías o errores de carga.
 * Proyecta (`<ng-content>`) los botones de acción que quiera el padre.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <div class="empty" [attr.role]="tone() === 'error' ? 'alert' : null">
      <ion-icon [name]="icon()" aria-hidden="true" [class.error]="tone() === 'error'"></ion-icon>
      <h2>{{ title() }}</h2>
      @if (message()) { <p>{{ message() }}</p> }
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: .5rem; padding: 2.5rem 1rem; }
    ion-icon { font-size: 3rem; color: var(--app-muted); }
    ion-icon.error { color: var(--app-text-danger); }
    h2 { margin: 0; font-size: 1.125rem; }
    p { margin: 0; color: var(--app-muted); max-width: 32rem; }
    .actions { margin-top: .5rem; display: flex; gap: .5rem; flex-wrap: wrap; justify-content: center; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('file-tray-outline');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly tone = input<'info' | 'error'>('info');
}
