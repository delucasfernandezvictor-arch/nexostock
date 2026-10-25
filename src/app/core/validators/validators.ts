import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, catchError, first, map, of, switchMap, timer } from 'rxjs';

/** Retardo (ms) antes de lanzar la validación remota mientras se escribe. */
export const ASYNC_DEBOUNCE_MS = 450;

/**
 * Fábrica de **validadores asíncronos** contra un servicio remoto.
 *
 * - Aplica *debounce* con `timer` + `switchMap`: Angular cancela la suscripción
 *   anterior en cada pulsación, así que solo llega al servidor la última.
 * - Durante la comprobación el control queda en estado `PENDING`, lo que la
 *   vista aprovecha para mostrar un spinner.
 * - Ante un error de red no bloquea el formulario (el servidor revalida).
 *
 * @param check función que devuelve `true` si el valor está disponible
 * @param errorKey clave del error cuando no está disponible
 */
export function remoteUniqueValidator(check: (value: string) => Observable<boolean>, errorKey: string): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = String(control.value ?? '').trim();
    if (!value) return of(null);
    return timer(ASYNC_DEBOUNCE_MS).pipe(
      switchMap(() => check(value)),
      map((available) => (available ? null : { [errorKey]: true })),
      catchError(() => of(null)),
      first(),
    );
  };
}

/**
 * Contraseña robusta: mínimo 8 caracteres con mayúscula, minúscula y número.
 * Devuelve qué requisitos faltan para mostrarlos de forma accesible.
 */
export const strongPassword: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = String(control.value ?? '');
  if (!v) return null;
  const missing = {
    length: v.length < 8,
    upper: !/[A-ZÁÉÍÓÚÑ]/.test(v),
    lower: !/[a-záéíóúñ]/.test(v),
    digit: !/\d/.test(v),
  };
  return Object.values(missing).some(Boolean) ? { weakPassword: missing } : null;
};

/** Validador de grupo: los dos campos indicados deben coincidir. */
export function matchFields(field: string, confirm: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field)?.value;
    const b = group.get(confirm)?.value;
    return a && b && a !== b ? { mismatch: true } : null;
  };
}

/** SKU con formato `AAA-0000` (tres letras, guion, cuatro dígitos). */
export const SKU_PATTERN = /^[A-Za-z]{3}-\d{4}$/;

/** El stock mínimo no puede superar el stock inicial más un margen razonable. */
export const stockCoherente: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const stock = Number(group.get('stock')?.value);
  const minimo = Number(group.get('stock_minimo')?.value);
  return Number.isFinite(stock) && Number.isFinite(minimo) && minimo > 0 && minimo > stock * 10 + 100
    ? { stockIncoherente: true }
    : null;
};

/**
 * Traduce los errores de un control a un mensaje legible (primer error).
 * @param errors `control.errors`
 * @param custom mensajes específicos por clave de error
 */
export function errorText(errors: ValidationErrors | null | undefined, custom: Record<string, string> = {}): string {
  if (!errors) return '';
  const key = Object.keys(errors)[0]!;
  if (custom[key]) return custom[key];
  const e = errors[key];
  switch (key) {
    case 'required':
      return 'Este campo es obligatorio';
    case 'email':
      return 'Introduce un email válido (nombre@dominio.com)';
    case 'minlength':
      return `Debe tener al menos ${e.requiredLength} caracteres`;
    case 'maxlength':
      return `No puede superar ${e.requiredLength} caracteres`;
    case 'min':
      return `El valor mínimo es ${e.min}`;
    case 'max':
      return `El valor máximo es ${e.max}`;
    case 'pattern':
      return 'El formato no es válido';
    case 'weakPassword':
      return 'La contraseña no cumple los requisitos de seguridad';
    default:
      return 'Valor no válido';
  }
}
