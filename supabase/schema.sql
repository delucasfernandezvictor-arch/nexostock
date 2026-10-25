-- =============================================================================
--  NexoStock · Esquema de base de datos (Supabase / PostgreSQL)
-- -----------------------------------------------------------------------------
--  Ejecutar COMPLETO en Supabase > SQL Editor (una sola vez, es idempotente).
--  Después ejecutar seed.sql para cargar datos sintéticos de prueba.
--
--  Orígenes de datos que consume la app:
--   · SQL  (relacional) → tablas profiles, categorias, productos, pedidos,
--                         pedido_lineas + vistas consolidadas. Se consumen por
--                         la API REST de PostgREST (/rest/v1) con HttpClient.
--   · NoSQL (documental) → tabla "documentos": colecciones de documentos JSONB
--                         sin esquema fijo, escuchadas en tiempo real con
--                         Supabase Realtime (WebSocket).
--
--  Seguridad: todo el control de acceso se aplica en el SERVIDOR con
--  Row Level Security (RLS). Los guards del cliente solo mejoran la UX.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pedido_estado as enum ('pendiente', 'aprobado', 'enviado', 'entregado', 'cancelado');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. TABLAS RELACIONALES (SQL)
-- -----------------------------------------------------------------------------

-- Perfil de cada usuario de Supabase Auth (1:1 con auth.users) y su ROL
create table if not exists public.profiles (
  id   uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'user'
);
alter table public.profiles add column if not exists email        text;
alter table public.profiles add column if not exists nombre       text;
alter table public.profiles add column if not exists departamento text;
alter table public.profiles add column if not exists created_at   timestamptz not null default now();
create unique index if not exists profiles_email_key on public.profiles (lower(email));

create table if not exists public.categorias (
  id     smallint generated always as identity primary key,
  nombre text not null unique,
  color  text not null default '#3b4cca'
);

create table if not exists public.productos (
  id           bigint generated always as identity primary key,
  sku          text not null unique check (sku ~ '^[A-Z]{3}-[0-9]{4}$'),
  nombre       text not null check (char_length(nombre) between 3 and 120),
  descripcion  text check (char_length(descripcion) <= 500),
  categoria_id smallint not null references public.categorias (id),
  precio       numeric(10, 2) not null check (precio >= 0),
  stock        integer not null default 0 check (stock >= 0),
  stock_minimo integer not null default 5 check (stock_minimo >= 0),
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists productos_categoria_idx on public.productos (categoria_id);

create table if not exists public.pedidos (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  estado     public.pedido_estado not null default 'pendiente',
  prioridad  text not null default 'normal' check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  notas      text check (char_length(notas) <= 500),
  total      numeric(12, 2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pedidos_usuario_idx on public.pedidos (usuario_id);
create index if not exists pedidos_fecha_idx   on public.pedidos (created_at desc);

create table if not exists public.pedido_lineas (
  id              bigint generated always as identity primary key,
  pedido_id       bigint not null references public.pedidos (id) on delete cascade,
  producto_id     bigint not null references public.productos (id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(10, 2) not null check (precio_unitario >= 0),
  subtotal        numeric(12, 2) generated always as (cantidad * precio_unitario) stored
);
create index if not exists lineas_pedido_idx   on public.pedido_lineas (pedido_id);
create index if not exists lineas_producto_idx on public.pedido_lineas (producto_id);

-- -----------------------------------------------------------------------------
-- 3. ALMACÉN DOCUMENTAL (NoSQL) — colecciones de documentos JSONB
--    coleccion = 'actividad' → log de eventos del sistema (lo escriben triggers)
--    coleccion = 'avisos'    → comunicados que publica el administrador
-- -----------------------------------------------------------------------------
create table if not exists public.documentos (
  id         uuid primary key default gen_random_uuid(),
  coleccion  text not null check (coleccion ~ '^[a-z_]{3,40}$'),
  data       jsonb not null default '{}'::jsonb,
  autor_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists documentos_coleccion_idx on public.documentos (coleccion, created_at desc);
create index if not exists documentos_data_gin      on public.documentos using gin (data);

-- -----------------------------------------------------------------------------
-- 4. FUNCIONES AUXILIARES
-- -----------------------------------------------------------------------------

-- ¿El usuario de la petición (JWT) es administrador? SECURITY DEFINER evita
-- la recursión de RLS al consultar profiles desde las propias políticas.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Crea el perfil automáticamente al registrarse un usuario en Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, departamento)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'departamento', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rellena perfiles de usuarios que ya existían antes de crear el trigger
insert into public.profiles (id, email, nombre)
select id, lower(email), split_part(email, '@', 1) from auth.users
on conflict (id) do update set email = excluded.email,
  nombre = coalesce(public.profiles.nombre, excluded.nombre);

-- Validación asíncrona del formulario de registro: ¿el email está libre?
-- Solo devuelve un booleano (no expone datos del usuario).
create or replace function public.email_disponible(p_email text)
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select not exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;

-- Mantiene updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists productos_touch on public.productos;
create trigger productos_touch before update on public.productos
  for each row execute function public.touch_updated_at();

drop trigger if exists pedidos_touch on public.pedidos;
create trigger pedidos_touch before update on public.pedidos
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 5. LÓGICA DE NEGOCIO TRANSACCIONAL (RPC)
-- -----------------------------------------------------------------------------

-- Crea un pedido con sus líneas en UNA transacción: bloquea las filas de
-- producto (FOR UPDATE), valida stock, descuenta stock y calcula el total.
create or replace function public.crear_pedido(
  p_lineas    jsonb,
  p_notas     text default null,
  p_prioridad text default 'normal'
)
returns public.pedidos
language plpgsql security definer set search_path = public
as $$
declare
  v_pedido public.pedidos;
  v_linea  jsonb;
  v_prod   public.productos;
  v_cant   integer;
  v_total  numeric(12, 2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear pedidos' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'El pedido debe contener al menos una línea' using errcode = '22023';
  end if;

  insert into public.pedidos (usuario_id, notas, prioridad)
  values (auth.uid(), nullif(trim(p_notas), ''), coalesce(p_prioridad, 'normal'))
  returning * into v_pedido;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (v_linea ->> 'cantidad')::integer;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad no válida' using errcode = '22023';
    end if;

    select * into v_prod from public.productos
     where id = (v_linea ->> 'producto_id')::bigint and activo
       for update;
    if not found then
      raise exception 'El producto % no está disponible', v_linea ->> 'producto_id' using errcode = 'P0002';
    end if;
    if v_prod.stock < v_cant then
      raise exception 'Stock insuficiente para "%" (disponible: %)', v_prod.nombre, v_prod.stock using errcode = 'P0001';
    end if;

    update public.productos set stock = stock - v_cant where id = v_prod.id;
    insert into public.pedido_lineas (pedido_id, producto_id, cantidad, precio_unitario)
    values (v_pedido.id, v_prod.id, v_cant, v_prod.precio);
    v_total := v_total + v_cant * v_prod.precio;
  end loop;

  update public.pedidos set total = v_total where id = v_pedido.id returning * into v_pedido;

  insert into public.documentos (coleccion, data, autor_id)
  values ('actividad', jsonb_build_object(
    'tipo', 'pedido_creado',
    'pedido_id', v_pedido.id,
    'total', v_total,
    'lineas', jsonb_array_length(p_lineas),
    'prioridad', v_pedido.prioridad,
    'mensaje', 'Nuevo pedido #' || v_pedido.id || ' por ' || to_char(v_total, 'FM999G999D00') || ' €'
  ), auth.uid());

  return v_pedido;
end;
$$;

-- Cambia el estado de un pedido.
--  · Administrador: cualquier transición (salvo reabrir uno cancelado).
--  · Usuario estándar: solo puede CANCELAR sus propios pedidos PENDIENTES.
-- Al cancelar se repone el stock.
create or replace function public.cambiar_estado_pedido(p_pedido_id bigint, p_estado public.pedido_estado)
returns public.pedidos
language plpgsql security definer set search_path = public
as $$
declare
  v public.pedidos;
begin
  select * into v from public.pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;

  if not public.is_admin() then
    if v.usuario_id <> auth.uid() or p_estado <> 'cancelado' or v.estado <> 'pendiente' then
      raise exception 'No tienes permisos para esta operación' using errcode = '42501';
    end if;
  end if;

  if v.estado = 'cancelado' then
    raise exception 'El pedido ya está cancelado' using errcode = '22023';
  end if;
  if v.estado = p_estado then
    return v;
  end if;

  if p_estado = 'cancelado' then
    update public.productos p
       set stock = p.stock + l.cantidad
      from (select producto_id, sum(cantidad) as cantidad
              from public.pedido_lineas where pedido_id = v.id group by producto_id) l
     where p.id = l.producto_id;
  end if;

  update public.pedidos set estado = p_estado where id = v.id returning * into v;
  return v;
end;
$$;

-- Cambia el rol de un usuario (solo admin; un admin no puede degradarse a sí mismo)
create or replace function public.cambiar_rol(p_usuario_id uuid, p_rol public.user_role)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  v public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501';
  end if;
  if p_usuario_id = auth.uid() and p_rol <> 'admin' then
    raise exception 'No puedes quitarte el rol de administrador a ti mismo' using errcode = '22023';
  end if;
  update public.profiles set role = p_rol where id = p_usuario_id returning * into v;
  if not found then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
  insert into public.documentos (coleccion, data, autor_id)
  values ('actividad', jsonb_build_object(
    'tipo', 'rol_cambiado', 'usuario', v.email, 'rol', p_rol,
    'mensaje', 'Rol de ' || coalesce(v.nombre, v.email) || ' cambiado a ' || p_rol
  ), auth.uid());
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS QUE GENERAN DOCUMENTOS DE ACTIVIDAD (alimentan el feed Realtime)
-- -----------------------------------------------------------------------------
create or replace function public.registrar_actividad()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_doc jsonb;
begin
  if tg_table_name = 'pedidos' then
    if new.estado is distinct from old.estado then
      v_doc := jsonb_build_object(
        'tipo', 'pedido_estado', 'pedido_id', new.id, 'de', old.estado, 'a', new.estado,
        'total', new.total,
        'mensaje', 'Pedido #' || new.id || ': ' || old.estado || ' → ' || new.estado);
    end if;
  elsif tg_table_name = 'productos' then
    if tg_op = 'INSERT' then
      v_doc := jsonb_build_object(
        'tipo', 'producto_creado', 'producto_id', new.id, 'sku', new.sku,
        'mensaje', 'Alta de producto ' || new.sku || ' · ' || new.nombre);
    elsif new.stock <= new.stock_minimo and old.stock > old.stock_minimo then
      v_doc := jsonb_build_object(
        'tipo', 'stock_bajo', 'producto_id', new.id, 'sku', new.sku, 'stock', new.stock,
        'mensaje', 'Stock bajo en ' || new.sku || ' (' || new.stock || ' uds.)');
    end if;
  end if;

  if v_doc is not null then
    insert into public.documentos (coleccion, data, autor_id)
    values ('actividad', v_doc || jsonb_build_object('tabla', tg_table_name), auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_actividad on public.pedidos;
create trigger pedidos_actividad after update of estado on public.pedidos
  for each row execute function public.registrar_actividad();

drop trigger if exists productos_actividad on public.productos;
create trigger productos_actividad after insert or update of stock on public.productos
  for each row execute function public.registrar_actividad();

-- -----------------------------------------------------------------------------
-- 7. VISTAS CONSOLIDADAS (dashboard e informes). security_invoker → aplican RLS
-- -----------------------------------------------------------------------------
create or replace view public.v_lineas_detalle
with (security_invoker = true) as
select
  l.id               as linea_id,
  p.id               as pedido_id,
  p.created_at       as fecha,
  p.estado,
  p.prioridad,
  p.usuario_id,
  pr.email           as usuario_email,
  pr.departamento,
  prod.id            as producto_id,
  prod.sku,
  prod.nombre        as producto,
  c.id               as categoria_id,
  c.nombre           as categoria,
  l.cantidad,
  l.precio_unitario,
  l.subtotal
from public.pedido_lineas l
join public.pedidos    p    on p.id = l.pedido_id
join public.profiles   pr   on pr.id = p.usuario_id
join public.productos  prod on prod.id = l.producto_id
join public.categorias c    on c.id = prod.categoria_id;

create or replace view public.v_pedidos_resumen
with (security_invoker = true) as
select
  p.id, p.created_at, p.updated_at, p.estado, p.prioridad, p.notas, p.total, p.usuario_id,
  pr.email  as usuario_email,
  pr.nombre as usuario_nombre,
  (select count(*) from public.pedido_lineas l where l.pedido_id = p.id)::int        as num_lineas,
  (select coalesce(sum(cantidad), 0) from public.pedido_lineas l where l.pedido_id = p.id)::int as unidades
from public.pedidos p
join public.profiles pr on pr.id = p.usuario_id;

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (control de acceso por rol en el servidor)
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.categorias    enable row level security;
alter table public.productos     enable row level security;
alter table public.pedidos       enable row level security;
alter table public.pedido_lineas enable row level security;
alter table public.documentos    enable row level security;

-- Elimina políticas previas para que el script sea re-ejecutable
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('profiles', 'categorias', 'productos', 'pedidos', 'pedido_lineas', 'documentos')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- PROFILES: cada uno ve el suyo; el admin ve todos. Solo el admin modifica.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_admin" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- CATEGORÍAS: lectura para usuarios autenticados; escritura solo admin
create policy "categorias_select" on public.categorias for select to authenticated using (true);
create policy "categorias_write_admin" on public.categorias for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- PRODUCTOS: el usuario estándar ve los activos; el admin ve y gestiona todos
create policy "productos_select" on public.productos for select to authenticated
  using (activo or public.is_admin());
create policy "productos_insert_admin" on public.productos for insert to authenticated
  with check (public.is_admin());
create policy "productos_update_admin" on public.productos for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "productos_delete_admin" on public.productos for delete to authenticated
  using (public.is_admin());

-- PEDIDOS: cada usuario ve los suyos; el admin, todos. Se crean/modifican por RPC.
create policy "pedidos_select" on public.pedidos for select to authenticated
  using (usuario_id = auth.uid() or public.is_admin());
create policy "pedidos_delete_admin" on public.pedidos for delete to authenticated
  using (public.is_admin());

-- LÍNEAS: visibles si su pedido es visible
create policy "lineas_select" on public.pedido_lineas for select to authenticated
  using (exists (
    select 1 from public.pedidos p
     where p.id = pedido_id and (p.usuario_id = auth.uid() or public.is_admin())));

-- DOCUMENTOS (NoSQL): 'avisos' los lee cualquiera autenticado; 'actividad' solo admin.
-- Solo el admin publica avisos; los documentos de actividad los generan triggers/RPC.
create policy "documentos_select" on public.documentos for select to authenticated
  using (coleccion = 'avisos' or public.is_admin());
create policy "documentos_insert_admin" on public.documentos for insert to authenticated
  with check (public.is_admin() and coleccion = 'avisos');
create policy "documentos_delete_admin" on public.documentos for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- 9. PERMISOS DE EJECUCIÓN DE LAS FUNCIONES
-- -----------------------------------------------------------------------------
revoke execute on function public.crear_pedido(jsonb, text, text)                  from public, anon;
revoke execute on function public.cambiar_estado_pedido(bigint, public.pedido_estado) from public, anon;
revoke execute on function public.cambiar_rol(uuid, public.user_role)              from public, anon;
revoke execute on function public.handle_new_user()                                from public, anon, authenticated;
revoke execute on function public.registrar_actividad()                            from public, anon, authenticated;

grant execute on function public.crear_pedido(jsonb, text, text)                  to authenticated;
grant execute on function public.cambiar_estado_pedido(bigint, public.pedido_estado) to authenticated;
grant execute on function public.cambiar_rol(uuid, public.user_role)              to authenticated;
grant execute on function public.is_admin()                                       to authenticated;
grant execute on function public.email_disponible(text)                           to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. REALTIME: publica los cambios de estas tablas por WebSocket
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['documentos', 'pedidos', 'productos'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Necesario para que los eventos UPDATE/DELETE incluyan la fila anterior
alter table public.documentos replica identity full;
alter table public.pedidos    replica identity full;
