-- =====================================================================
-- CORRECCIÓN · Secretario LAMA
-- Da permiso de lectura de la tabla perfiles al rol "authenticated".
-- Soluciona: "permission denied for table perfiles" (42501) al leer el rol.
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================
-- Las políticas RLS ya existen, pero el rol necesita primero el permiso
-- base (GRANT) sobre la tabla. La política "perfiles_select_propio" seguirá
-- limitando a que cada usuario solo vea su propia fila.

grant usage on schema public to authenticated;
grant select on public.perfiles to authenticated;

-- (opcional, para cuando el admin gestione desde la app vía Edge Function
--  no hace falta; la función usa service_role. Esto es solo para la lectura
--  del propio perfil al iniciar sesión.)
