-- =====================================================================
-- Rango de socio · L.A.M.A. Capítulo Quito
-- Ejecuta en: Supabase -> SQL Editor -> New query -> Run
-- Es seguro ejecutarlo varias veces.
-- =====================================================================

-- 1) Columna del rango (vacío = sin rango)
alter table public.socios add column if not exists rango text;

-- 2) Solo se permiten estos valores
alter table public.socios drop constraint if exists socios_rango_valido;
alter table public.socios add constraint socios_rango_valido check (
  rango is null or rango in (
    'Presidente', 'Vicepresidente', 'Tesorero', 'Secretario',
    'Oficial de Mototurismo', 'Gerente de Negocios',
    'Full Color', 'Rocket Prospect', 'Prospecto'
  )
);

-- 3) Los 6 cargos de directiva solo pueden tenerlos UN socio a la vez.
--    (Full Color, Rocket Prospect y Prospecto pueden repetirse.)
create unique index if not exists socios_rango_unico on public.socios (rango)
  where rango in (
    'Presidente', 'Vicepresidente', 'Tesorero', 'Secretario',
    'Oficial de Mototurismo', 'Gerente de Negocios'
  );
