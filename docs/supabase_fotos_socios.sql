-- =====================================================================
-- Fotos de socios · L.A.M.A. Capítulo Quito
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
-- =====================================================================

-- 1) Columna con la ruta de la foto dentro del bucket
alter table public.socios add column if not exists foto_path text;

-- 2) Bucket PRIVADO (las fotos solo se ven con sesión iniciada, vía URLs firmadas)
--    Límite de 1 MB por archivo y solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-socios', 'fotos-socios', false, 1048576,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 1048576,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 3) Políticas sobre storage.objects para este bucket
--    - Leer: cualquier usuario autenticado (para generar URLs firmadas)
--    - Subir / cambiar / borrar: solo el administrador
drop policy if exists "fotos_socios_select" on storage.objects;
create policy "fotos_socios_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-socios');

drop policy if exists "fotos_socios_insert" on storage.objects;
create policy "fotos_socios_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-socios' and public.rol_actual() = 'admin');

drop policy if exists "fotos_socios_update" on storage.objects;
create policy "fotos_socios_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos-socios' and public.rol_actual() = 'admin')
  with check (bucket_id = 'fotos-socios' and public.rol_actual() = 'admin');

drop policy if exists "fotos_socios_delete" on storage.objects;
create policy "fotos_socios_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-socios' and public.rol_actual() = 'admin');
