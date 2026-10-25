/** Roles definidos en el enum `public.user_role` de PostgreSQL. */
export type UserRole = 'admin' | 'user';

/** Perfil de usuario (tabla `public.profiles`, 1:1 con `auth.users`). */
export interface Profile {
  id: string;
  email: string;
  nombre: string | null;
  departamento: string | null;
  role: UserRole;
  created_at: string;
}
