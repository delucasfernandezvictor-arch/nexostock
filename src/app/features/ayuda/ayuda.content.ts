/** Sección del manual de usuario integrado. */
export interface SeccionAyuda {
  id: string;
  titulo: string;
  icon: string;
  /** Solo visible para administradores */
  soloAdmin?: boolean;
  /** Ruta relacionada para el enlace "Ir a la pantalla" */
  ruta?: string;
  pasos: string[];
  consejo?: string;
}

/**
 * Contenido del **manual de usuario** embebido en la aplicación.
 * Es la misma información que `docs/MANUAL_USUARIO.md`, estructurada para
 * mostrarse como ayuda contextual y filtrarse por rol y por texto.
 */
export const AYUDA: SeccionAyuda[] = [
  {
    id: 'acceso',
    titulo: 'Acceso, registro y roles',
    icon: 'log-in-outline',
    pasos: [
      'Entra con tu email corporativo y contraseña desde la pantalla «Inicia sesión».',
      'Si no tienes cuenta, pulsa «Crea una cuenta». El sistema comprueba al momento si tu email ya está registrado.',
      'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número. La lista de requisitos se marca mientras escribes.',
      'Las cuentas nuevas son de «Usuario estándar». Un administrador puede concederte el rol «Administrador».',
      'Tu sesión se mantiene al recargar y se renueva sola. Si caduca, se te pedirá iniciar sesión de nuevo y volverás a la pantalla en la que estabas.',
    ],
    consejo: 'Cierra sesión desde el menú lateral si usas un equipo compartido.',
  },
  {
    id: 'navegacion',
    titulo: 'Navegación por la aplicación',
    icon: 'menu-outline',
    pasos: [
      'En ordenador el menú lateral está siempre visible. En móvil y tablet se abre con el botón ☰ de la cabecera.',
      'El menú solo muestra las secciones a las que tu rol tiene acceso.',
      'Pulsa Tab nada más cargar la página para ver el enlace «Saltar al contenido principal».',
      'Desliza hacia abajo en la pantalla de Inicio para actualizar los datos.',
    ],
  },
  {
    id: 'catalogo',
    titulo: 'Consultar el catálogo',
    icon: 'cube-outline',
    ruta: '/app/catalogo',
    pasos: [
      'Busca por nombre, SKU o categoría. Los resultados se filtran mientras escribes.',
      'Filtra por categoría o activa «Solo con stock» para ocultar los productos agotados.',
      'Cambia entre vista de «Tarjetas» y de «Tabla». La tabla permite ordenar por columna.',
      'Cada producto muestra su nivel de stock con color, icono y texto: En stock, Stock bajo o Agotado.',
      'El stock se actualiza en tiempo real cuando otro usuario hace un pedido.',
    ],
  },
  {
    id: 'pedido',
    titulo: 'Hacer un pedido',
    icon: 'cart-outline',
    ruta: '/app/pedidos/nuevo',
    pasos: [
      'Pulsa «Añadir» en los productos del catálogo, o usa el selector de la pantalla «Nuevo pedido».',
      'Ajusta las cantidades con los botones − y +. No puedes superar el stock disponible.',
      'Elige la prioridad y añade notas para el almacén si las necesitas.',
      'Revisa el total y pulsa «Confirmar pedido». El stock se reserva en el momento.',
      'El pedido en curso se guarda aunque cierres la aplicación, hasta que lo confirmes.',
    ],
    consejo: 'Si otro usuario agota un producto mientras preparas tu pedido, el sistema te avisará al confirmar y no se creará nada a medias.',
  },
  {
    id: 'seguimiento',
    titulo: 'Seguimiento de pedidos',
    icon: 'receipt-outline',
    ruta: '/app/pedidos',
    pasos: [
      'En «Pedidos» verás tus pedidos (o todos, si eres administrador), filtrados por estado.',
      'Pulsa una fila o el icono del ojo para ver el detalle y las líneas del pedido.',
      'Ciclo de vida: Pendiente → Aprobado → Enviado → Entregado. Puede cancelarse mientras está Pendiente o Aprobado.',
      'Puedes cancelar tus pedidos mientras estén Pendientes. Al cancelar se repone el stock.',
      'Cuando un administrador cambia el estado de tu pedido, recibes un aviso al instante.',
    ],
  },
  {
    id: 'informes',
    titulo: 'Descargar informes (PDF y CSV)',
    icon: 'document-text-outline',
    ruta: '/app/informes',
    pasos: [
      'En «Informes» elige el periodo y el informe que quieres.',
      '«PDF» genera un documento maquetado, con cabecera, indicadores, tabla y paginación, listo para imprimir o enviar.',
      '«CSV» descarga los datos en formato tabular para Excel u otras hojas de cálculo, con separador punto y coma y codificación UTF-8.',
      'Los usuarios estándar solo exportan sus propios pedidos. Los administradores, los de toda la empresa.',
    ],
  },
  {
    id: 'dashboard',
    titulo: 'Cuadro de mando',
    icon: 'bar-chart-outline',
    ruta: '/app/dashboard',
    soloAdmin: true,
    pasos: [
      'Muestra la facturación, los pedidos, las cancelaciones y el stock crítico del periodo elegido (3, 6 o 12 meses).',
      'La flecha de cada indicador compara con el periodo anterior de la misma duración.',
      'Filtra por categoría y estado con los selectores. Todos los gráficos se recalculan al instante.',
      'Pulsa un sector del gráfico de categorías o una barra de estados para filtrar por él. Pulsa la tarjeta «Cancelados» para ver solo esos pedidos.',
      '«Ver datos» muestra cada gráfico como tabla accesible.',
      'El panel «Actividad en tiempo real» registra pedidos nuevos, cambios de estado, altas y stock bajo según ocurren.',
      'Los botones de la cabecera exportan el informe de ventas filtrado en CSV o PDF.',
    ],
  },
  {
    id: 'productos',
    titulo: 'Gestionar productos',
    icon: 'create-outline',
    ruta: '/app/productos/nuevo',
    soloAdmin: true,
    pasos: [
      'Desde el catálogo pulsa «Nuevo producto» o el icono del lápiz de un producto.',
      'El SKU sigue el formato AAA-0000 y debe ser único. Se comprueba contra la base de datos mientras escribes.',
      'Define el stock mínimo: cuando el stock baje de ese valor se generará una alerta en el cuadro de mando.',
      'Desactiva un producto para ocultarlo del catálogo sin perder su histórico. Eliminarlo solo es posible si no tiene pedidos.',
    ],
  },
  {
    id: 'usuarios',
    titulo: 'Usuarios, roles y avisos',
    icon: 'people-outline',
    ruta: '/app/usuarios',
    soloAdmin: true,
    pasos: [
      'En «Usuarios y roles» puedes conceder o retirar el rol de administrador.',
      'Por seguridad, no puedes quitarte a ti mismo el rol de administrador.',
      'En «Avisos» publicas comunicados que aparecen al instante en la pantalla de Inicio de todos los usuarios.',
    ],
  },
  {
    id: 'accesibilidad',
    titulo: 'Accesibilidad',
    icon: 'accessibility-outline',
    ruta: '/app/accesibilidad',
    pasos: [
      'En «Accesibilidad» puedes aumentar el tamaño del texto hasta el 150 %, activar el alto contraste o elegir tema claro u oscuro.',
      'Toda la aplicación se puede usar solo con teclado: Tab y Mayús+Tab para moverte, Enter o Espacio para activar y Esc para cerrar diálogos.',
      'Compatible con lectores de pantalla (NVDA, JAWS, VoiceOver, TalkBack). Los avisos y cambios de página se anuncian automáticamente.',
    ],
  },
];
