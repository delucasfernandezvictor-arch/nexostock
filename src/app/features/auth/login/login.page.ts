import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonCheckbox, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logInOutline, mailOutline, lockClosedOutline, alertCircleOutline, timeOutline, closeOutline } from 'ionicons/icons';
import { APP_CONFIG } from '../../../core/config/app-config';
import { DemoCredentials, demoCredentials, initials } from '../../../core/config/demo-accounts';
import { NotifyService } from '../../../core/services/notify.service';
import { AuthStore } from '../../../core/state/auth.store';
import { getRememberedEmail, setRememberedEmail } from '../../../core/utils/remember';
import { errorText } from '../../../core/validators/validators';
import { DemoAccessComponent } from '../../../shared/components/demo-access/demo-access.component';
import { AuthLayoutComponent } from '../auth-layout.component';

/** Milisegundos entre caracteres en la animación de tecleo. */
const TYPE_DELAY_MS = 14;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Pantalla de **inicio de sesión** (formulario reactivo).
 *
 * - Tras autenticar redirige a la ruta solicitada originalmente (`?redirect=`)
 *   siempre que sea una ruta interna (evita *open redirects*).
 * - **Acceso rápido de demostración** (`app-demo-access`): rellena email y
 *   contraseña con una animación de tecleo (instantánea si el usuario prefiere
 *   movimiento reducido). Las contraseñas llegan del build, no del repositorio.
 * - **Recordar mi email**: guarda solo el email en este dispositivo.
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['../auth.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, IonContent, IonInput, IonInputPasswordToggle, IonButton, IonIcon, IonSpinner, IonCheckbox,
    AuthLayoutComponent, DemoAccessComponent,
  ],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  protected readonly auth = inject(AuthStore);

  /** Ruta a la que volver tras el login (query param, vía `withComponentInputBinding`) */
  readonly redirect = input<string | undefined>(undefined);
  /** Indica que la sesión anterior caducó */
  readonly expired = input<string | undefined>(undefined);

  private readonly submitButton = viewChild<ElementRef<HTMLElement>>('submitButton');

  protected readonly errorText = errorText;
  protected readonly initials = initials;

  /** Cuentas demo (vacío si el build no incluye sus contraseñas) */
  protected readonly demoAccounts = demoCredentials(inject(APP_CONFIG));
  /** Cuenta demo cargada en el formulario */
  protected readonly demoSelected = signal<DemoCredentials | null>(null);
  /** Animación de tecleo en curso */
  protected readonly filling = signal(false);
  private fillRun = 0;

  private readonly remembered = getRememberedEmail();

  protected readonly form = this.fb.nonNullable.group({
    email: [this.remembered, [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [!!this.remembered],
  });

  constructor() {
    addIcons({ logInOutline, mailOutline, lockClosedOutline, alertCircleOutline, timeOutline, closeOutline });

    // Si el usuario edita el email a mano, deja de ser la cuenta demo cargada
    this.form.controls.email.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((v) => {
      const sel = this.demoSelected();
      if (sel && !this.filling() && v !== sel.email) this.demoSelected.set(null);
    });
  }

  /** Rellena el formulario con una cuenta demo (animación de tecleo). */
  protected async fillDemo(account: DemoCredentials): Promise<void> {
    const run = ++this.fillRun;
    const { email, password } = this.form.controls;
    this.auth.clearError();
    this.demoSelected.set(account);
    this.filling.set(true);

    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      email.setValue(account.email);
      password.setValue(account.password);
    } else {
      email.setValue('');
      password.setValue('');
      for (const [control, text] of [[email, account.email], [password, account.password]] as const) {
        for (let i = 1; i <= text.length; i++) {
          if (run !== this.fillRun) return; // se eligió otra cuenta mientras tanto
          control.setValue(text.slice(0, i));
          await wait(TYPE_DELAY_MS);
        }
      }
    }
    if (run !== this.fillRun) return;

    email.markAsTouched();
    password.markAsTouched();
    this.filling.set(false);
    this.notify.announce(`Credenciales de ${account.nombre} cargadas. Pulsa Entrar para acceder.`);
    this.focusSubmit();
  }

  /** Quita la cuenta demo cargada y vacía la contraseña. */
  protected clearDemo(): void {
    this.fillRun++;
    this.filling.set(false);
    this.demoSelected.set(null);
    this.form.controls.password.setValue('');
    this.notify.announce('Cuenta de demostración retirada');
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.filling()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, remember } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
    } catch {
      return; // El mensaje queda en auth.error() y se muestra en la plantilla
    }
    setRememberedEmail(email, remember);
    // Solo se permiten redirecciones internas (evita open redirects)
    const target = this.redirect() ?? '';
    const safe = /^\/app(\/|$)/.test(target) ? target : '/app/inicio';
    await this.router.navigateByUrl(safe, { replaceUrl: true });
  }

  /** Lleva el foco al botón «Entrar» (el botón real está en el shadow DOM de ion-button). */
  private focusSubmit(): void {
    const host = this.submitButton()?.nativeElement;
    const inner = host?.shadowRoot?.querySelector('button') as HTMLElement | null;
    (inner ?? host)?.focus();
  }
}
