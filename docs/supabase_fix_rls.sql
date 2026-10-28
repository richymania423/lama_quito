-- =====================================================================
-- CORRECCIÓN DE PERMISOS (RLS) · Secretario LAMA
-- Ejecuta este script en: Supabase -> SQL Editor -> New query -> Run
-- Soluciona el error: "permission denied for table socios" (42501)
--
-- Es seguro ejecutarlo varias veces: elimina las políticas si ya
-- existen y las vuelve a crear.
-- =====================================================================

-- Asegura que RLS esté habilitado
alter table public.socios     enable row level security;
alter table public.asambleas  enable row level security;
alter table public.asistencia enable row level security;

-- -------------------- SOCIOS --------------------
drop policy if exists "socios_select_anon" on public.socios;
drop policy if exists "socios_insert_anon" on public.socios;
drop policy if exists "socios_update_anon" on public.socios;
drop policy if exists "socios_delete_anon" on public.socios;

create policy "socios_select_anon" on public.socios for select using (true);
create policy "socios_insert_anon" on public.socios for insert with check (true);
create policy "socios_update_anon" on public.socios for update using (true) with check (true);
create policy "socios_delete_anon" on public.socios for delete using (true);

-- -------------------- ASAMBLEAS --------------------
drop policy if exists "asambleas_select_anon" on public.asambleas;
drop policy if exists "asambleas_insert_anon" on public.asambleas;
drop policy if exists "asambleas_update_anon" on public.asambleas;
drop policy if exists "asambleas_delete_anon" on public.asambleas;

create policy "asambleas_select_anon" on public.asambleas for select using (true);
create policy "asambleas_insert_anon" on public.asambleas for insert with check (true);
create policy "asambleas_update_anon" on public.asambleas for update using (true) with check (true);
create policy "asambleas_delete_anon" on public.asambleas for delete using (true);

-- -------------------- ASISTENCIA --------------------
drop policy if exists "asistencia_select_anon" on public.asistencia;
drop policy if exists "asistencia_insert_anon" on public.asistencia;
drop policy if exists "asistencia_update_anon" on public.asistencia;
drop policy if exists "asistencia_delete_anon" on public.asistencia;

create policy "asistencia_select_anon" on public.asistencia for select using (true);
create policy "asistencia_insert_anon" on public.asistencia for insert with check (true);
create policy "asistencia_update_anon" on public.asistencia for update using (true) with check (true);
create policy "asistencia_delete_anon" on public.asistencia for delete using (true);

-- -------------------- PERMISOS DE TABLA (GRANT) --------------------
-- El mensaje de error sugería explícitamente otorgar privilegios al rol anon.
grant usage on schema public to anon;
grant select, insert, update, delete on public.socios     to anon;
grant select, insert, update, delete on public.asambleas  to anon;
grant select, insert, update, delete on public.asistencia to anon;
