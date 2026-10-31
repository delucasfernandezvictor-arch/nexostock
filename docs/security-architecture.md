# Arquitectura de seguridad y control de acceso

> Memoria técnica de NexoStock: Ionic 9 + Angular 22 standalone + Supabase. Desarrollo de Interfaces (0488), DAM 2.
> Autor: Víctor de Lucas Fernández · Curso 2026-2027.

NexoStock tiene dos perfiles, `admin` y `user`. La seguridad se organiza en **defensa en profundidad** con cuatro capas independientes: si una falla, la siguiente sigue protegiendo los datos. La regla de diseño es que **el cliente oculta lo que el usuario no puede hacer y el servidor impide que lo haga**.

Todas las APIs son funcionales y actuales: `CanMatchFn`, `CanActivateFn`, `CanDeactivateFn` y `HttpInterceptorFn`. No hay ninguna clase con `implements CanActivate` ni ningún `NgModule`.

| Capa | Mecanismo |
|---|---|
| 1 · Interfaz | Señales `computed` y `@if`: el menú, los botones y las columnas dependen del rol. `@defer` carga el código de la asistente solo para administradores |
| 2 · Enrutador | Guards `canMatch`, `canActivate` / `canActivateChild` y `canDeactivate` |
| 3 · Red | Interceptores: JWT `Bearer`, normalización de errores 401/403 y refresco del token |
| 4 · Servidor | PostgreSQL Row Level Security, funciones `SECURITY DEFINER` y RLS en Storage |

---

## A. Fundamentación teórico-técnica

### A.1 Functional Guards

Un *guard* es una función que el **Router ejecuta durante la navegación**, antes de que exista el componente. Se ejecuta en un contexto de inyección, así que puede usar `inject()`. Puede devolver `boolean`, `UrlTree` o un `Observable`/`Promise` de ellos.

En NexoStock siempre devolvemos `true` o un `UrlTree`. Así el router cancela la navegación y redirige en el mismo ciclo, sin la doble navegación que provoca llamar a `router.navigate()` dentro del guard.

```
URL pedida → canMatch → descarga del chunk (lazy) → canActivate / canActivateChild → componente → canDeactivate
```

| Tipo | Momento del ciclo | Uso en NexoStock |
|---|---|---|
| `canMatch` | Al **emparejar** la URL, antes de descargar el código de la ruta | `authGuard` en `/app`, `roleGuard('admin')` en las rutas de administración y `guestGuard` en `/login` y `/registro` |
| `canActivate` / `canActivateChild` | Con la ruta ya resuelta, antes de **instanciar** el componente; se reevalúa en cada navegación hija | `authActivateGuard` y `roleActivateGuard('admin')`: detectan una sesión que caduca mientras el usuario navega |
| `canDeactivate` | Al **salir** de la vista | `pendingChangesGuard`: pide confirmación con un `ion-alert` accesible si hay cambios sin guardar |

**canActivate frente a canMatch en lazy loading.**

- Con `canActivate`, la ruta ya está emparejada, así que el *chunk* JavaScript **se descarga aunque se deniegue el acceso**. Se desperdicia red y se entrega el código de la pantalla de administración a quien no puede usarla.
- Con `canMatch`, si el guard deniega, la ruta **no se empareja** y el chunk no llega a pedirse. Además, `canMatch` permite tener varias rutas con el mismo `path` según el rol.
- Su limitación es que solo recibe los segmentos relativos al padre y no el `RouterStateSnapshot`. Por eso combinamos los dos guards.

### A.2 HTTP Interceptors (`HttpInterceptorFn`)

Un interceptor funcional es una función `(req, next) => Observable<HttpEvent>`. Los interceptores registrados con `withInterceptors([...])` forman un **pipeline en cadena**:

- Cada interceptor recibe la petición y, si necesita cambiarla, la clona, porque `HttpRequest` es inmutable. Después llama a `next()`.
- La petición recorre la cadena en orden y la respuesta la recorre en orden inverso, como un flujo RxJS.

```
Servicio → loadingInterceptor → authInterceptor → errorInterceptor → Supabase (PostgREST + RLS)
```

- **Cabecera de autorización.** `authInterceptor` solo actúa sobre las peticiones dirigidas a la URL de Supabase, para no filtrar el token a terceros. Obtiene el token con `auth.getSession()`, que es asíncrono y lo renueva si está a punto de caducar, y añade `Authorization: Bearer <JWT>`. Sin sesión envía la clave anónima, y PostgreSQL aplica el rol `anon`.
- **401 Unauthorized.** `errorInterceptor` cierra la sesión y redirige a `/login?redirect=<url actual>&expired=1`. Se excluyen las peticiones a `/auth/`, donde un 401 significa «credenciales incorrectas».
- **403 Forbidden y código `42501` de RLS.** La sesión no se cierra: el error se transforma en un `ApiError` con el mensaje «No tienes permisos para realizar esta operación».
- **Refresh token.** El cliente se crea con `autoRefreshToken: true` y `persistSession: true`. El SDK renueva el *access token* antes de que caduque y emite `TOKEN_REFRESHED`, que `AuthStore` recoge. El 401 queda como red de seguridad cuando la renovación es imposible.

### A.3 RBAC (Role-Based Access Control)

Siguiendo el modelo NIST RBAC0:

- Los usuarios *U* se asignan a roles *R* (*UA ⊆ U × R*).
- Los permisos *P* se asignan a roles (*PA ⊆ P × R*).

Dar o quitar permisos a alguien consiste en **cambiarle el rol**, sin tocar ninguna regla. En NexoStock:

- *R* es el `enum public.user_role ('admin','user')`.
- *UA* es la columna `profiles.role`.
- *PA* son las políticas RLS, los guards y el menú, todos expresados por rol.

| | Autenticación (¿quién eres?) | Autorización (¿qué puedes hacer?) |
|---|---|---|
| Dónde | Supabase Auth emite un JWT firmado con `sub`, `exp`, `aud` y `role: authenticated` | Cliente: `roleGuard` y señales `computed`. Servidor: `public.is_admin()` en RLS y RPC |
| Si falla | 401: nuevo login conservando la URL | 403 / `42501`: `/app/acceso-denegado` o aviso de error |

**Encapsulamiento del token.**

- La aplicación nunca decodifica el JWT a mano.
- `AuthStore` (NgRx Signals) centraliza la sesión y expone señales de solo lectura: `isAuthenticated`, `role`, `isAdmin` y `userId`.
- El rol **no** se lee de `user_metadata`, porque el propio usuario puede modificarlo con `auth.updateUser()`. Se lee de la tabla `profiles`, protegida por RLS.
- En el servidor, `is_admin()` vuelve a comprobar el rol a partir de `auth.uid()`, que es el `sub` verificado del token.
- Si falla la carga del perfil, se asigna el rol mínimo `user` (*fail-safe defaults*).

---

## B. Implementación en el proyecto

### B.1 Rutas y guards

[`src/app/app.routes.ts`](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/app.routes.ts)

```ts
{ path: 'login',    canMatch: [guestGuard], loadComponent: … },
{ path: 'registro', canMatch: [guestGuard], loadComponent: … },
{
  path: 'app',
  canMatch: [authGuard],                 // nivel red: sin sesión no se descarga
  canActivate: [authActivateGuard],      // nivel vista
  canActivateChild: [authActivateGuard], // cada navegación hija
  loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
  loadChildren: () => import('./features/features.routes').then((m) => m.FEATURE_ROUTES),
},
```

[`src/app/features/features.routes.ts`](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/features/features.routes.ts)

```ts
const ADMIN_ONLY = { canMatch: [roleGuard('admin')], canActivate: [roleActivateGuard('admin')] };

{ path: 'dashboard',       ...ADMIN_ONLY, loadComponent: … },
{ path: 'productos/nuevo', ...ADMIN_ONLY, canDeactivate: [pendingChangesGuard], loadComponent: … },
{ path: 'productos/:id',   ...ADMIN_ONLY, canDeactivate: [pendingChangesGuard], loadComponent: … },
{ path: 'usuarios',        ...ADMIN_ONLY, loadComponent: … },
{ path: 'avisos',          ...ADMIN_ONLY, canDeactivate: [pendingChangesGuard], loadComponent: … },
```

Todos los guards comparten una única función, `authorize(url, roles)`, en [`core/guards/auth.guards.ts`](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/core/guards/auth.guards.ts):

```ts
async function authorize(url: string, roles: readonly UserRole[] = []): Promise<GuardResult> {
  const auth = inject(AuthStore), router = inject(Router);
  await auth.whenReady();                                   // espera a recuperar la sesión guardada
  if (!auth.isAuthenticated())                              // 1. autenticación
    return router.createUrlTree(['/login'], { queryParams: { redirect: url } });
  if (!roles.length) return true;
  const role = auth.role();                                 // 2. autorización (RBAC)
  return role !== null && roles.includes(role) ? true : router.createUrlTree([FORBIDDEN_URL]);
}
```

**Redirección contextual.** `canMatch` solo conoce los segmentos relativos de la URL, así que `targetUrl()` toma la URL completa de `router.currentNavigation().extractedUrl`. Tras el login se vuelve a esa ruta solo si cumple `/^\/app(\/|$)/`, lo que evita *open redirects*.

**Jerarquía de roles** (`admin` ⊃ `user`):

| Pantalla / acción | user | admin | Protección |
|---|---|---|---|
| Inicio, Catálogo, Nuevo pedido, Ayuda, Accesibilidad | ✔ | ✔ | `authGuard` + `authActivateGuard` |
| Pedidos e Informes | solo los propios | todos | RLS `pedidos_select`: `usuario_id = auth.uid() or is_admin()` |
| Cancelar un pedido | propio y pendiente | ✔ | RPC `cambiar_estado_pedido` |
| Aprobar, enviar o entregar | ✘ | ✔ | Misma RPC → `42501` |
| Cuadro de mando · Usuarios y roles · Avisos | ✘ | ✔ | `ADMIN_ONLY` + RLS + RPC `cambiar_rol` |
| Alta, edición y borrado de productos e imágenes | ✘ | ✔ | `ADMIN_ONLY` + RLS en `productos` y `storage.objects` |
| Asistente Nexa (resumen diario) | ✘ | ✔ | `@if (auth.isAdmin())` + `@defer`: el código no se descarga |
| Quitarse el rol de administrador | ✘ | ✘ | `cambiar_rol` lo impide |

**Registro del interceptor** ([`src/main.ts`](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/main.ts)). No hay `AppModule`: la aplicación arranca con `bootstrapApplication`.

```ts
// Orden: carga → autenticación (añade JWT) → errores (normaliza la respuesta)
provideHttpClient(withFetch(), withInterceptors([loadingInterceptor, authInterceptor, errorInterceptor])),
```

El orden es intencionado:

1. `loadingInterceptor` va primero para contar también las peticiones que fallan.
2. `authInterceptor` firma todas las peticiones.
3. `errorInterceptor` va el último, el más cercano al servidor, para recibir el error crudo y entregar un `ApiError` homogéneo.

Los servicios no conocen el token.

### B.2 UI condicional

[`layout/shell/shell.component.ts`](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/layout/shell/shell.component.ts)

```ts
{ label: 'Cuadro de mando', url: '/app/dashboard', roles: ['admin'] },   // lista de roles, no un booleano
protected readonly menu = computed(() => {
  const role = this.auth.role();
  return this.sections
    .map((s) => ({ ...s, entries: s.entries.filter((e) => !e.roles || (role !== null && e.roles.includes(role))) }))
    .filter((s) => s.entries.length > 0);
});
```

- **Menú lateral** (`ion-split-pane` + `ion-menu`; la app no usa `ion-tabs`): la sección *Administración* desaparece entera para el rol `user`.
- **Botones de acción**: «Nuevo producto», editar o borrar, y las transiciones de estado solo se pintan si el rol lo permite (`@if (auth.isAdmin())`).
- **Datos**: la columna «Solicitante», los informes de toda la empresa y las métricas globales solo aparecen para `admin`.
- **Asistente Nexa**: `@if (auth.isAdmin()) { @defer (on idle) { <app-asistente /> } }`. Un usuario estándar ni siquiera descarga su *chunk*; está comprobado con el build de producción.
- **Acceso por URL**: si alguien escribe a mano una ruta prohibida, acaba en `/app/acceso-denegado`.

> **Ocultar no es proteger.** Cualquiera puede llamar a la API REST con su JWT. Por eso cada permiso existe **también en PostgreSQL**. Lo comprobamos en producción con la cuenta `user`: crear un producto, aprobar un pedido, autoasignarse `admin` o subir una imagen al bucket devuelve `42501`/403.

### B.3 Servidor y otras medidas

```sql
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create policy "productos_insert_admin" on public.productos for insert to authenticated with check (public.is_admin());
create policy "pedidos_select" on public.pedidos for select to authenticated using (usuario_id = auth.uid() or public.is_admin());
```

- **RLS activado en las 6 tablas y en `storage.objects`.** El bucket `productos` se puede leer públicamente, pero solo `is_admin()` puede escribir en él. Admite como máximo 2 MB por archivo y solo `image/*`.
- **Funciones RPC `SECURITY DEFINER`** (`crear_pedido`, `cambiar_estado_pedido`, `cambiar_rol`) con `search_path` fijado. Validan el stock y los permisos en una transacción.
- **Registro seguro.** El trigger `handle_new_user` crea siempre el perfil con el rol `user`.
- **Secretos fuera del repositorio.** La URL, la `anon key` (pública por diseño) y las contraseñas de las cuentas demo se inyectan desde las variables de entorno de Vercel con `scripts/set-env.mjs`. «Recordar mi cuenta» nunca guarda la contraseña.
- **Tests.** 12 tests de guards: `canMatch` y `canActivate` por rol, integración real con el `Router` y 3 casos de `canDeactivate`. 4 tests de normalización de errores HTTP. La CI de GitHub Actions bloquea el despliegue si alguno falla.

---

## C. Matriz de alternativas evaluadas

| Decisión | Seguridad | Sobrecarga de red | Mantenibilidad | Escalabilidad |
|---|---|---|---|---|
| **Guards funcionales** (elegido) | La vista nunca se crea sin permiso; con `canMatch` ni se descarga su código | Mínima: el chunk prohibido no se pide | Reglas declarativas en `routes.ts` y en un único punto | Una ruta nueva solo necesita `...ADMIN_ONLY` |
| Comprobación en `ngOnInit` / `ionViewWillEnter` | El componente ya se ha creado y puede pintar datos o lanzar peticiones antes de redirigir; un olvido deja la pantalla abierta | Se descarga y ejecuta código innecesario | Lógica duplicada en cada página | Crece de forma lineal con las pantallas |
| **Interceptor centralizado** (elegido) | El token solo va a Supabase; el 401 y el refresco se tratan igual en todas partes | Sin coste extra | Un único fichero | Los servicios nuevos quedan protegidos automáticamente |
| Cabeceras manuales | Un olvido envía la petición como `anon` o filtra el token a otro dominio | Igual | Código repetido y difícil de auditar | Empeora con cada servicio |
| **RBAC con enum de roles** (elegido) | Se aplica en el servidor (RLS); el rol vive en una tabla protegida | Una consulta al perfil al iniciar sesión | Los permisos se leen por rol | Añadir `supervisor` = `alter type … add value` e incluirlo en los `roles` correspondientes |
| Flag `isAdmin` | Suficiente hoy, pero obliga a reescribir guards y políticas con un tercer perfil | Igual | Condiciones `if (isAdmin)` dispersas | No escala |
| ABAC | El más expresivo | Más evaluaciones por petición | Necesita un motor de políticas | Desproporcionado; los casos por atributo («sus pedidos») ya se resuelven con RLS sobre `auth.uid()` |

**Conclusión.** Para dos perfiles y unas diez pantallas, **RBAC con roles enumerados** es el punto de equilibrio. Los casos que dependen de un atributo, como «el propietario del pedido», se resuelven con **RLS por fila**.

Se descartó guardar el rol como *custom claim* en el JWT (*Custom Access Token Hook*). Ahorraría una consulta, pero un cambio de rol no tendría efecto hasta el siguiente refresco del token, unos 60 minutos. Leerlo de `profiles` hace que una revocación sea inmediata.
