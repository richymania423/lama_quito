-- =====================================================================
-- Copilotos · L.A.M.A. Capítulo Quito
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
--
-- Quién puede qué (se aplica en la base de datos, no solo en la pantalla):
--   - Ver: cualquier usuario con sesión iniciada
--   - Crear, editar y eliminar: solo administrador
-- =====================================================================

create table if not exists public.copilotos (
  id               text primary key,
  nombre           text not null,
  parentesco       text,
  tipo_sangre      text,
  fecha_nacimiento date,
  -- socio con quien tiene afinidad; si el socio se elimina, el copiloto se conserva sin asignar
  socio_id         text references public.socios(id) on delete set null,
  creado           timestamptz default now()
);

create index if not exists idx_copilotos_socio on public.copilotos(socio_id);

alter table public.copilotos enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.copilotos to authenticated;

drop policy if exists "copilotos_select" on public.copilotos;
create policy "copilotos_select" on public.copilotos
  for select to authenticated using (true);

drop policy if exists "copilotos_insert" on public.copilotos;
create policy "copilotos_insert" on public.copilotos
  for insert to authenticated with check (public.rol_actual() = 'admin');

drop policy if exists "copilotos_update" on public.copilotos;
create policy "copilotos_update" on public.copilotos
  for update to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

drop policy if exists "copilotos_delete" on public.copilotos;
create policy "copilotos_delete" on public.copilotos
  for delete to authenticated using (public.rol_actual() = 'admin');
