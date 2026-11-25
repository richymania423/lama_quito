-- =====================================================================
-- Sistema de puntos por participación · LAMA QuitoConnect
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Requiere: docs/supabase_rodadas.sql y public.rol_actual() (docs/supabase_auth_perfiles.sql).
-- Es seguro ejecutarlo varias veces.
--
-- Qué hace:
--   1) Tipos de evento en rodadas:
--        Interna                  -> Rodada oficial interna
--        AniversarioCapitulo      -> Aniversario de otro capítulo
--        AniversarioNacional      -> Aniversario nacional
--        AniversarioInternacional -> Aniversario internacional
--        Social                   -> Actividad social o benéfica
--      Si existiera alguna rodada con el tipo anterior "Aniversario", pasa a AniversarioCapitulo.
--   2) rodadas_asistencia.acompanante: el socio fue como acompañante en otra moto (no suma puntos).
--   3) puntos_config: parámetros del puntaje (una sola fila). Ver: cualquier usuario con sesión.
--      Modificar: solo admin.
-- =====================================================================

begin;

-- 1) Tipos de evento -------------------------------------------------
alter table public.rodadas drop constraint if exists rodadas_tipo_check;
update public.rodadas set tipo = 'AniversarioCapitulo' where tipo = 'Aniversario';
alter table public.rodadas add constraint rodadas_tipo_check check (
  tipo in ('Interna', 'AniversarioCapitulo', 'AniversarioNacional', 'AniversarioInternacional', 'Social')
);

-- 2) Socio que asistió como acompañante ------------------------------
alter table public.rodadas_asistencia add column if not exists acompanante boolean not null default false;

-- 3) Parámetros del puntaje ------------------------------------------
create table if not exists public.puntos_config (
  id              text primary key default 'actual' check (id = 'actual'),
  valores         jsonb not null,
  actualizado     timestamptz not null default now(),
  actualizado_por text
);

alter table public.puntos_config enable row level security;
revoke all on public.puntos_config from anon;
grant select, insert, update on public.puntos_config to authenticated;

drop policy if exists "puntos_config_select" on public.puntos_config;
drop policy if exists "puntos_config_insert" on public.puntos_config;
drop policy if exists "puntos_config_update" on public.puntos_config;

create policy "puntos_config_select" on public.puntos_config
  for select to authenticated using (true);
create policy "puntos_config_insert" on public.puntos_config
  for insert to authenticated with check (public.rol_actual() = 'admin');
create policy "puntos_config_update" on public.puntos_config
  for update to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

-- Valores iniciales (no sobrescribe si el administrador ya los cambió)
insert into public.puntos_config (id, valores) values ('actual', '{
  "asamblea": 15,
  "rodadaInterna": 20,
  "aniversarioCapitulo": 60,
  "aniversarioNacional": 80,
  "aniversarioInternacional": 100,
  "social": 40,
  "organizador": 30,
  "porKm": 0.05,
  "maxKmEvento": 1500,
  "bonoMensual": 20,
  "bonoAnual": 250
}'::jsonb)
on conflict (id) do nothing;

commit;

-- Para que la API vea los cambios de inmediato
notify pgrst, 'reload schema';

-- Verificación
select 'tipos' as que, pg_get_constraintdef(oid) as detalle
  from pg_constraint where conname = 'rodadas_tipo_check'
union all
select 'acompanante', data_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'rodadas_asistencia' and column_name = 'acompanante'
union all
select 'puntos_config', valores::text from public.puntos_config;
