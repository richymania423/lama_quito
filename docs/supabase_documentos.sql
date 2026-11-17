-- =====================================================================
-- Documentación · L.A.M.A. Capítulo Quito
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
--
-- Quién puede qué (se aplica en la base de datos, no solo en la pantalla):
--   - Ver y descargar: cualquier usuario con sesión iniciada
--   - Subir, editar y eliminar: administrador y secretario
-- =====================================================================

-- 1) Tabla con los datos de cada documento
create table if not exists public.documentos (
  id              text primary key,
  titulo          text not null,
  descripcion     text,
  categoria       text not null default 'Otros'
                  check (categoria in ('Estatutos', 'Reglamentos', 'Actas', 'Otros')),
  archivo_path    text not null,   -- ruta dentro del bucket
  nombre_archivo  text,            -- nombre original del archivo
  mime            text,
  tamano          bigint,          -- bytes
  subido_por      text,            -- cédula o usuario de quien lo subió
  creado          timestamptz default now()
);

alter table public.documentos enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.documentos to authenticated;

drop policy if exists "documentos_select" on public.documentos;
create policy "documentos_select" on public.documentos
  for select to authenticated using (true);

drop policy if exists "documentos_insert" on public.documentos;
create policy "documentos_insert" on public.documentos
  for insert to authenticated
  with check (public.rol_actual() in ('admin', 'secretario'));

drop policy if exists "documentos_update" on public.documentos;
create policy "documentos_update" on public.documentos
  for update to authenticated
  using (public.rol_actual() in ('admin', 'secretario'))
  with check (public.rol_actual() in ('admin', 'secretario'));

drop policy if exists "documentos_delete" on public.documentos;
create policy "documentos_delete" on public.documentos
  for delete to authenticated
  using (public.rol_actual() in ('admin', 'secretario'));

-- 2) Bucket PRIVADO "documentos": máximo 10 MB por archivo y solo estos tipos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos', 'documentos', false, 10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3) Políticas del bucket
drop policy if exists "documentos_storage_select" on storage.objects;
create policy "documentos_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos');

drop policy if exists "documentos_storage_insert" on storage.objects;
create policy "documentos_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and public.rol_actual() in ('admin', 'secretario'));

drop policy if exists "documentos_storage_update" on storage.objects;
create policy "documentos_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and public.rol_actual() in ('admin', 'secretario'))
  with check (bucket_id = 'documentos' and public.rol_actual() in ('admin', 'secretario'));

drop policy if exists "documentos_storage_delete" on storage.objects;
create policy "documentos_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and public.rol_actual() in ('admin', 'secretario'));
