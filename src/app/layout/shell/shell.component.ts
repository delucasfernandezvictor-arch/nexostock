import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, computed, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonMenu,
  IonMenuToggle, IonRouterLink, IonRouterOutlet, IonSplitPane, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  accessibilityOutline, addCircleOutline, barChartOutline, cubeOutline, documentTextOutline, helpCircleOutline, homeOutline,
  logOutOutline, megaphoneOutline, moonOutline, peopleOutline, receiptOutline, sunnyOutline,
} from 'ionicons/icons';
import { Subscription, retry, timer } from 'rxjs';
import { UserRole, codigoPedido } from '../../core/models';
import { NotifyService } from '../../core/services/notify.service';
import { RealtimeDocsService } from '../../core/services/realtime-docs.service';
import { AuthStore } from '../../core/state/auth.store';
import { CartStore } from '../../core/state/cart.store';
import { UiStore } from '../../core/state/ui.store';
import { AsistenteComponent } from '../../features/admin/asistente/asistente.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

/** Entrada del menú lateral. */
interface MenuEntry {
  label: string;
  url: string;
  icon: string;
  /** Roles que ven la entrada (vacío = todos) */
  roles?: UserRole[];
  badge?: () => number;
}

/** Sección del menú lateral. */
interface MenuSection {
  title: string;
  entries: MenuEntry[];
}

/**
 * **Shell** de la aplicación autenticada: navegación global con *Side Menu*
 * (`ion-split-pane`: menú fijo en escritorio, deslizante en móvil).
 *
 * - Filtra las entradas del menú según el rol del usuario.
 * - Escucha en tiempo real los cambios de pedidos para notificar al usuario.
 * - Publica la presencia del usuario (usuarios conectados).
 */
@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, RouterLinkActive, IonRouterLink, IonSplitPane, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
    IonItem, IonIcon, IonLabel, IonMenuToggle, IonRouterOutlet, IonButton, IonBadge, StatusBadgeComponent, AsistenteComponent,
  ],
})
export class ShellComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly cart = inject(CartStore);
  protected readonly ui = inject(UiStore);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeDocsService);
  private readonly notify = inject(NotifyService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly sections: MenuSection[] = [
    {
      title: 'General',
      entries: [
        { label: 'Inicio', url: '/app/inicio', icon: 'home-outline' },
        { label: 'Catálogo', url: '/app/catalogo', icon: 'cube-outline' },
        { label: 'Nuevo pedido', url: '/app/pedidos/nuevo', icon: 'add-circle-outline', badge: () => this.cart.unidades() },
        { label: 'Pedidos', url: '/app/pedidos', icon: 'receipt-outline' },
        { label: 'Informes', url: '/app/informes', icon: 'document-text-outline' },
      ],
    },
    {
      title: 'Administración',
      entries: [
        { label: 'Cuadro de mando', url: '/app/dashboard', icon: 'bar-chart-outline', roles: ['admin'] },
        { label: 'Usuarios y roles', url: '/app/usuarios', icon: 'people-outline', roles: ['admin'] },
        { label: 'Avisos', url: '/app/avisos', icon: 'megaphone-outline', roles: ['admin'] },
      ],
    },
    {
      title: 'Soporte',
      entries: [
        { label: 'Ayuda', url: '/app/ayuda', icon: 'help-circle-outline' },
        { label: 'Accesibilidad', url: '/app/accesibilidad', icon: 'accessibility-outline' },
      ],
    },
  ];

  /** Menú visible para el rol actual. */
  protected readonly menu = computed(() => {
    const role = this.auth.role();
    return this.sections
      .map((s) => ({ ...s, entries: s.entries.filter((e) => !e.roles || (role !== null && e.roles.includes(role))) }))
      .filter((s) => s.entries.length > 0);
  });

  protected readonly isDark = computed(() => this.ui.theme() === 'dark');

  private realtimeSubs: Subscription[] = [];

  constructor() {
    addIcons({
      accessibilityOutline, addCircleOutline, barChartOutline, cubeOutline, documentTextOutline, helpCircleOutline, homeOutline,
      logOutOutline, megaphoneOutline, moonOutline, peopleOutline, receiptOutline, sunnyOutline,
    });

    // (Re)conecta los canales en tiempo real cuando cambia el usuario o su rol
    effect(() => {
      const userId = this.auth.userId();
      const isAdmin = this.auth.isAdmin();
      const nombre = this.auth.displayName();
      const role = this.auth.role();
      this.realtimeSubs.forEach((s) => s.unsubscribe());
      this.realtimeSubs = [];
      if (!userId) return;
      this.realtimeSubs.push(this.watchPedidos(userId, isAdmin));
      this.realtimeSubs.push(
        this.realtime
          .presence$({ user_id: userId, nombre, role: role ?? 'user', online_at: new Date().toISOString() })
          .pipe(retry({ delay: () => timer(5000) }))
          .subscribe((users) => this.realtime.online.set(users)),
      );
    });
    this.destroyRef.onDestroy(() => this.realtimeSubs.forEach((s) => s.unsubscribe()));
  }

  /** Notifica en vivo: al admin los pedidos nuevos, al usuario los cambios en los suyos. */
  private watchPedidos(userId: string, isAdmin: boolean): Subscription {
    return this.realtime
      .tableChanges$('pedidos', isAdmin ? undefined : `usuario_id=eq.${userId}`)
      .pipe(retry({ delay: () => timer(5000) }), takeUntilDestroyed(this.destroyRef))
      .subscribe((change) => {
        const row = change.new as { id?: number; estado?: string; usuario_id?: string };
        const old = change.old as { estado?: string };
        if (!row?.id) return;
        if (change.eventType === 'INSERT' && isAdmin && row.usuario_id !== userId) {
          void this.notify.info(`Nuevo pedido ${codigoPedido(row.id)} recibido`);
        } else if (change.eventType === 'UPDATE' && row.estado !== old?.estado && row.usuario_id === userId && !isAdmin) {
          void this.notify.info(`Tu pedido ${codigoPedido(row.id)} ahora está ${row.estado}`);
        }
      });
  }

  /** Enlace "Saltar al contenido": lleva el foco al título de la página activa. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    const h1 = this.document.querySelector<HTMLElement>('ion-router-outlet#main > .ion-page:not(.ion-page-hidden) h1');
    h1?.focus();
  }

  protected toggleTheme(): void {
    this.ui.setTheme(this.isDark() ? 'light' : 'dark');
  }

  protected async logout(): Promise<void> {
    this.realtimeSubs.forEach((s) => s.unsubscribe());
    this.cart.clear();
    await this.auth.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
    void this.notify.info('Has cerrado sesión');
  }
}
