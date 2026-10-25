import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { Profile, UserRole } from '../models';
import { SKIP_LOADING, SILENT_ERRORS } from '../interceptors/http-context';
import { SqlApiService } from './sql-api.service';

/** Gestión de usuarios y roles (solo administrador, protegido por RLS). */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly api = inject(SqlApiService);

  /** Todos los perfiles (el admin los ve todos; un usuario solo el suyo). */
  list(): Observable<Profile[]> {
    return this.api.select<Profile>('profiles', { select: '*', order: 'created_at.asc' });
  }

  /** Cambia el rol de un usuario (RPC `cambiar_rol`). */
  cambiarRol(usuarioId: string, rol: UserRole): Observable<Profile> {
    return this.api.rpc<Profile>('cambiar_rol', { p_usuario_id: usuarioId, p_rol: rol });
  }

  /**
   * ¿Está libre el email? Se usa en la **validación asíncrona** del registro.
   * Ante un error de red se considera válido (el servidor volverá a validarlo).
   */
  emailDisponible(email: string): Observable<boolean> {
    return this.api
      .rpc<boolean>(
        'email_disponible',
        { p_email: email.trim().toLowerCase() },
        { context: new HttpContext().set(SKIP_LOADING, true).set(SILENT_ERRORS, true) },
      )
      .pipe(catchError(() => of(true)));
  }
}
