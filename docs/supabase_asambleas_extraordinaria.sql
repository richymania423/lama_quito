-- =====================================================================
-- Tipo de asamblea (Ordinaria / Extraordinaria) · LAMA QuitoConnect
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
--
-- extraordinaria = false -> Asamblea Ordinaria (valor por defecto)
-- extraordinaria = true  -> Asamblea Extraordinaria
-- Las asambleas existentes quedan como Ordinarias.
-- =====================================================================

alter table public.asambleas
  add column if not exists extraordinaria boolean not null default false;
