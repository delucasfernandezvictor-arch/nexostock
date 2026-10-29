-- =============================================================================
--  NexoStock · Supabase Storage para las imágenes de producto
-- -----------------------------------------------------------------------------
--  Ejecutar en Supabase > SQL Editor DESPUÉS de schema.sql (es idempotente).
--   · Bucket público "productos": cualquiera puede VER las imágenes.
--   · Solo un administrador (public.is_admin()) puede subir, cambiar o borrar.
--   · Límite de 2 MB y solo formatos de imagen.
-- =============================================================================

-- 1. Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Ruta de la imagen dentro del bucket (p. ej. "INF-0001/1730200000000.webp")
alter table public.productos add column if not exists imagen_path text;

-- 3. Políticas RLS sobre storage.objects
drop policy if exists "productos_img_select" on storage.objects;
drop policy if exists "productos_img_insert_admin" on storage.objects;
drop policy if exists "productos_img_update_admin" on storage.objects;
drop policy if exists "productos_img_delete_admin" on storage.objects;

create policy "productos_img_select" on storage.objects for select to anon, authenticated
  using (bucket_id = 'productos');

create policy "productos_img_insert_admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.is_admin());

create policy "productos_img_update_admin" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.is_admin())
  with check (bucket_id = 'productos' and public.is_admin());

create policy "productos_img_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.is_admin());

-- 4. Que PostgREST vea la columna nueva sin esperar
notify pgrst, 'reload schema';
