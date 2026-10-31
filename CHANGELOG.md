# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [SemVer](https://semver.org/lang/es/).

## [1.4.0] - 2026-10-30

### Añadido
- **Cuentas recordadas en este dispositivo**: al marcar «Recordar mi cuenta» en el login o el registro, la cuenta aparece en el desplegable *Modo Usuario*, en su propio grupo. Al elegirla se rellena el email y el foco pasa a la contraseña, que nunca se guarda.
- Desplegable agrupado («Recordadas en este dispositivo» y «Cuentas de demostración») siguiendo el patrón *listbox* con grupos de WAI-ARIA.
- Fotos reales de producto con licencia libre (Pexels, Unsplash y Wikimedia Commons) en Supabase Storage, con sus créditos en `docs/CREDITOS_IMAGENES.md`.
- 4 tests nuevos (57 en total).

### Cambiado
- «Recordar mi email» pasa a ser «Recordar mi cuenta» (email, nombre y departamento, sin contraseña).

## [1.3.0] - 2026-10-29

### Añadido
- Imágenes de producto en **Supabase Storage**: bucket público `productos` con políticas RLS (solo el administrador escribe), límite de 2 MB y solo imágenes (`supabase/storage.sql`).
- Componente reutilizable `app-image-picker`: arrastrar y soltar, vista previa, cambiar y quitar.
- Optimización en el navegador: redimensionado a 800 px y conversión a WebP antes de subir.
- Catálogo con imagen en cada tarjeta y miniaturas en la tabla (columna de tipo `image` en `app-data-table`).
- Al eliminar un producto o cambiar su imagen se borra la anterior del bucket.
- Cuadro de mando: gráfico de área polar por estado y treemap del top 10 de productos.

### Cambiado
- Panel de acceso rápido sin icono y con el contenido centrado.

## [1.2.0] - 2026-10-29

### Añadido
- Acceso rápido de demostración en el login: tarjeta de administrador y desplegable accesible (patrón *listbox* WAI-ARIA) con las cuentas de usuario; rellena las credenciales con animación de tecleo.
- Contraseñas demo inyectadas desde variables de entorno (`DEMO_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`), nunca en el repositorio.
- «Recordar mi email en este dispositivo» en el login y el registro (solo el email).
- Política de uso de datos en un modal desde el registro y enlace «Volver al inicio de sesión».
- Componente reutilizable `app-demo-access` y 7 tests nuevos (50 en total).

### Corregido
- El texto de la casilla de aceptación del registro ya no se corta.

## [1.1.0] - 2026-10-26

### Añadido
- Guards con defensa en profundidad (`canMatch` + `canActivate`) y `pendingChangesGuard` (`canDeactivate`).

### Corregido
- La URL de retorno tras el login conserva la ruta completa y sus parámetros.

## [1.0.0] - 2026-10-25

### Añadido
- Esquema de Supabase: tablas relacionales, colección documental JSONB, RLS por rol, RPC transaccionales, triggers de actividad, vistas consolidadas y publicación Realtime.
- Núcleo: API REST SQL con HttpClient y RxJS, interceptores de JWT, errores y carga, servicio NoSQL en tiempo real y Presence.
- Estado global con NgRx Signals: `AuthStore`, `CartStore` y `UiStore`.
- Navegación con side menu, lazy loading y guards `canMatch` por rol.
- Login y registro con validación asíncrona del email.
- Componentes reutilizables: `data-table`, `chart-card`, `kpi-card`, `activity-feed`, `status-badge`, `empty-state` y `page-header`.
- Catálogo, carrito persistente, alta de pedidos con `FormArray` y seguimiento con máquina de estados.
- Cuadro de mando con Chart.js, filtros en tiempo real, drill-down y feed de actividad.
- Alta y edición de productos con validación asíncrona del SKU, gestión de roles y avisos.
- Informes PDF (jsPDF y autotable) y CSV (RFC 4180).
- Accesibilidad WCAG 2.2 AA: tema claro y oscuro, alto contraste, escala de texto, navegación por teclado y ARIA.
- PWA: manifest, iconos y service worker.
- 35 tests unitarios con Vitest, CI en GitHub Actions, despliegue en Vercel y Compodoc.
- Manual de usuario en Markdown e integrado en la app.
