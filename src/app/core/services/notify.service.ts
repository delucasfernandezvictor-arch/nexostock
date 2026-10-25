import { Injectable, inject, signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { errorMessage } from '../models';

/**
 * Notificaciones al usuario.
 * Además del *toast* visual, publica el mensaje en una región `aria-live`
 * (ver `AppComponent`) para que los lectores de pantalla lo anuncien.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly toastCtrl = inject(ToastController);

  /** Último mensaje anunciado (región aria-live global). */
  readonly announcement = signal('');

  /** Mensaje de éxito. */
  success(message: string): Promise<void> {
    return this.show(message, 'success', 'checkmark-circle-outline');
  }

  /** Mensaje informativo. */
  info(message: string): Promise<void> {
    return this.show(message, 'primary', 'information-circle-outline');
  }

  /** Mensaje de error (acepta cualquier error y extrae su texto). */
  error(error: unknown): Promise<void> {
    return this.show(typeof error === 'string' ? error : errorMessage(error), 'danger', 'alert-circle-outline', 5000);
  }

  /** Solo anuncia al lector de pantalla, sin toast visual. */
  announce(message: string): void {
    this.announcement.set('');
    setTimeout(() => this.announcement.set(message), 50);
  }

  private async show(message: string, color: string, icon: string, duration = 3000): Promise<void> {
    this.announce(message);
    const toast = await this.toastCtrl.create({
      message,
      color,
      icon,
      duration,
      position: 'bottom',
      buttons: [{ icon: 'close-outline', role: 'cancel', side: 'end', htmlAttributes: { 'aria-label': 'Cerrar aviso' } }],
    });
    await toast.present();
  }
}
