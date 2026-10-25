import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AlertController, IonButton, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { shieldCheckmarkOutline, personOutline, refreshOutline } from 'ionicons/icons';
import { Profile, TableAction, TableActionEvent, TableColumn } from '../../../core/models';
import { NotifyService } from '../../../core/services/notify.service';
import { UsuariosService } from '../../../core/services/usuarios.service';
import { AuthStore } from '../../../core/state/auth.store';
import { errorOf, valueOr } from '../../../core/utils/resource';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

/**
 * **Usuarios y roles** (solo administrador): listado de perfiles y cambio de
 * rol mediante la RPC `cambiar_rol`, que valida en el servidor que quien la
 * invoca es administrador y que no se quita el rol a sí mismo.
 */
@Component({
  selector: 'app-usuarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonButton, IonIcon, PageHeaderComponent, DataTableComponent, EmptyStateComponent, KpiCardComponent],
  template: `
    <app-page-header title="Usuarios y roles" />
    <ion-content>
      <div class="page">
        <div class="kpis">
          <app-kpi-card label="Usuarios" [value]="usuarios().length" icon="person-outline" tone="neutral" [loading]="data.isLoading()" />
          <app-kpi-card label="Administradores" [value]="admins()" icon="shield-checkmark-outline" [loading]="data.isLoading()" />
        </div>
        @if (error()) {
          <app-empty-state icon="alert-circle-outline" tone="error" title="No se pudieron cargar los usuarios" [message]="error()">
            <ion-button (click)="data.reload()"><ion-icon slot="start" name="refresh-outline" aria-hidden="true"></ion-icon>Reintentar</ion-button>
          </app-empty-state>
        } @else {
          <app-data-table caption="Usuarios registrados" [columns]="columns" [rows]="usuarios()" [actions]="acciones"
            [loading]="data.isLoading()" searchPlaceholder="Buscar por nombre, email o departamento" (action)="onAction($event)" />
        }
        <p class="muted note">Los cambios de rol se aplican en el servidor (RLS) y surten efecto en la siguiente acción del usuario.</p>
      </div>
    </ion-content>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .note { margin-top: 1rem; font-size: .875rem; }
  `,
})
export class UsuariosPage {
  private readonly usuariosSvc = inject(UsuariosService);
  private readonly notify = inject(NotifyService);
  private readonly alertCtrl = inject(AlertController);
  private readonly auth = inject(AuthStore);

  protected readonly data = rxResource({ stream: () => this.usuariosSvc.list() });
  protected readonly usuarios = valueOr(this.data, [] as Profile[]);
  protected readonly error = errorOf(this.data);
  protected readonly admins = computed(() => this.usuarios().filter((u) => u.role === 'admin').length);

  protected readonly columns: TableColumn<Profile>[] = [
    { key: 'nombre', label: 'Nombre', format: (u) => u.nombre || '—' },
    { key: 'email', label: 'Email' },
    { key: 'departamento', label: 'Departamento', hideOnMobile: true },
    { key: 'role', label: 'Rol', type: 'badge' },
    { key: 'created_at', label: 'Alta', type: 'date', hideOnMobile: true },
  ];

  protected readonly acciones: TableAction<Profile>[] = [
    { id: 'admin', label: 'Hacer administrador', icon: 'shield-checkmark-outline', visible: (u) => u.role !== 'admin' },
    { id: 'user', label: 'Quitar rol de administrador', icon: 'person-outline', color: 'medium', visible: (u) => u.role === 'admin' && u.id !== this.auth.userId() },
  ];

  constructor() {
    addIcons({ shieldCheckmarkOutline, personOutline, refreshOutline });
  }

  protected async onAction(e: TableActionEvent<Profile>): Promise<void> {
    const rol = e.action === 'admin' ? 'admin' : 'user';
    const alert = await this.alertCtrl.create({
      header: 'Cambiar rol',
      message: `¿Asignar el rol "${rol === 'admin' ? 'Administrador' : 'Usuario estándar'}" a ${e.row.nombre || e.row.email}?`,
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Confirmar', role: 'confirm' }],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') return;
    this.usuariosSvc.cambiarRol(e.row.id, rol).subscribe({
      next: () => {
        void this.notify.success('Rol actualizado');
        this.data.reload();
      },
      error: (err) => void this.notify.error(err),
    });
  }
}
