# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [SemVer](https://semver.org/lang/es/).

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
