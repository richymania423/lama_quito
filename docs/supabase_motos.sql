-- =====================================================================
-- Motocicletas · L.A.M.A. Capítulo Quito
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
--
-- Quién puede qué (se aplica en la base de datos, no solo en la pantalla):
--   - Ver: cualquier usuario con sesión iniciada
--   - Crear, editar y eliminar: solo administrador
-- =====================================================================

create table if not exists public.motos (
  id         text primary key,
  marca      text not null,
  modelo     text,
  color      text,
  anio       integer,
  cilindraje integer,
  placa      text,
  -- socio propietario; si el socio se elimina, la moto se conserva sin asignar
  socio_id   text references public.socios(id) on delete set null,
  creado     timestamptz default now()
);

create index if not exists idx_motos_socio on public.motos(socio_id);

alter table public.motos enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.motos to authenticated;

drop policy if exists "motos_select" on public.motos;
create policy "motos_select" on public.motos
  for select to authenticated using (true);

drop policy if exists "motos_insert" on public.motos;
create policy "motos_insert" on public.motos
  for insert to authenticated with check (public.rol_actual() = 'admin');

drop policy if exists "motos_update" on public.motos;
create policy "motos_update" on public.motos
  for update to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

drop policy if exists "motos_delete" on public.motos;
create policy "motos_delete" on public.motos
  for delete to authenticated using (public.rol_actual() = 'admin');
