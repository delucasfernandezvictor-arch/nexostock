import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logInOutline, mailOutline, lockClosedOutline, alertCircleOutline, timeOutline } from 'ionicons/icons';
import { AuthStore } from '../../../core/state/auth.store';
import { errorText } from '../../../core/validators/validators';
import { AuthLayoutComponent } from '../auth-layout.component';

/**
 * Pantalla de **inicio de sesión** (formulario reactivo).
 * Tras autenticar redirige a la ruta solicitada originalmente (`?redirect=`)
 * siempre que sea una ruta interna (evita *open redirects*).
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['../auth.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IonContent, IonInput, IonInputPasswordToggle, IonButton, IonIcon, IonSpinner, AuthLayoutComponent],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthStore);

  /** Ruta a la que volver tras el login (query param, vía `withComponentInputBinding`) */
  readonly redirect = input<string | undefined>(undefined);
  /** Indica que la sesión anterior caducó */
  readonly expired = input<string | undefined>(undefined);

  protected readonly submitted = signal(false);
  protected readonly errorText = errorText;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    addIcons({ logInOutline, mailOutline, lockClosedOutline, alertCircleOutline, timeOutline });
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
    } catch {
      return; // El mensaje queda en auth.error() y se muestra en la plantilla
    }
    // Solo se permiten redirecciones internas (evita open redirects)
    const target = this.redirect() ?? '';
    const safe = /^\/app(\/|$)/.test(target) ? target : '/app/inicio';
    await this.router.navigateByUrl(safe, { replaceUrl: true });
  }
}
