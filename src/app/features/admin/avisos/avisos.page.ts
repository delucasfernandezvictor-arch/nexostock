import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, IonSelect, IonSelectOption, IonSpinner, IonTextarea } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { megaphoneOutline, trashOutline, sendOutline } from 'ionicons/icons';
import { catchError, of } from 'rxjs';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { Aviso, Documento, NivelAviso } from '../../../core/models';
import { NotifyService } from '../../../core/services/notify.service';
import { RealtimeDocsService } from '../../../core/services/realtime-docs.service';
import { formatDateTime } from '../../../core/utils/format';
import { errorText } from '../../../core/validators/validators';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

/**
 * **Avisos** (solo administrador): publica documentos en la colección NoSQL
 * `avisos`. Los documentos son JSON libre (título, texto, nivel, etiquetas) y
 * llegan **al instante** a la pantalla de inicio de todos los usuarios
 * conectados gracias a Supabase Realtime.
 */
@Component({
  selector: 'app-avisos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonContent, IonInput, IonTextarea, IonSelect, IonSelectOption, IonButton, IonIcon, IonSpinner, PageHeaderComponent],
  styleUrls: ['../../auth/auth.scss'],
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
  template: `
    <app-page-header title="Avisos de empresa" />
    <ion-content>
      <div class="page two-cols">
        <form class="panel" [formGroup]="form" (ngSubmit)="publicar()" novalidate aria-labelledby="nuevo-aviso">
          <h2 id="nuevo-aviso">Publicar aviso</h2>
          <ion-input class="field" fill="outline" label="Título" labelPlacement="stacked" formControlName="titulo"
            [counter]="true" maxlength="80" [errorText]="errorText(form.controls.titulo.errors)"></ion-input>
          <ion-textarea class="field" fill="outline" label="Mensaje" labelPlacement="stacked" formControlName="texto" [autoGrow]="true"
            [counter]="true" maxlength="400" [errorText]="errorText(form.controls.texto.errors)"></ion-textarea>
          <ion-select class="field" fill="outline" label="Nivel" labelPlacement="stacked" interface="popover" formControlName="nivel">
            <ion-select-option value="info">Información</ion-select-option>
            <ion-select-option value="exito">Novedad positiva</ion-select-option>
            <ion-select-option value="alerta">Alerta</ion-select-option>
          </ion-select>
          <ion-input class="field" fill="outline" label="Etiquetas (separadas por comas)" labelPlacement="stacked" formControlName="etiquetas"
            helperText="Opcional. Se guardan como array en el documento JSON"></ion-input>
          <ion-button type="submit" expand="block" [disabled]="enviando()">
            @if (enviando()) { <ion-spinner name="crescent" aria-hidden="true"></ion-spinner><span class="sr-only">Publicando…</span> }
            @else { <ion-icon slot="start" name="send-outline" aria-hidden="true"></ion-icon> Publicar }
          </ion-button>
        </form>

        <section class="panel" aria-labelledby="publicados">
          <h2 id="publicados">Publicados</h2>
          <ul class="lista">
            @for (a of avisos() ?? []; track a.id) {
              <li>
                <div>
                  <h3>{{ a.data.titulo }}</h3>
                  <p>{{ a.data.texto }}</p>
                  <p class="muted small">{{ formatDateTime(a.created_at) }} · nivel {{ a.data.nivel }}</p>
                  <details><summary>Ver documento JSON</summary><pre>{{ json(a.data) }}</pre></details>
                </div>
                <ion-button fill="clear" color="danger" (click)="eliminar(a)" [attr.aria-label]="'Eliminar aviso ' + a.data.titulo">
                  <ion-icon slot="icon-only" name="trash-outline" aria-hidden="true"></ion-icon>
                </ion-button>
              </li>
            } @empty {
              <li class="muted">No hay avisos publicados.</li>
            }
          </ul>
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    h2 { margin-top: 0; font-size: 1.1rem; }
    .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .75rem; }
    .lista li { display: flex; justify-content: space-between; gap: .5rem; padding: .75rem; border: 1px solid var(--app-border); border-radius: .75rem; }
    h3 { margin: 0 0 .25rem; font-size: 1rem; }
    p { margin: 0 0 .25rem; }
    .small { font-size: .8125rem; }
    pre { white-space: pre-wrap; font-size: .8rem; background: var(--app-surface-2); padding: .5rem; border-radius: .5rem; }
    summary { cursor: pointer; font-size: .875rem; color: var(--app-text-primary); }
  `,
})
export class AvisosPage implements HasPendingChanges {
  private readonly realtime = inject(RealtimeDocsService);
  private readonly notify = inject(NotifyService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly enviando = signal(false);
  protected readonly errorText = errorText;
  protected readonly formatDateTime = formatDateTime;
  protected readonly avisos = toSignal(this.realtime.collection$<Aviso>('avisos', 50).pipe(catchError(() => of([] as Documento<Aviso>[]))), {
    initialValue: null,
  });

  protected readonly form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(80)]],
    texto: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(400)]],
    nivel: this.fb.control<NivelAviso>('info'),
    etiquetas: [''],
  });

  constructor() {
    addIcons({ megaphoneOutline, trashOutline, sendOutline });
  }

  /** Hay un aviso a medio escribir (lo consulta `pendingChangesGuard`). */
  hasPendingChanges(): boolean {
    return this.form.dirty && !this.enviando();
  }

  /** Aviso nativo del navegador al recargar o cerrar la pestaña con cambios. */
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }

  protected json(v: unknown): string {
    return JSON.stringify(v, null, 2);
  }

  protected async publicar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { titulo, texto, nivel, etiquetas } = this.form.getRawValue();
    const tags = etiquetas.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    this.enviando.set(true);
    try {
      await this.realtime.add<Aviso>('avisos', { titulo: titulo.trim(), texto: texto.trim(), nivel, ...(tags.length ? { etiquetas: tags } : {}) });
      this.form.reset({ titulo: '', texto: '', nivel: 'info', etiquetas: '' });
      void this.notify.success('Aviso publicado para todos los usuarios');
    } catch (e) {
      void this.notify.error(e);
    } finally {
      this.enviando.set(false);
    }
  }

  protected async eliminar(a: Documento<Aviso>): Promise<void> {
    try {
      await this.realtime.remove(a.id);
      void this.notify.success('Aviso eliminado');
    } catch (e) {
      void this.notify.error(e);
    }
  }
}
