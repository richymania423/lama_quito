-- =====================================================================
-- CORRECCIÓN · Secretario LAMA
-- Da permisos a los usuarios autenticados sobre las tablas de datos.
-- Soluciona: "permission denied for table socios/asambleas/asistencia"
-- al operar con la sesión iniciada (rol authenticated).
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
-- =====================================================================

grant usage on schema public to authenticated;

-- Permisos base (GRANT) para usuarios autenticados
grant select, insert, update, delete on public.socios     to authenticated;
grant select, insert, update, delete on public.asambleas  to authenticated;
grant select, insert, update, delete on public.asistencia to authenticated;

-- Políticas RLS para el rol authenticated (además de las que ya existían para anon)
-- SOCIOS
drop policy if exists "socios_all_auth" on public.socios;
create policy "socios_all_auth" on public.socios
  for all to authenticated using (true) with check (true);

-- ASAMBLEAS
drop policy if exists "asambleas_all_auth" on public.asambleas;
create policy "asambleas_all_auth" on public.asambleas
  for all to authenticated using (true) with check (true);

-- ASISTENCIA
drop policy if exists "asistencia_all_auth" on public.asistencia;
create policy "asistencia_all_auth" on public.asistencia
  for all to authenticated using (true) with check (true);
