# NexoStock · Sistema de Gestión de Inventario y Pedidos

[![CI](https://github.com/delucasfernandezvictor-arch/nexostock/actions/workflows/ci.yml/badge.svg)](https://github.com/delucasfernandezvictor-arch/nexostock/actions/workflows/ci.yml)

Aplicación de gestión empresarial **multiplataforma (PWA / híbrida)** para controlar el inventario, los pedidos internos y las métricas de una empresa. Desarrollada con **Ionic 9 + Angular 22 (standalone, signals)** y **Supabase** (PostgreSQL + Auth + Realtime).

> Proyecto individual del módulo **Desarrollo de Interfaces (0488)** · CFGS Desarrollo de Aplicaciones Multiplataforma.

| | |
|---|---|
| **Producción** | <https://nexostock-amber.vercel.app> |
| **Documentación técnica (Compodoc)** | <https://nexostock-amber.vercel.app/docs/index.html> |
| **Manual de usuario** | [En la documentación web](https://nexostock-amber.vercel.app/docs/additional-documentation/manual-de-usuario.html) · [En GitHub (Markdown)](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/docs/MANUAL_USUARIO.md) · pantalla *Ayuda* dentro de la app |
| **Repositorio** | <https://github.com/delucasfernandezvictor-arch/nexostock> |
| **Credenciales de prueba** | Se entregan en el PDF de la actividad (no se publican en el repositorio) |

---

## Índice

1. [Funcionalidades](#funcionalidades)
2. [Arquitectura](#arquitectura)
3. [Orígenes de datos: SQL y NoSQL](#orígenes-de-datos-sql-y-nosql)
4. [Seguridad y control de acceso](#seguridad-y-control-de-acceso)
5. [Mapa de requisitos de la actividad](#mapa-de-requisitos-de-la-actividad)
6. [Puesta en marcha](#puesta-en-marcha)
7. [Scripts](#scripts)
8. [Flujo de trabajo Git](#flujo-de-trabajo-git)
9. [Despliegue y CI/CD](#despliegue-y-cicd)
10. [Accesibilidad y calidad](#accesibilidad-y-calidad)
11. [Estructura del proyecto](#estructura-del-proyecto)

---

## Funcionalidades

| Rol | Funcionalidad |
|---|---|
| **Todos** | Login con **acceso rápido de demostración** y «recordar mi email», registro con **validación asíncrona del email** y política de uso de datos, catálogo con búsqueda y filtros, carrito persistente, alta de pedidos, seguimiento en tiempo real, informes **PDF / CSV**, ayuda integrada y preferencias de accesibilidad |
| **Usuario estándar** | Ve y exporta **solo sus pedidos**; puede cancelar sus pedidos pendientes |
| **Administrador** | **Cuadro de mando** interactivo con gráficos, alta y edición de productos (**validación asíncrona del SKU**), gestión del ciclo de vida de todos los pedidos, gestión de roles, publicación de avisos en tiempo real y feed de actividad |

## Arquitectura

Arquitectura **MVVM** con separación estricta en capas y flujo de datos unidireccional:

```
┌───────────────────────────── Vista (plantillas declarativas) ─────────────────────────────┐
│  Páginas (features/*)  ──usan──▶  Componentes agnósticos (shared/components/*)            │
│        │  inputs/outputs, two-way binding [(ngModel)] / [(search)]                         │
├────────┼─────────────────────────── ViewModel ─────────────────────────────────────────────┤
│        ▼                                                                                   │
│  Signals · computed · rxResource       Stores NgRx Signals (AuthStore, CartStore, UiStore)  │
├────────┼─────────────────────────── Modelo / servicios ────────────────────────────────────┤
│        ▼                                                                                   │
│  SqlApiService (HttpClient + RxJS)          RealtimeDocsService (Supabase Realtime)        │
│  ├─ authInterceptor  (JWT asíncrono)        ├─ collection$()  documentos JSONB en vivo      │
│  ├─ errorInterceptor (normaliza / 401)      ├─ tableChanges$() cambios de tablas            │
│  └─ loadingInterceptor (barra global)       └─ presence$()   usuarios conectados            │
└────────┼───────────────────────────────────────────────┼───────────────────────────────────┘
         ▼                                               ▼
   PostgREST /rest/v1  (SQL + RLS)               WebSocket Realtime (NoSQL)
```

- **Standalone components** + **lazy loading** de todas las rutas (`loadComponent` / `loadChildren`).
- **Gestión de estado predecible** con **NgRx Signals Store**: estado inmutable que solo cambia mediante métodos (`patchState`), con selectores derivados (`withComputed`) y efectos de ciclo de vida (`withHooks`).
- **ChangeDetectionStrategy.OnPush** en todos los componentes y **señales `computed` encadenadas** (filtrar → ordenar → paginar), de modo que se recalcula solo lo necesario.
- **Ciclo de vida**: `afterNextRender` / `ngOnDestroy` en los gráficos (se destruye la instancia de Chart.js), `DestroyRef` + `takeUntilDestroyed` en todas las suscripciones y *teardown* de canales WebSocket. Así se evitan las fugas de memoria.

## Orígenes de datos: SQL y NoSQL

| | Relacional (SQL) | Documental (NoSQL) en tiempo real |
|---|---|---|
| Tecnología | PostgreSQL expuesto como **API REST** (PostgREST) | Colecciones de **documentos JSONB** + **Supabase Realtime** (WebSocket) |
| Cliente | `SqlApiService` con **HttpClient** y **Observables RxJS** | `RealtimeDocsService` con el SDK de Supabase, envuelto en `Observable` |
| Datos | `profiles`, `categorias`, `productos`, `pedidos`, `pedido_lineas`, vistas `v_pedidos_resumen` y `v_lineas_detalle` | Tabla `documentos` con colecciones `actividad` (eventos del sistema) y `avisos` (comunicados), sin esquema fijo |
| Concurrencia | `forkJoin` (dashboard, informes, inicio), `retry` con *backoff* exponencial, `switchMap` + *debounce* en validaciones | Fusión de la carga inicial con los eventos en vivo, Presence |
| Archivos | — | **Supabase Storage**: bucket `productos` con las imágenes de producto (WebP optimizado en el navegador, URL pública cacheable, escritura solo para administradores mediante RLS) |
| Lógica de negocio | Funciones **RPC transaccionales**: `crear_pedido` (bloqueo `FOR UPDATE`, control de stock), `cambiar_estado_pedido`, `cambiar_rol`, `email_disponible` | Los *triggers* generan documentos de actividad en cada cambio relevante |

El esquema completo está en [`supabase/schema.sql`](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/supabase/schema.sql) y los datos sintéticos en [`supabase/seed.sql`](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/supabase/seed.sql).

## Seguridad y control de acceso

- **Autenticación** con Supabase Auth (JWT). La sesión se restaura de forma asíncrona y el token se renueva solo. El `authInterceptor` obtiene el token vigente **en cada petición**, y el `errorInterceptor` cierra la sesión y redirige al login si recibe un 401.
- **Guards funcionales con defensa en profundidad**. Toda la lógica de autorización está en una sola función compartida y devuelve siempre `true` o un `UrlTree`:
  - `canMatch` (`authGuard`, `roleGuard('admin')`): una ruta protegida ni siquiera **descarga su código** si el usuario no tiene permiso.
  - `canActivate` / `canActivateChild` (`authActivateGuard`, `roleActivateGuard('admin')`): se vuelve a comprobar antes de instanciar cada vista. La URL de retorno (`?redirect=`) conserva la ruta completa y sus parámetros.
  - `canDeactivate` (`pendingChangesGuard`): pide confirmación antes de abandonar un formulario con cambios sin guardar (productos y avisos).
  - `guestGuard`: impide volver al login con sesión iniciada.
- **El control real está en el servidor**: **Row Level Security** en todas las tablas y funciones `SECURITY DEFINER` que validan el rol. Aunque se manipule el cliente, un usuario estándar no puede leer pedidos ajenos, crear productos ni cambiar roles. Se ha comprobado con peticiones directas a la API (código `42501`).
- **Ningún secreto en el repositorio**: la URL y la clave *publishable* se inyectan en tiempo de build desde variables de entorno (`scripts/set-env.mjs`). `.env` y `runtime-env.ts` están en `.gitignore`. Las credenciales de prueba solo aparecen en el PDF de entrega.
- **Acceso rápido de demostración**: el login ofrece las cuentas demo con un clic (administrador y un desplegable de usuarios). Sus contraseñas tampoco están en el código: llegan de las variables `DEMO_ADMIN_PASSWORD` y `DEMO_USER_PASSWORD`; si no se definen, el panel no aparece. «Recordar mi email» guarda solo el email en el dispositivo, nunca la contraseña.
- **Storage protegido por RLS**: el bucket `productos` es de lectura pública, pero solo un administrador puede subir, cambiar o borrar imágenes (políticas sobre `storage.objects` con `public.is_admin()`). Además el bucket limita el tamaño a 2 MB y solo admite imágenes.
- **Prevención de *open redirect*** en el login, **neutralización de inyección de fórmulas** en los CSV y cabeceras de seguridad (`HSTS`, `X-Frame-Options`, `nosniff`...) en `vercel.json`.
- **Datos sintéticos**: dominio reservado `example.com` (RFC 2606). No hay datos personales reales.

## Mapa de requisitos de la actividad

| Paso | Implementación |
|---|---|
| **1.1** Navegación + lazy loading + guards por rol | Side menu con `ion-split-pane` ([shell](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/layout/shell)) · [app.routes.ts](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/app.routes.ts) · [features.routes.ts](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/features/features.routes.ts) · [auth.guards.ts](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/core/guards/auth.guards.ts) |
| **1.2** Formularios, data binding, validación asíncrona | [Registro](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/features/auth/registro) (email único vía RPC) · [Producto](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/features/admin/producto-form) (SKU único) · [Nuevo pedido](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/features/pedidos) (`FormArray`) · two-way `[(ngModel)]` y `[(search)]` con `model()` · [validators.ts](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/core/validators/validators.ts) |
| **2.1** ≥ 2 componentes visuales | [`app-data-table`](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/shared/components/data-table) · [`app-chart-card`](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/shared/components/chart-card) · [`app-kpi-card`](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/shared/components/kpi-card) · [`app-activity-feed`](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/shared/components/activity-feed) · `app-status-badge` · `app-empty-state` · `app-page-header` |
| **2.2** Inputs / Outputs | `input()`, `model()` y `output()`: `rowClick`, `action`, `sortChange`, `segmentSelect`, `selected`, `itemSelect` |
| **3.1** Asincronía SQL + NoSQL | [sql-api.service.ts](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/core/services/sql-api.service.ts) · [realtime-docs.service.ts](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/core/services/realtime-docs.service.ts) · `forkJoin`, `Promise.all`, `rxResource` |
| **3.2** Dashboard con gráficos | [Cuadro de mando](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/features/admin/dashboard): Chart.js, filtros en tiempo real, *drill-down*, KPIs con tendencia |
| **3.3** Exportación PDF y CSV | [export.service.ts](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/src/app/core/services/export.service.ts): PDF maquetado con jsPDF y autotable, CSV RFC 4180 · [Informes](https://github.com/delucasfernandezvictor-arch/nexostock/tree/main/src/app/features/informes) |
| **4.1** Responsive mobile-first | CSS Grid y Flexbox, `ion-grid`, tablas que se convierten en tarjetas en móvil |
| **4.2** WCAG / WAI-ARIA / teclado | Ver [Accesibilidad y calidad](#accesibilidad-y-calidad) |
| **5.1** Git Flow | Ramas `main`, `develop`, `feature/*`, `release/*` con *merge commits* (ver historial) |
| **5.2** Documentación | Compodoc (`npm run docs`, publicada en `/docs`) · [Manual de usuario](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/docs/MANUAL_USUARIO.md) · ayuda integrada |
| **5.3** Despliegue + CI | [ci.yml](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/.github/workflows/ci.yml) · [vercel.json](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/vercel.json): Vercel no despliega si fallan los tests |

## Puesta en marcha

**Requisitos:** Node.js ≥ 20 y un proyecto de [Supabase](https://supabase.com) (vale el plan gratuito).

1. **Base de datos.** En Supabase › *SQL Editor*, ejecuta `supabase/schema.sql`.
2. **Autenticación.** En *Authentication › Sign In / Providers › Email*, desactiva **Confirm email** (o configura SMTP).
3. **Usuarios de prueba.** En *Authentication › Users › Add user*, crea `admin@example.com` y `usuario@example.com` con *Auto Confirm*.
4. **Datos sintéticos.** Ejecuta `supabase/seed.sql`. Promociona al administrador y genera 36 productos, 240 pedidos y avisos.
5. **Storage.** Ejecuta `supabase/storage.sql`. Crea el bucket `productos`, sus políticas RLS y la columna `imagen_path`.
5. **Variables de entorno.**
   ```bash
   cp .env.example .env      # rellena SUPABASE_URL y SUPABASE_ANON_KEY (Project Settings › API)
                             # y, opcionalmente, DEMO_ADMIN_PASSWORD / DEMO_USER_PASSWORD
   npm ci
   npm start                 # http://localhost:4200
   ```

## Scripts

| Script | Descripción |
|---|---|
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción en `www/`: PWA con service worker y *hashing* |
| `npm test` / `npm run test:ci` | Tests unitarios con **Vitest**: 53 tests de guards (incluida la integración con el router), stores, validadores, utilidades, interceptores, DataTable, acceso demo e imágenes |
| `npm run lint` | ESLint + angular-eslint |
| `npm run docs` | Documentación técnica con **Compodoc** en `documentation/` |
| `npm run vercel-build` | Pipeline de despliegue: tests → build → docs en `www/docs` |

## Flujo de trabajo Git

Se sigue **Git Flow**:

- `main`: versiones estables desplegadas en producción, etiquetadas (`v1.0.0`).
- `develop`: rama de integración.
- `feature/<nombre>`: una por funcionalidad, integradas en `develop` mediante *merge* `--no-ff` o **Pull Request**.
- `release/<versión>`: estabilización antes de pasar a `main`.

El historial (`git log --graph --oneline --all`) muestra cada rama de característica y su integración.

## Despliegue y CI/CD

- **GitHub Actions** ([ci.yml](https://github.com/delucasfernandezvictor-arch/nexostock/blob/main/.github/workflows/ci.yml)) se ejecuta en cada push y en cada PR. Pasa lint, tests, build de producción y Compodoc, y guarda la documentación como artefacto.
- **Vercel** está conectado al repositorio: cada push a `main` despliega a producción y cada PR genera un *preview*. Su comando de build es `npm run vercel-build`, que **ejecuta los tests primero**: si fallan, **el despliegue se bloquea**.
- Variables en Vercel (*Settings › Environment Variables*): `SUPABASE_URL` y `SUPABASE_ANON_KEY`, más `DEMO_ADMIN_PASSWORD` y `DEMO_USER_PASSWORD` si se quiere activar el acceso rápido de demostración.
- La documentación de Compodoc se publica junto a la app en `/docs/index.html`.

## Accesibilidad y calidad

- **Lighthouse**: Accesibilidad **100**, Buenas prácticas **100**.
- **axe-core** (WCAG 2.2 A/AA + buenas prácticas): **0 violaciones** en las 13 pantallas.
- **Contraste**: todos los pares texto/fondo ≥ 4,5:1, en tema claro y oscuro, más un modo de **alto contraste**.
- **Tipografía escalable** en `rem`. Se puede ajustar entre el 87,5 % y el 150 % desde la app y no se bloquea el zoom del navegador.
- **Teclado**: orden de tabulación lógico, foco visible, enlace *Saltar al contenido*, filas de tabla activables con Enter o Espacio y diálogos que se cierran con Esc.
- **WAI-ARIA y semántica**: `aria-live` para avisos y cambios de página, `aria-sort`, `aria-current`, `aria-pressed`, `aria-expanded`, `aria-busy`, tablas con `caption` y `scope`, y gráficos con `role="img"`, resumen textual y tabla de datos alternativa.
- **Estados sin depender del color**: cada badge combina icono y texto.
- Se respeta `prefers-reduced-motion` y `prefers-color-scheme`.

## Estructura del proyecto

```
src/app/
├── core/                 # Lógica no visual (sin dependencias de la vista)
│   ├── config/           # Token de configuración inyectable
│   ├── guards/           # canMatch, canActivate y canDeactivate (RBAC)
│   ├── interceptors/     # auth (JWT), error, loading
│   ├── models/           # Interfaces de dominio
│   ├── services/         # SQL API, Realtime NoSQL, exportación, notificaciones...
│   ├── state/            # Stores NgRx Signals: Auth, Cart, Ui
│   ├── utils/            # Formateo, CSV, helpers de resource
│   └── validators/       # Validadores síncronos y asíncronos
├── shared/components/    # Componentes visuales agnósticos y reutilizables
├── layout/shell/         # Navegación global (side menu)
└── features/             # Páginas (lazy loading)
    ├── auth/  inicio/  catalogo/  pedidos/  informes/  ayuda/  accesibilidad/  errores/
    └── admin/ dashboard/  producto-form/  usuarios/  avisos/
supabase/                 # schema.sql (DDL, RLS, RPC, triggers, vistas) y seed.sql
docs/                     # Manual de usuario
```

---

© 2026 Victor de Lucas · Proyecto académico con datos sintéticos.
