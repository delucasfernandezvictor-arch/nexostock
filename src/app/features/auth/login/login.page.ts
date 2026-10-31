import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonCheckbox, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logInOutline, mailOutline, lockClosedOutline, alertCircleOutline, timeOutline, closeOutline } from 'ionicons/icons';
import { APP_CONFIG } from '../../../core/config/app-config';
import { QuickAccount, demoCredentials, initials, rememberedQuickAccounts } from '../../../core/config/demo-accounts';
import { NotifyService } from '../../../core/services/notify.service';
import { AuthStore } from '../../../core/state/auth.store';
import { getRememberedAccounts, getRememberedEmail, rememberAccount } from '../../../core/utils/remember';
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
 * - **Recordar mi cuenta**: guarda en este dispositivo el email, nombre y
 *   departamento (nunca la contraseña). Las cuentas recordadas aparecen en el
 *   desplegable del acceso rápido; al elegir una se rellena solo el email.
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
  private readonly passwordInput = viewChild<IonInput>('passwordInput');

  protected readonly errorText = errorText;
  protected readonly initials = initials;

  /** Acceso rápido: cuentas recordadas en este dispositivo + cuentas demo (si el build trae sus contraseñas) */
  protected readonly demoAccounts: QuickAccount[] = [
    ...rememberedQuickAccounts(getRememberedAccounts()),
    ...demoCredentials(inject(APP_CONFIG)),
  ];
  /** Cuenta del acceso rápido cargada en el formulario */
  protected readonly demoSelected = signal<QuickAccount | null>(null);
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

  /**
   * Rellena el formulario con una cuenta del acceso rápido (animación de tecleo).
   * Las cuentas demo traen contraseña; en las recordadas solo se rellena el email
   * y el foco pasa a la contraseña.
   */
  protected async fillDemo(account: QuickAccount): Promise<void> {
    const run = ++this.fillRun;
    const { email, password, remember } = this.form.controls;
    const secret = account.password ?? '';
    this.auth.clearError();
    if (account.recordada) remember.setValue(true);
    this.demoSelected.set(account);
    this.filling.set(true);

    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      email.setValue(account.email);
      password.setValue(secret);
    } else {
      email.setValue('');
      password.setValue('');
      for (const [control, text] of [[email, account.email], [password, secret]] as const) {
        for (let i = 1; i <= text.length; i++) {
          if (run !== this.fillRun) return; // se eligió otra cuenta mientras tanto
          control.setValue(text.slice(0, i));
          await wait(TYPE_DELAY_MS);
        }
      }
    }
    if (run !== this.fillRun) return;

    email.markAsTouched();
    this.filling.set(false);
    if (secret) {
      password.markAsTouched();
      this.notify.announce(`Credenciales de ${account.nombre} cargadas. Pulsa Entrar para acceder.`);
      this.focusSubmit();
    } else {
      this.notify.announce(`Cuenta de ${account.nombre} cargada. Escribe tu contraseña.`);
      await this.passwordInput()?.setFocus();
    }
  }

  /** Quita la cuenta cargada y vacía la contraseña. */
  protected clearDemo(): void {
    this.fillRun++;
    this.filling.set(false);
    this.demoSelected.set(null);
    this.form.controls.password.setValue('');
    this.notify.announce('Cuenta retirada del formulario');
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
    const profile = this.auth.profile();
    rememberAccount(
      { email, nombre: profile?.nombre ?? '', departamento: profile?.departamento ?? '', role: profile?.role ?? 'user' },
      remember,
    );
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
