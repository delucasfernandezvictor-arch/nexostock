-- =============================================================================
--  NexoStock · Datos SINTÉTICOS de prueba
-- -----------------------------------------------------------------------------
--  Ejecutar en Supabase > SQL Editor DESPUÉS de schema.sql y DESPUÉS de crear
--  los dos usuarios de prueba en Authentication > Users (ver README):
--     · admin@example.com    → se promociona a administrador
--     · usuario@example.com  → usuario estándar
--  Todos los datos son ficticios (dominio reservado example.com, RFC 2606).
--  No contiene datos personales reales ni contraseñas.
-- =============================================================================

-- 1. Rol administrador para la cuenta de pruebas
update public.profiles set role = 'admin', nombre = 'Admin Demo', departamento = 'Dirección'
 where email = 'admin@example.com';
update public.profiles set nombre = 'Usuario Demo', departamento = 'Logística'
 where email = 'usuario@example.com';

-- 2. Categorías
insert into public.categorias (nombre, color) values
  ('Informática',  '#3b4cca'),
  ('Periféricos',  '#0b7a75'),
  ('Redes',        '#7c3aed'),
  ('Mobiliario',   '#b45309'),
  ('Papelería',    '#be185d'),
  ('Audiovisual',  '#15803d'),
  ('Almacenaje',   '#475569'),
  ('Seguridad',    '#b91c1c')
on conflict (nombre) do nothing;

-- 3. Productos (SKU con formato AAA-0000)
insert into public.productos (sku, nombre, descripcion, categoria_id, precio, stock, stock_minimo)
select v.sku, v.nombre, v.descripcion, c.id, v.precio, v.stock, v.minimo
from (values
  ('INF-0001', 'Portátil 14" i5 16 GB',          'Equipo de trabajo estándar',            'Informática', 849.00, 34, 8),
  ('INF-0002', 'Portátil 16" i7 32 GB',          'Equipo para desarrollo',                'Informática', 1299.00, 12, 4),
  ('INF-0003', 'Sobremesa compacto Ryzen 5',     'Puesto fijo de oficina',                'Informática', 629.00, 21, 5),
  ('INF-0004', 'Monitor 27" QHD',                'Panel IPS 75 Hz',                       'Informática', 279.00, 46, 10),
  ('INF-0005', 'Monitor 24" FHD',                'Panel IPS regulable en altura',         'Informática', 149.00, 3, 10),
  ('INF-0006', 'Tablet 11" 128 GB',              'Para personal de almacén',              'Informática', 399.00, 18, 5),
  ('PER-0001', 'Teclado inalámbrico ES',         'Distribución española',                 'Periféricos', 39.90, 120, 25),
  ('PER-0002', 'Ratón ergonómico vertical',      'Reduce la tensión de muñeca',           'Periféricos', 44.50, 64, 20),
  ('PER-0003', 'Auriculares con micrófono USB',  'Cancelación de ruido',                  'Periféricos', 59.00, 80, 20),
  ('PER-0004', 'Webcam 1080p',                   'Con obturador de privacidad',           'Periféricos', 69.00, 4, 10),
  ('PER-0005', 'Dock USB-C 12 en 1',             'Doble salida HDMI',                     'Periféricos', 129.00, 27, 8),
  ('PER-0006', 'Impresora láser multifunción',   'Dúplex y red',                          'Periféricos', 319.00, 9, 3),
  ('RED-0001', 'Switch 24 puertos gestionable',  'PoE+ 370 W',                            'Redes', 489.00, 7, 2),
  ('RED-0002', 'Punto de acceso Wi-Fi 6',        'Montaje en techo',                      'Redes', 159.00, 22, 6),
  ('RED-0003', 'Router empresarial VPN',         'Doble WAN',                             'Redes', 349.00, 5, 2),
  ('RED-0004', 'Cable Cat6 rollo 305 m',         'Cobre sólido',                          'Redes', 119.00, 14, 4),
  ('MOB-0001', 'Silla ergonómica',               'Soporte lumbar regulable',              'Mobiliario', 229.00, 30, 6),
  ('MOB-0002', 'Mesa elevable eléctrica',        'Memoria de 3 alturas',                  'Mobiliario', 459.00, 11, 3),
  ('MOB-0003', 'Cajonera con ruedas',            'Tres cajones con cerradura',            'Mobiliario', 129.00, 25, 5),
  ('MOB-0004', 'Lámpara LED de escritorio',      'Temperatura de color regulable',        'Mobiliario', 34.90, 2, 8),
  ('PAP-0001', 'Paquete folios A4 (500)',        '80 g/m²',                               'Papelería', 5.20, 600, 100),
  ('PAP-0002', 'Cuaderno corporativo A5',        'Tapa dura',                             'Papelería', 6.90, 210, 50),
  ('PAP-0003', 'Bolígrafos azules (caja 50)',    'Punta media',                           'Papelería', 12.50, 95, 20),
  ('PAP-0004', 'Archivador de palanca',          'Lomo ancho',                            'Papelería', 3.10, 340, 60),
  ('AUD-0001', 'Proyector Full HD',              '4000 lúmenes',                          'Audiovisual', 689.00, 6, 2),
  ('AUD-0002', 'Pantalla interactiva 65"',       'Táctil 4K',                             'Audiovisual', 2190.00, 2, 1),
  ('AUD-0003', 'Sistema de videoconferencia',    'Cámara PTZ + barra de sonido',          'Audiovisual', 1150.00, 4, 1),
  ('AUD-0004', 'Altavoz Bluetooth sala',         'Para reuniones pequeñas',               'Audiovisual', 89.00, 17, 4),
  ('ALM-0001', 'SSD externo 1 TB',               'USB 3.2',                               'Almacenaje', 99.00, 55, 12),
  ('ALM-0002', 'NAS 4 bahías',                   'RAID 5',                                'Almacenaje', 579.00, 6, 2),
  ('ALM-0003', 'Disco duro 8 TB NAS',            '7200 rpm',                              'Almacenaje', 219.00, 19, 6),
  ('ALM-0004', 'Memoria USB 64 GB (pack 5)',     'Cifrado por hardware',                  'Almacenaje', 49.00, 40, 10),
  ('SEG-0001', 'Cámara IP exterior',             'Visión nocturna',                       'Seguridad', 139.00, 13, 4),
  ('SEG-0002', 'Lector de tarjetas de acceso',   'RFID 13,56 MHz',                        'Seguridad', 189.00, 8, 3),
  ('SEG-0003', 'Llave de seguridad FIDO2',       'Autenticación multifactor',             'Seguridad', 49.00, 70, 15),
  ('SEG-0004', 'SAI 1500 VA',                    'Onda senoidal pura',                    'Seguridad', 269.00, 10, 3)
) as v(sku, nombre, descripcion, categoria, precio, stock, minimo)
join public.categorias c on c.nombre = v.categoria
on conflict (sku) do nothing;

-- 4. Pedidos sintéticos repartidos en los últimos 12 meses
--    (solo si todavía no hay pedidos; no descuenta stock real)
do $$
declare
  v_users   uuid[];
  v_estados public.pedido_estado[] := array['entregado','entregado','entregado','enviado','aprobado','pendiente','cancelado']::public.pedido_estado[];
  v_prior   text[] := array['baja','normal','normal','normal','alta','urgente'];
  v_pid     bigint;
  v_fecha   timestamptz;
  v_total   numeric(12, 2);
  v_prod    record;
  i int; j int;
begin
  if exists (select 1 from public.pedidos) then
    raise notice 'Ya existen pedidos: no se generan datos de ejemplo';
    return;
  end if;

  select array_agg(id) into v_users from public.profiles;
  if v_users is null then
    raise notice 'No hay usuarios: crea primero los usuarios de prueba en Authentication';
    return;
  end if;

  for i in 1..240 loop
    -- más pedidos en los meses recientes para que la tendencia sea visible
    v_fecha := now() - (power(random(), 1.35) * interval '360 days');
    insert into public.pedidos (usuario_id, estado, prioridad, notas, created_at, updated_at)
    values (
      v_users[1 + floor(random() * array_length(v_users, 1))::int],
      case when v_fecha > now() - interval '10 days'
           then (array['pendiente','aprobado','enviado']::public.pedido_estado[])[1 + floor(random() * 3)::int]
           else v_estados[1 + floor(random() * array_length(v_estados, 1))::int] end,
      v_prior[1 + floor(random() * array_length(v_prior, 1))::int],
      case when random() < 0.25 then 'Entrega en planta 2, recepción' else null end,
      v_fecha, v_fecha
    ) returning id into v_pid;

    v_total := 0;
    for v_prod in
      select id, precio from public.productos order by random() limit (1 + floor(random() * 4))::int
    loop
      j := case when v_prod.precio < 20 then 5 + floor(random() * 30)::int
                when v_prod.precio < 150 then 1 + floor(random() * 8)::int
                else 1 + floor(random() * 3)::int end;
      insert into public.pedido_lineas (pedido_id, producto_id, cantidad, precio_unitario)
      values (v_pid, v_prod.id, j, v_prod.precio);
      v_total := v_total + j * v_prod.precio;
    end loop;

    update public.pedidos set total = v_total where id = v_pid;
  end loop;
end $$;

-- 5. Documentos NoSQL de ejemplo (colección "avisos")
insert into public.documentos (coleccion, data, autor_id)
select 'avisos', d.data, (select id from public.profiles where email = 'admin@example.com')
from (values
  ('{"titulo":"Inventario trimestral","texto":"El viernes se realizará el recuento de almacén. Los pedidos se aprobarán el lunes.","nivel":"info"}'::jsonb),
  ('{"titulo":"Nuevos portátiles disponibles","texto":"Ya puedes solicitar el modelo 16\" i7 para perfiles de desarrollo.","nivel":"exito","etiquetas":["informática","novedad"]}'::jsonb)
) as d(data)
where not exists (select 1 from public.documentos where coleccion = 'avisos');
