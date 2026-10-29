# Manual de usuario · NexoStock

**Versión 1.0.0**. Este manual también está integrado en la aplicación, en la pantalla **Ayuda** del menú lateral. Allí puedes buscar por palabras y ver solo las secciones de tu rol.

---

## 1. Qué es NexoStock

NexoStock es la herramienta interna de la empresa para:

- consultar el **catálogo** de material y su stock en tiempo real,
- solicitar **pedidos** al almacén y seguir su estado,
- descargar **informes** en PDF y CSV,
- y, si eres **administrador**, gestionar el inventario, los pedidos y los usuarios, y consultar el **cuadro de mando**.

Funciona en cualquier navegador moderno (ordenador, tablet o móvil) y se puede **instalar como aplicación** (PWA). En Chrome o Edge, usa el icono *Instalar* de la barra de direcciones. En el móvil, elige *Añadir a pantalla de inicio*.

## 2. Roles

| | Usuario estándar | Administrador |
|---|:---:|:---:|
| Ver catálogo y hacer pedidos | ✅ | ✅ |
| Ver y exportar **sus** pedidos | ✅ | ✅ |
| Cancelar sus pedidos pendientes | ✅ | ✅ |
| Ver los pedidos de **toda la empresa** y cambiar su estado | — | ✅ |
| Alta, edición, desactivación y borrado de productos | — | ✅ |
| Cuadro de mando y feed de actividad | — | ✅ |
| Gestionar roles de usuario | — | ✅ |
| Publicar avisos | — | ✅ |

## 3. Acceso

### 3.1 Iniciar sesión
1. Abre la aplicación. Si no tienes sesión, verás la pantalla **Inicia sesión**.
2. Escribe tu email corporativo y tu contraseña. Puedes mostrar u ocultar la contraseña con el icono del ojo.
3. Pulsa **Entrar**. Si el email o la contraseña no son correctos, verás un aviso en rojo bajo el formulario.

Marca **Recordar mi email en este dispositivo** para que la próxima vez el email aparezca ya escrito. Solo se guarda el email, nunca la contraseña.

La sesión se mantiene aunque cierres el navegador. Si caduca, la app te pedirá entrar de nuevo y te devolverá a la pantalla en la que estabas.

#### Acceso rápido de demostración
Debajo del botón **Entrar** hay un panel para probar la aplicación sin escribir credenciales:
- **Modo · Administrador**: rellena automáticamente el email y la contraseña de la cuenta de administrador.
- **Modo · Usuario**: abre un desplegable con las cuentas de usuario estándar (nombre, departamento y email). Elige una con el ratón o con las flechas y Enter.

Las credenciales se escriben solas en el formulario y aparece una etiqueta con la cuenta cargada (pulsa **×** para quitarla). Después pulsa **Entrar**.

### 3.2 Crear una cuenta
1. En la pantalla de acceso pulsa **Crea una cuenta de usuario**.
2. Rellena nombre, email, departamento y contraseña.
   - Mientras escribes el email, la app **comprueba si ya está registrado** y te indica «Email disponible» o «Email ya registrado».
   - La contraseña debe tener **8 caracteres o más, una mayúscula, una minúscula y un número**. La lista de requisitos se marca en verde a medida que los cumples.
3. Pulsa **Leer la política de uso de datos** para ver el texto completo. Puedes aceptarla desde la propia ventana con **He leído y acepto** o marcando la casilla.
4. Si quieres, marca **Recordar mi email en este dispositivo**.
5. Pulsa **Crear cuenta**. Si cambias de idea, usa **← Volver al inicio de sesión** en la parte superior.

### 3.3 Cerrar sesión
Abre el menú lateral y pulsa **Cerrar sesión**, abajo del todo.

## 4. Navegación

- **Ordenador:** el menú lateral está siempre visible a la izquierda.
- **Móvil y tablet:** pulsa el botón **☰** de la cabecera para abrirlo.
- El menú muestra tu nombre, tu email y tu rol, y solo las secciones a las que tienes acceso.
- En la parte inferior del menú puedes cambiar entre **modo claro y oscuro**.

## 5. Inicio

Resume tu actividad:
- **Indicadores**: número de pedidos, pedidos en curso, importe del año y productos disponibles.
- **Últimos pedidos**: pulsa uno para ver su detalle.
- **Avisos de empresa**: comunicados publicados por los administradores. Aparecen **al instante**, sin recargar.

En el móvil, desliza hacia abajo para actualizar.

## 6. Catálogo

1. **Busca** por nombre, SKU o categoría en el buscador.
2. **Filtra** por categoría o activa **Solo con stock**.
3. Cambia entre la vista de **Tarjetas** y la de **Tabla**. En la tabla puedes **ordenar** pulsando la cabecera de cada columna.
4. Cada producto indica su estado con color, icono y texto: **En stock**, **Stock bajo** o **Agotado**.
5. Pulsa **Añadir** para llevar el producto a tu pedido. En la parte inferior verás el total y el botón **Revisar pedido**.

> El stock se actualiza solo cuando otro usuario hace un pedido.

**Administradores:** en la vista de tabla tienen botones para **editar**, **desactivar o activar** y **eliminar** cada producto, y el botón **Nuevo producto** en la cabecera.

## 7. Hacer un pedido

1. Abre **Nuevo pedido**, desde el menú o desde el botón del catálogo.
2. Añade productos con el selector **Añadir producto**, o vuelve al catálogo.
3. Ajusta las cantidades con **−** y **+** o escribiendo el número. No se puede superar el stock disponible.
4. Elige la **prioridad** (baja, normal, alta o urgente) y añade **notas** si lo necesitas.
5. Revisa el **total** y pulsa **Confirmar pedido**.

El pedido en curso se guarda automáticamente hasta que lo confirmes. Si mientras tanto otro usuario agota un producto, el sistema te avisará al confirmar y **no se creará un pedido incompleto**.

## 8. Seguimiento de pedidos

En **Pedidos** (o **Mis pedidos**):
- Filtra por estado con las pestañas superiores. Cada una indica cuántos pedidos tiene.
- Busca por código, solicitante o estado.
- Pulsa una fila para abrir el **detalle**: estado, prioridad, fecha, total, notas y líneas.

**Ciclo de vida de un pedido**

```
Pendiente ──▶ Aprobado ──▶ Enviado ──▶ Entregado
    │             │
    └──────┬──────┘
           ▼
       Cancelado   (se repone el stock)
```

- **Usuario estándar:** puede **cancelar** sus pedidos mientras estén *Pendientes*.
- **Administrador:** usa los botones del detalle para aprobar, marcar como enviado o entregado, o cancelar.
- Cuando cambia el estado de uno de tus pedidos recibes un **aviso al momento**.

## 9. Informes (PDF y CSV)

1. Abre **Informes** y elige el **periodo**: mes actual, 3, 6 o 12 meses.
2. Pulsa **PDF** o **CSV** en el informe que quieras.

| Informe | Contenido | Disponible para |
|---|---|---|
| Pedidos | Código, fecha, estado, prioridad, líneas, unidades y total | Todos (el usuario estándar solo ve los suyos) |
| Inventario | Stock, mínimo, valoración y nivel de cada producto | Todos |
| Ventas por categoría | Pedidos, unidades, facturación y porcentaje del total | Administrador |
| Detalle de líneas | Cada línea vendida con solicitante y departamento | Administrador |

- El **PDF** incluye cabecera corporativa, indicadores resumen, tabla con totales y numeración «Página X de Y».
- El **CSV** usa punto y coma como separador y UTF-8, así que se abre directamente en Excel con acentos y decimales correctos.

## 10. Cuadro de mando (administrador)

- **Periodo:** 3, 6 o 12 meses. Las flechas de tendencia comparan con el periodo anterior de la misma duración.
- **Filtros:** categoría y estado. **Todos los gráficos e indicadores se recalculan al instante.**
- **Interacción:**
  - Pulsa un sector de **Ventas por categoría** para filtrar por esa categoría. Púlsalo otra vez para quitar el filtro.
  - Pulsa una barra de **Pedidos por estado** o la tarjeta **Cancelados** para filtrar por estado.
  - **Ver datos** muestra cualquier gráfico como tabla.
- **Stock crítico:** productos en el mínimo o por debajo. Pulsa uno para editarlo.
- **Actividad en tiempo real:** pedidos nuevos, cambios de estado, altas de producto, alertas de stock y cambios de rol. Pulsa un evento para ir al pedido o producto.
- **Conectados ahora:** usuarios con la aplicación abierta.
- Los iconos de la cabecera descargan el **informe de ventas** con los filtros aplicados, en CSV o PDF.

## 11. Gestión de productos (administrador)

1. Desde el catálogo, pulsa **Nuevo producto** o el icono del lápiz.
2. Rellena los campos. Los obligatorios llevan un asterisco (*).
   - **SKU**: formato `AAA-0000`, por ejemplo `INF-0007`. La app comprueba **al momento** que no esté en uso.
   - **Stock mínimo**: cuando el stock baje de ese valor se generará una alerta.
3. **Imagen del producto**: arrastra una imagen a la zona punteada o pulsa **Elegir imagen**. Se admiten PNG, JPG, WebP o GIF de hasta 10 MB. La aplicación la reduce a 800 px y la convierte a WebP antes de subirla, y verás una vista previa. Usa **Cambiar imagen** o **Quitar imagen** si lo necesitas.
4. Pulsa **Crear producto** o **Guardar cambios**. La imagen se sube a Supabase Storage en ese momento.

Para retirar un producto **sin perder el histórico**, **desactívalo**. Solo se puede **eliminar** un producto que no tenga pedidos.

## 12. Usuarios y avisos (administrador)

- **Usuarios y roles:** usa el icono del escudo para conceder el rol de administrador y el de la persona para retirarlo. No puedes quitarte el rol a ti mismo.
- **Avisos:** escribe título, mensaje, nivel (información, novedad o alerta) y etiquetas opcionales, y pulsa **Publicar**. El aviso aparece al instante en la pantalla de Inicio de todos los usuarios. En **Ver documento JSON** puedes ver cómo se guarda.

## 13. Accesibilidad

En **Accesibilidad** puedes:
- **aumentar o reducir el texto**, del 87,5 % al 150 %,
- elegir **tema claro, oscuro o el del sistema**,
- activar el **alto contraste**.

**Uso con teclado**

| Tecla | Acción |
|---|---|
| `Tab` / `Mayús + Tab` | Moverse entre elementos |
| `Enter` / `Espacio` | Activar botones, enlaces y filas de tabla |
| `Esc` | Cerrar diálogos, menús y desplegables |
| `←` `→` | Cambiar de pestaña en los selectores segmentados |

Al cargar cualquier pantalla, el primer `Tab` muestra el enlace **Saltar al contenido principal**. La app es compatible con lectores de pantalla (NVDA, JAWS, VoiceOver y TalkBack), que anuncian los avisos y los cambios de página.

## 14. Preguntas frecuentes

**No puedo entrar en el Cuadro de mando.** Esa sección es solo para administradores. Pide el rol a un administrador.

**He añadido un producto pero el pedido falla por stock.** Otro usuario ha pedido ese producto a la vez. Ajusta la cantidad al stock que muestra el mensaje.

**El CSV se ve en una sola columna en Excel.** Ábrelo con *Datos › Desde texto/CSV* y elige el punto y coma como separador.

**¿Funciona sin conexión?** La aplicación se carga sin conexión gracias al service worker, pero los datos necesitan conexión. Si se pierde, verás un aviso y un botón **Reintentar**.
