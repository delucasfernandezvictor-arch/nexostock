import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Observable } from 'rxjs';

/**
 * Contrato que implementa un componente con datos que se pueden perder.
 * El guard no conoce el componente: solo le pregunta si tiene cambios.
 */
export interface HasPendingChanges {
  /** `true` si hay cambios sin guardar (normalmente `form.dirty`) */
  hasPendingChanges(): boolean;
}

/**
 * Pregunta al usuario si quiere descartar los cambios.
 * Usa un diálogo de Ionic (accesible, con foco atrapado y cierre con Esc)
 * en lugar de `window.confirm`.
 */
export async function confirmDiscard(alertCtrl: AlertController): Promise<boolean> {
  const alert = await alertCtrl.create({
    header: 'Cambios sin guardar',
    message: 'Si sales ahora se perderán los cambios del formulario. ¿Quieres descartarlos?',
    buttons: [
      { text: 'Seguir editando', role: 'cancel' },
      { text: 'Descartar cambios', role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  return role === 'destructive';
}

/**
 * **pendingChangesGuard** (`canDeactivate`) — evita perder por accidente lo
 * escrito en un formulario al navegar a otra pantalla (menú, botón Volver,
 * enlace...). Si el componente no tiene cambios, deja salir sin preguntar.
 */
export const pendingChangesGuard: CanDeactivateFn<HasPendingChanges> = (
  component,
): boolean | Promise<boolean> | Observable<boolean> => {
  if (!component?.hasPendingChanges?.()) return true;
  return confirmDiscard(inject(AlertController));
};
