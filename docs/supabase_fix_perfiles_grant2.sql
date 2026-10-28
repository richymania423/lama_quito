-- =====================================================================
-- CORRECCIÓN DEFINITIVA · permisos de lectura/escritura de "perfiles"
-- Soluciona: la Edge Function recibe "permission denied for table perfiles".
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

-- Permiso base (GRANT) sobre la tabla para los roles relevantes.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.perfiles
  to anon, authenticated, service_role;

-- Asegurar RLS activo
alter table public.perfiles enable row level security;

-- Política: el propio usuario puede leer su perfil (para conocer su rol al entrar)
drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio" on public.perfiles
  for select to authenticated using (auth.uid() = id);

-- Política amplia para service_role (la Edge Function). service_role normalmente
-- ignora RLS, pero esto lo deja explícito y cubre configuraciones estrictas.
drop policy if exists "perfiles_all_service" on public.perfiles;
create policy "perfiles_all_service" on public.perfiles
  for all to service_role using (true) with check (true);
