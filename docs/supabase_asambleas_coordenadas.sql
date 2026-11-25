-- =====================================================================
-- Asambleas: coordenadas del lugar · LAMA QuitoConnect
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
--
-- Agrega latitud y longitud (grados decimales, como Google Maps) del lugar de la asamblea.
-- Son opcionales: las asambleas sin coordenadas siguen igual y no muestran mapa.
-- Los permisos (RLS) de la tabla asambleas no cambian.
-- =====================================================================

alter table public.asambleas add column if not exists lugar_lat numeric(9,6);
alter table public.asambleas add column if not exists lugar_lng numeric(9,6);

alter table public.asambleas drop constraint if exists asambleas_lugar_coord_chk;
alter table public.asambleas add constraint asambleas_lugar_coord_chk check (
  (lugar_lat is null and lugar_lng is null)
  or (lugar_lat between -90 and 90 and lugar_lng between -180 and 180)
);

-- Para que la API vea las columnas nuevas de inmediato
notify pgrst, 'reload schema';

-- Verificación: deben aparecer lugar_lat y lugar_lng
select column_name, data_type, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public' and table_name = 'asambleas' and column_name like 'lugar_%';
