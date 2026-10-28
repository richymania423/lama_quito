/**
 * config.example.js — Plantilla de configuración de Supabase.
 * -------------------------------------------------------------
 * 1. Copia este archivo como "config.js" (en la misma carpeta js/).
 * 2. Rellena SUPABASE_URL y SUPABASE_ANON_KEY con los datos de tu
 *    proyecto (Supabase → Settings → API).
 * 3. config.js está en .gitignore: NO se sube al repositorio.
 *
 * La clave "anon public" es pública y está pensada para usarse en el
 * navegador; aun así, protege tus tablas con Row Level Security (RLS).
 */
window.APP_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU_CLAVE_ANON_PUBLIC",
};
