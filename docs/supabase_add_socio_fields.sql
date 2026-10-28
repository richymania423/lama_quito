-- =====================================================================
-- Migración · Secretario LAMA
-- Agrega "tipo de sangre" y "sector de residencia" a la tabla socios.
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces (usa IF NOT EXISTS).
-- =====================================================================

alter table public.socios add column if not exists tipo_sangre       text;
alter table public.socios add column if not exists sector_residencia text;
