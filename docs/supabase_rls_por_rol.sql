-- =====================================================================
-- Permisos por rol en socios, asambleas y asistencia · L.A.M.A. Capítulo Quito
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
--
-- Qué cambia:
--   ANTES: cualquier usuario con sesión (y posiblemente sin sesión, rol "anon")
--          podía leer y modificar estas tablas llamando directo a la API.
--   AHORA (se aplica en la base de datos, no solo en la pantalla):
--     socios      -> ver: cualquier usuario con sesión · crear/editar/eliminar: solo admin
--     asambleas   -> ver: cualquier usuario con sesión · crear/editar/eliminar: admin y secretario
--     asistencia  -> ver: cualquier usuario con sesión · registrar/eliminar:     admin y secretario
--     Sin sesión (anon): ningún acceso.
--
-- Coincide con los permisos de la aplicación (Auth.ROLES en js/auth.js).
-- La Edge Function usa service_role, que no está sujeta a RLS: la gestión de
-- accesos sigue funcionando igual.
-- Requiere que exista public.rol_actual() (docs/supabase_auth_perfiles.sql).
-- =====================================================================

begin;

-- 1) Quitar TODAS las políticas existentes de estas tres tablas
--    (incluidas las abiertas *_anon y *_all_auth de los scripts iniciales).
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('socios', 'asambleas', 'asistencia')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 2) RLS activo
alter table public.socios     enable row level security;
alter table public.asambleas  enable row level security;
alter table public.asistencia enable row level security;

-- 3) Permisos base: nada para anon; lectura/escritura para authenticated
--    (la RLS de abajo decide qué filas y qué rol).
revoke all on public.socios, public.asambleas, public.asistencia from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.socios, public.asambleas, public.asistencia to authenticated;

-- ---------------------------- SOCIOS ----------------------------
create policy "socios_select" on public.socios
  for select to authenticated using (true);

create policy "socios_insert" on public.socios
  for insert to authenticated
  with check (public.rol_actual() = 'admin');

create policy "socios_update" on public.socios
  for update to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

create policy "socios_delete" on public.socios
  for delete to authenticated
  using (public.rol_actual() = 'admin');

-- --------------------------- ASAMBLEAS ---------------------------
create policy "asambleas_select" on public.asambleas
  for select to authenticated using (true);

create policy "asambleas_insert" on public.asambleas
  for insert to authenticated
  with check (public.rol_actual() in ('admin', 'secretario'));

create policy "asambleas_update" on public.asambleas
  for update to authenticated
  using (public.rol_actual() in ('admin', 'secretario'))
  with check (public.rol_actual() in ('admin', 'secretario'));

create policy "asambleas_delete" on public.asambleas
  for delete to authenticated
  using (public.rol_actual() in ('admin', 'secretario'));

-- --------------------------- ASISTENCIA ---------------------------
create policy "asistencia_select" on public.asistencia
  for select to authenticated using (true);

create policy "asistencia_insert" on public.asistencia
  for insert to authenticated
  with check (public.rol_actual() in ('admin', 'secretario'));

create policy "asistencia_update" on public.asistencia
  for update to authenticated
  using (public.rol_actual() in ('admin', 'secretario'))
  with check (public.rol_actual() in ('admin', 'secretario'));

create policy "asistencia_delete" on public.asistencia
  for delete to authenticated
  using (public.rol_actual() in ('admin', 'secretario'));

commit;

-- 4) Verificación: debe listar 12 políticas (4 por tabla), todas para "authenticated".
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('socios', 'asambleas', 'asistencia')
order by tablename, cmd;

-- =====================================================================
-- Prueba recomendada después de ejecutar:
--   - Admin:      crear/editar un socio, registrar asistencia      -> debe funcionar
--   - Secretario: crear una asamblea y marcar asistencia           -> debe funcionar
--   - Secretario: intentar editar un socio (vía API)               -> debe fallar
--   - Lectura:    ver socios, asistencia y cuadro anual            -> debe funcionar
--
-- Si algo dejara de funcionar y necesitas volver atrás temporalmente,
-- ejecuta docs/supabase_fix_grants_authenticated.sql (reabre la escritura
-- a cualquier usuario con sesión, pero no a anon).
-- =====================================================================
