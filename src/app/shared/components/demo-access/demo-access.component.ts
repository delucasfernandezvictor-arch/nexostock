import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDown, checkmarkCircle, peopleOutline, phonePortraitOutline, shieldCheckmark } from 'ionicons/icons';
import { QuickAccount, initials } from '../../../core/config/demo-accounts';

let nextId = 0;

/**
 * **`<app-demo-access>`** — panel de acceso rápido del login.
 *
 * - Tarjeta **Modo administrador**: un clic emite la cuenta de administrador.
 * - Tarjeta **Modo usuario**: abre un desplegable propio con avatar, nombre,
 *   departamento y email de cada cuenta, en dos grupos: las **recordadas en
 *   este dispositivo** (sin contraseña) y las **cuentas de demostración**.
 *
 * El desplegable sigue el patrón *listbox* de WAI-ARIA: se abre con clic, Enter,
 * Espacio o flecha abajo; se recorre con flechas, Inicio y Fin; se elige con
 * Enter o Espacio y se cierra con Esc o al hacer clic fuera, devolviendo el
 * foco al botón. Es agnóstico: recibe las cuentas por `input()` y solo emite
 * `pick`; quien lo usa decide qué hacer con las credenciales.
 */
@Component({
  selector: 'app-demo-access',
  templateUrl: './demo-access.component.html',
  styleUrls: ['./demo-access.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, NgTemplateOutlet],
  host: { '(document:click)': 'onDocumentClick($event)' },
})
export class DemoAccessComponent {
  /** Cuentas disponibles (si está vacío, el componente no muestra nada) */
  readonly accounts = input.required<readonly QuickAccount[]>();
  /** Desactiva las tarjetas (p. ej. mientras se rellena o se inicia sesión) */
  readonly disabled = input(false);
  /** Email de la cuenta elegida actualmente (para marcarla) */
  readonly selectedEmail = input<string | null>(null);

  /** Se emite al elegir una cuenta */
  readonly pick = output<QuickAccount>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly list = viewChild<ElementRef<HTMLDivElement>>('list');

  protected readonly uid = `demo-${++nextId}`;
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly initials = initials;

  protected readonly admin = computed(() => this.accounts().find((a) => !a.recordada && a.role === 'admin') ?? null);
  /** Cuentas recordadas en este dispositivo (primer grupo del desplegable) */
  protected readonly recordadas = computed(() => this.accounts().filter((a) => a.recordada));
  /** Cuentas demo de usuario estándar (segundo grupo) */
  protected readonly demoUsers = computed(() => this.accounts().filter((a) => !a.recordada && a.role === 'user'));
  /** Opciones del desplegable en orden (para el teclado y aria-activedescendant) */
  protected readonly users = computed(() => [...this.recordadas(), ...this.demoUsers()]);
  protected readonly selectedUser = computed(() => this.users().find((u) => u.email === this.selectedEmail()) ?? null);
  protected readonly adminSelected = computed(() => !!this.admin() && this.admin()!.email === this.selectedEmail());

  constructor() {
    addIcons({ chevronDown, checkmarkCircle, peopleOutline, phonePortraitOutline, shieldCheckmark });
  }

  protected toggle(): void {
    if (this.open()) this.close();
    else this.openList();
  }

  protected choose(account: QuickAccount): void {
    if (this.disabled()) return;
    this.close(false);
    this.pick.emit(account);
  }

  protected optionId(i: number): string {
    return `${this.uid}-opt-${i}`;
  }

  protected onTriggerKey(event: KeyboardEvent): void {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      this.openList(event.key === 'ArrowUp' ? this.users().length - 1 : undefined);
    }
  }

  protected onListKey(event: KeyboardEvent): void {
    const last = this.users().length - 1;
    switch (event.key) {
      case 'ArrowDown':
        this.active.set(Math.min(last, this.active() + 1));
        break;
      case 'ArrowUp':
        this.active.set(Math.max(0, this.active() - 1));
        break;
      case 'Home':
        this.active.set(0);
        break;
      case 'End':
        this.active.set(last);
        break;
      case 'Enter':
      case ' ': {
        const u = this.users()[this.active()];
        if (u) this.choose(u);
        break;
      }
      case 'Escape':
        this.close();
        break;
      case 'Tab':
        this.close(false);
        return;
      default:
        return;
    }
    event.preventDefault();
    this.scrollActiveIntoView();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  private openList(start?: number): void {
    if (this.disabled() || !this.users().length) return;
    const sel = this.users().findIndex((u) => u.email === this.selectedEmail());
    this.active.set(start ?? (sel >= 0 ? sel : 0));
    this.open.set(true);
    setTimeout(() => this.list()?.nativeElement.focus());
  }

  private close(returnFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) setTimeout(() => this.trigger()?.nativeElement.focus());
  }

  private scrollActiveIntoView(): void {
    setTimeout(() => document.getElementById(this.optionId(this.active()))?.scrollIntoView?.({ block: 'nearest' }));
  }
}
