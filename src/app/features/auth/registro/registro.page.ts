import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton, IonButtons, IonCheckbox, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonInputPasswordToggle, IonModal, IonSelect,
  IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle, closeCircle, closeOutline, ellipseOutline, personAddOutline, alertCircleOutline, mailOpenOutline, shieldCheckmarkOutline,
} from 'ionicons/icons';
import { map, startWith } from 'rxjs';
import { UsuariosService } from '../../../core/services/usuarios.service';
import { AuthStore } from '../../../core/state/auth.store';
import { setRememberedEmail } from '../../../core/utils/remember';
import { errorText, matchFields, remoteUniqueValidator, strongPassword } from '../../../core/validators/validators';
import { AuthLayoutComponent } from '../auth-layout.component';

/** Departamentos disponibles para el alta. */
export const DEPARTAMENTOS = ['Administración', 'Compras', 'Logística', 'Marketing', 'Recursos Humanos', 'Sistemas', 'Ventas'] as const;

/**
 * **Registro de usuario estándar** con formulario reactivo y
 * **validación asíncrona**: mientras se escribe el email se consulta a la base
 * de datos (RPC `email_disponible`) si ya existe una cuenta.
 *
 * El estado `PENDING` del control se expone como señal para mostrar un
 * indicador de "Comprobando…" y bloquear el envío hasta que termine.
 *
 * Incluye la aceptación de la política de uso de datos (con su texto en un
 * modal) y la opción «Recordar mi email en este dispositivo».
 */
@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['../auth.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, IonContent, IonInput, IonInputPasswordToggle, IonButton, IonIcon, IonSpinner, IonSelect,
    IonSelectOption, IonCheckbox, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonFooter, AuthLayoutComponent,
  ],
})
export class RegistroPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly usuarios = inject(UsuariosService);
  protected readonly auth = inject(AuthStore);

  protected readonly departamentos = DEPARTAMENTOS;
  protected readonly errorText = errorText;
  protected readonly confirmationSent = signal(false);
  /** Modal con la política de uso de datos */
  protected readonly termsOpen = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(60)]],
      email: this.fb.nonNullable.control('', {
        validators: [Validators.required, Validators.email],
        asyncValidators: [remoteUniqueValidator((v) => this.usuarios.emailDisponible(v), 'emailTaken')],
        updateOn: 'change',
      }),
      departamento: ['', Validators.required],
      password: ['', [Validators.required, strongPassword]],
      confirm: ['', Validators.required],
      acepta: [false, Validators.requiredTrue],
      recordar: [false],
    },
    { validators: matchFields('password', 'confirm') },
  );

  /** Estado del control email (VALID / INVALID / PENDING) como señal. */
  protected readonly emailStatus = toSignal(
    this.form.controls.email.statusChanges.pipe(
      startWith(this.form.controls.email.status),
      map(() => this.form.controls.email.status),
    ),
    { initialValue: 'VALID' },
  );

  /** Valor de la contraseña como señal (checklist de requisitos en vivo). */
  private readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  protected readonly checks = computed(() => {
    const v = this.password();
    return [
      { label: '8 caracteres o más', ok: v.length >= 8 },
      { label: 'Una mayúscula', ok: /[A-ZÁÉÍÓÚÑ]/.test(v) },
      { label: 'Una minúscula', ok: /[a-záéíóúñ]/.test(v) },
      { label: 'Un número', ok: /\d/.test(v) },
    ];
  });

  constructor() {
    addIcons({ checkmarkCircle, closeCircle, closeOutline, ellipseOutline, personAddOutline, alertCircleOutline, mailOpenOutline, shieldCheckmarkOutline });
    this.auth.clearError();
  }

  protected emailError(): string {
    return errorText(this.form.controls.email.errors, { emailTaken: 'Ya existe una cuenta con este email' });
  }

  /** Acepta la política desde el modal (equivale a marcar la casilla). */
  protected acceptTerms(): void {
    this.form.controls.acepta.setValue(true);
    this.form.controls.acepta.markAsTouched();
    this.termsOpen.set(false);
  }

  protected confirmError(): string {
    if (this.form.hasError('mismatch')) return 'Las contraseñas no coinciden';
    return errorText(this.form.controls.confirm.errors);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.form.pending) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      const { nombre, email, departamento, password, recordar } = this.form.getRawValue();
      const { needsConfirmation } = await this.auth.register({ nombre, email, departamento, password });
      setRememberedEmail(email, recordar);
      if (needsConfirmation) this.confirmationSent.set(true);
      else await this.router.navigateByUrl('/app/inicio', { replaceUrl: true });
    } catch {
      // mensaje en auth.error()
    }
  }
}
