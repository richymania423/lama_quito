-- =====================================================================
-- Secretario LAMA · Autenticación con roles (Supabase Auth)
-- Login por CÉDULA: el usuario escribe su cédula y la app la convierte
-- en un email sintético "<cedula>@lama.app" para Supabase Auth.
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

-- Tabla de perfiles: un registro por cada usuario de Supabase Auth.
--   rol:    admin | secretario | lectura
--   cedula: cédula del socio (coincide con la parte local del email)
--   socio_id: vínculo opcional con la tabla socios
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  cedula    text,
  nombre    text,
  socio_id  text references public.socios(id) on delete set null,
  rol       text not null default 'lectura'
             check (rol in ('admin', 'secretario', 'lectura')),
  creado    timestamptz default now()
);

alter table public.perfiles enable row level security;

-- Cada usuario puede leer su propio perfil (para conocer su rol al entrar).
drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio" on public.perfiles
  for select using (auth.uid() = id);

-- Función: rol del usuario actual. SECURITY DEFINER evita recursión en RLS.
create or replace function public.rol_actual()
returns text
language sql
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- Trigger: al crear un usuario en auth.users, crea su perfil (rol lectura por
-- defecto) extrayendo la cédula de la parte local del email sintético.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, cedula, rol)
  values (new.id, split_part(new.email, '@', 1), 'lectura')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();
