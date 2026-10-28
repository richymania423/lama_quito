-- =====================================================================
-- Secretario LAMA · Esquema de base de datos para Supabase
-- Ejecuta este script en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

-- ---------- SOCIOS ----------
create table if not exists public.socios (
  id               text primary key,
  nombre           text not null,
  identificacion   text,
  telefono         text,
  email            text,
  fecha_nacimiento date,
  activo           boolean default true,
  creado           timestamptz default now()
);

-- ---------- ASAMBLEAS ----------
create table if not exists public.asambleas (
  id                   text primary key,
  fecha                date,
  hora                 text,
  lugar                text,
  mes_correspondencia  text,
  orden_dia            jsonb default '[]'::jsonb,
  temas                text,
  creado               timestamptz default now()
);

-- ---------- ASISTENCIA ----------
-- id = "<asambleaId>__<socioId>" para que cada socio tenga un único
-- registro por asamblea (upsert por id).
create table if not exists public.asistencia (
  id           text primary key,
  asamblea_id  text references public.asambleas(id) on delete cascade,
  socio_id     text references public.socios(id) on delete cascade,
  presente     boolean default false,
  observacion  text
);

create index if not exists idx_asistencia_asamblea on public.asistencia(asamblea_id);
create index if not exists idx_asistencia_socio    on public.asistencia(socio_id);

-- =====================================================================
-- Row Level Security (RLS)
-- =====================================================================
-- Para una PRIMERA PRUEBA interna, se habilita RLS con políticas abiertas
-- que permiten a la clave anónima leer y escribir. Esto deja las tablas
-- accesibles a cualquiera que tenga la URL + clave anon.
--
-- >>> Para producción, reemplaza estas políticas por reglas basadas en
--     Supabase Auth (p. ej. permitir escritura solo a usuarios con cierto rol).
-- =====================================================================

alter table public.socios     enable row level security;
alter table public.asambleas  enable row level security;
alter table public.asistencia enable row level security;

-- SOCIOS
create policy "socios_select_anon" on public.socios for select using (true);
create policy "socios_insert_anon" on public.socios for insert with check (true);
create policy "socios_update_anon" on public.socios for update using (true) with check (true);
create policy "socios_delete_anon" on public.socios for delete using (true);

-- ASAMBLEAS
create policy "asambleas_select_anon" on public.asambleas for select using (true);
create policy "asambleas_insert_anon" on public.asambleas for insert with check (true);
create policy "asambleas_update_anon" on public.asambleas for update using (true) with check (true);
create policy "asambleas_delete_anon" on public.asambleas for delete using (true);

-- ASISTENCIA
create policy "asistencia_select_anon" on public.asistencia for select using (true);
create policy "asistencia_insert_anon" on public.asistencia for insert with check (true);
create policy "asistencia_update_anon" on public.asistencia for update using (true) with check (true);
create policy "asistencia_delete_anon" on public.asistencia for delete using (true);
