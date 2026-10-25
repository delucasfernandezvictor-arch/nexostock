import { FormControl, FormGroup } from '@angular/forms';
import { Observable, firstValueFrom, of } from 'rxjs';
import { errorText, matchFields, remoteUniqueValidator, strongPassword } from './validators';

describe('validators', () => {
  it('strongPassword exige longitud, mayúscula, minúscula y número', () => {
    expect(strongPassword(new FormControl('abc'))).toEqual({ weakPassword: { length: true, upper: true, lower: false, digit: true } });
    expect(strongPassword(new FormControl('Secreta123'))).toBeNull();
    expect(strongPassword(new FormControl(''))).toBeNull();
  });

  it('matchFields detecta contraseñas distintas', () => {
    const g = new FormGroup({ password: new FormControl('Abcdef12'), confirm: new FormControl('Abcdef13') }, { validators: matchFields('password', 'confirm') });
    expect(g.hasError('mismatch')).toBe(true);
    g.controls.confirm.setValue('Abcdef12');
    expect(g.hasError('mismatch')).toBe(false);
  });

  it('remoteUniqueValidator devuelve error si el servicio indica que no está disponible', async () => {
    vi.useFakeTimers();
    const validator = remoteUniqueValidator(() => of(false), 'emailTaken');
    const result = firstValueFrom(validator(new FormControl('ya@existe.com')) as Observable<unknown>);
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toEqual({ emailTaken: true });
    vi.useRealTimers();
  });

  it('remoteUniqueValidator no llama al servicio con el campo vacío', async () => {
    const check = vi.fn(() => of(true));
    const res = await firstValueFrom(remoteUniqueValidator(check, 'x')(new FormControl('')) as Observable<unknown>);
    expect(res).toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it('errorText traduce errores y admite mensajes personalizados', () => {
    expect(errorText({ required: true })).toBe('Este campo es obligatorio');
    expect(errorText({ minlength: { requiredLength: 3 } })).toBe('Debe tener al menos 3 caracteres');
    expect(errorText({ skuTaken: true }, { skuTaken: 'SKU en uso' })).toBe('SKU en uso');
    expect(errorText(null)).toBe('');
  });
});
