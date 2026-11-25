-- =====================================================================
-- Módulo "Rodadas" · LAMA QuitoConnect
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
--
-- Crea:
--   rodadas             -> fecha, hora de encuentro, hora de salida, lugar de encuentro,
--                          destino, tipo (Interna | Aniversario), distancia (km), socio encargado
--   rodadas_asistencia  -> socios que asistieron a cada rodada
--
-- Permisos (igual que asambleas/asistencia):
--   ver: cualquier usuario con sesión · crear/editar/eliminar: admin y secretario · anon: nada
-- Requiere public.rol_actual() (docs/supabase_auth_perfiles.sql).
-- =====================================================================

begin;

create table if not exists public.rodadas (
  id                 text primary key,
  fecha              date not null,
  hora_encuentro     time,
  hora_salida        time,
  lugar_encuentro    text not null default '',
  destino            text not null default '',
  -- tipos de evento: ver docs/supabase_puntos.sql
  tipo               text not null default 'Interna' constraint rodadas_tipo_check check (tipo in
                       ('Interna', 'AniversarioCapitulo', 'AniversarioNacional', 'AniversarioInternacional', 'Social')),
  distancia_km       numeric(8,1) check (distancia_km is null or distancia_km >= 0),
  socio_encargado_id text references public.socios(id) on delete set null,
  encuentro_lat      numeric(9,6),   -- coordenadas del encuentro (ver supabase_rodadas_coordenadas.sql)
  encuentro_lng      numeric(9,6),
  creado             timestamptz not null default now()
);

create index if not exists rodadas_fecha_idx on public.rodadas (fecha desc);

create table if not exists public.rodadas_asistencia (
  id          text primary key,                       -- "<rodada_id>__<socio_id>"
  rodada_id   text not null references public.rodadas(id) on delete cascade,
  socio_id    text not null references public.socios(id) on delete cascade,
  presente    boolean not null default false,
  acompanante boolean not null default false,          -- fue como acompañante: no suma puntos
  observacion text not null default ''
);

create index if not exists rodadas_asistencia_rodada_idx on public.rodadas_asistencia (rodada_id);
create index if not exists rodadas_asistencia_socio_idx  on public.rodadas_asistencia (socio_id);

alter table public.rodadas            enable row level security;
alter table public.rodadas_asistencia enable row level security;

revoke all on public.rodadas, public.rodadas_asistencia from anon;
grant select, insert, update, delete on public.rodadas, public.rodadas_asistencia to authenticated;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('rodadas', 'rodadas_asistencia')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ---------------------------- RODADAS ----------------------------
create policy "rodadas_select" on public.rodadas
  for select to authenticated using (true);
create policy "rodadas_insert" on public.rodadas
  for insert to authenticated with check (public.rol_actual() in ('admin', 'secretario'));
create policy "rodadas_update" on public.rodadas
  for update to authenticated
  using (public.rol_actual() in ('admin', 'secretario'))
  with check (public.rol_actual() in ('admin', 'secretario'));
create policy "rodadas_delete" on public.rodadas
  for delete to authenticated using (public.rol_actual() in ('admin', 'secretario'));

-- ----------------------- ASISTENCIA A RODADAS -----------------------
create policy "rodadas_asis_select" on public.rodadas_asistencia
  for select to authenticated using (true);
create policy "rodadas_asis_insert" on public.rodadas_asistencia
  for insert to authenticated with check (public.rol_actual() in ('admin', 'secretario'));
create policy "rodadas_asis_update" on public.rodadas_asistencia
  for update to authenticated
  using (public.rol_actual() in ('admin', 'secretario'))
  with check (public.rol_actual() in ('admin', 'secretario'));
create policy "rodadas_asis_delete" on public.rodadas_asistencia
  for delete to authenticated using (public.rol_actual() in ('admin', 'secretario'));

commit;

-- Verificación: 8 políticas (4 por tabla), todas para "authenticated".
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('rodadas', 'rodadas_asistencia')
order by tablename, cmd;
