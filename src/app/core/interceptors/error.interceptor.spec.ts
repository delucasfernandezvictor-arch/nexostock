import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './error.interceptor';

describe('toApiError', () => {
  it('detecta la falta de conexión', () => {
    expect(toApiError(new HttpErrorResponse({ status: 0 })).message).toContain('No hay conexión');
  });

  it('traduce códigos de PostgreSQL', () => {
    const e = toApiError(new HttpErrorResponse({ status: 409, error: { code: '23505', message: 'duplicate key' } }));
    expect(e).toMatchObject({ status: 409, code: '23505', message: 'Ya existe un registro con ese valor único' });
  });

  it('mantiene el mensaje de las excepciones de negocio (RAISE EXCEPTION)', () => {
    const e = toApiError(new HttpErrorResponse({ status: 400, error: { code: 'P0001', message: 'Stock insuficiente para "Portátil"' } }));
    expect(e.message).toBe('Stock insuficiente para "Portátil"');
  });

  it('interpreta 401 y 403', () => {
    expect(toApiError(new HttpErrorResponse({ status: 401, error: {} })).message).toContain('sesión ha caducado');
    expect(toApiError(new HttpErrorResponse({ status: 403, error: {} })).message).toContain('No tienes permisos');
  });
});
