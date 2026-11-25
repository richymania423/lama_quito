-- =====================================================================
-- Rodadas: coordenadas del punto de encuentro · LAMA QuitoConnect
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Requiere haber ejecutado antes docs/supabase_rodadas.sql. Es seguro ejecutarlo varias veces.
--
-- Agrega latitud y longitud (grados decimales, WGS84, como Google Maps) del lugar de
-- encuentro. Son opcionales: las rodadas sin coordenadas siguen igual y no muestran mapa.
-- Los permisos (RLS) de la tabla rodadas no cambian.
-- =====================================================================

alter table public.rodadas add column if not exists encuentro_lat numeric(9,6);
alter table public.rodadas add column if not exists encuentro_lng numeric(9,6);

alter table public.rodadas drop constraint if exists rodadas_encuentro_coord_chk;
alter table public.rodadas add constraint rodadas_encuentro_coord_chk check (
  (encuentro_lat is null and encuentro_lng is null)
  or (encuentro_lat between -90 and 90 and encuentro_lng between -180 and 180)
);

-- Para que la API vea las columnas nuevas de inmediato
notify pgrst, 'reload schema';

-- Verificación: deben aparecer encuentro_lat y encuentro_lng
select column_name, data_type, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public' and table_name = 'rodadas' and column_name like 'encuentro_%';
