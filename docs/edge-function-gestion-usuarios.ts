// =====================================================================
// Edge Function: gestion-usuarios
// Secretario LAMA · Gestión de acceso de socios (solo admin)
// =====================================================================
// Login por CÉDULA: cada socio con acceso es un usuario de Supabase Auth
// con email sintético "<cedula>@lama.app". El rol (secretario/lectura) se
// guarda en la tabla "perfiles". Esta función crea/actualiza/elimina esos
// usuarios usando la clave service_role, que NUNCA sale del servidor.
//
// Despliegue (desde el panel web de Supabase, sin CLI):
//   1. Supabase -> Edge Functions -> "Create a new function".
//   2. Nombre EXACTO: gestion-usuarios
//   3. Pega TODO este archivo como código y despliega.
//   4. Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (inyectadas por Supabase).
//
// Acciones (todas requieren que el solicitante tenga rol 'admin'):
//   - estado_acceso  : { cedulas: [...] } -> estado de acceso y rol por cédula
//   - guardar_acceso : { cedula, password?, rol, nombre?, socioId? }
//                      crea el usuario si no existe (password obligatoria) o
//                      actualiza su rol / contraseña si ya existe.
//   - quitar_acceso  : { cedula } -> elimina el usuario (quita el acceso)
// =====================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMINIO = "lama.app";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const emailDe = (cedula: string) => `${String(cedula || "").trim()}@${DOMINIO}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    // Usa el secreto SERVICE_KEY (configurado manualmente); si no, cae al nombre estándar.
    const SERVICE_KEY = Deno.env.get("SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SERVICE_KEY) {
      return json({ error: "Falta configurar el secreto SERVICE_KEY en la Edge Function." }, 500);
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Identificar al solicitante por su token.
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "Falta token de autenticación." }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sesión no válida." }, 401);
    const solicitante = userData.user;

    // 2) Verificar que sea admin.
    const { data: perfil, error: perfilErr } = await admin
      .from("perfiles").select("rol").eq("id", solicitante.id).maybeSingle();
    if (perfilErr) {
      return json({ error: "No se pudo leer el perfil: " + perfilErr.message, debug: { id: solicitante.id } }, 403);
    }
    if (!perfil) {
      return json({ error: "No existe perfil para este usuario.", debug: { id: solicitante.id } }, 403);
    }
    if (perfil.rol !== "admin") {
      return json({ error: `Tu rol es '${perfil.rol}', se requiere admin.`, debug: { id: solicitante.id } }, 403);
    }

    const body = await req.json();
    const accion = body.accion;

    // Busca un usuario de Auth por su email (cédula). Devuelve el user o null.
    async function buscarPorCedula(cedula: string) {
      const email = emailDe(cedula);
      // listUsers no filtra por email; paginamos de forma acotada.
      let page = 1;
      while (page <= 20) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const u = data.users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
        if (u) return u;
        if (data.users.length < 200) break;
        page++;
      }
      return null;
    }

    switch (accion) {
      case "estado_acceso": {
        const cedulas: string[] = Array.isArray(body.cedulas) ? body.cedulas : [];
        const emails = new Set(cedulas.map((c) => emailDe(c).toLowerCase()));
        const encontrados: Record<string, { tieneAcceso: boolean; rol: string }> = {};
        let page = 1;
        while (page <= 20) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) throw error;
          for (const u of data.users) {
            const em = (u.email || "").toLowerCase();
            if (emails.has(em)) {
              const ced = em.split("@")[0];
              const { data: p } = await admin.from("perfiles").select("rol").eq("id", u.id).maybeSingle();
              encontrados[ced] = { tieneAcceso: true, rol: p?.rol || "lectura" };
            }
          }
          if (data.users.length < 200) break;
          page++;
        }
        return json({ estado: encontrados });
      }

      case "guardar_acceso": {
        const cedula = String(body.cedula || "").trim();
        const rol = body.rol === "secretario" ? "secretario" : "lectura";
        if (!cedula) return json({ error: "La cédula es obligatoria." }, 400);

        const existente = await buscarPorCedula(cedula);
        if (!existente) {
          // crear usuario nuevo (requiere contraseña)
          if (!body.password || String(body.password).length < 6) {
            return json({ error: "Para crear el acceso, ingresa una contraseña de al menos 6 caracteres." }, 400);
          }
          const { data: creado, error } = await admin.auth.admin.createUser({
            email: emailDe(cedula), password: String(body.password),
            email_confirm: true, user_metadata: { nombre: body.nombre || "" },
          });
          if (error) throw error;
          await admin.from("perfiles").upsert({
            id: creado.user.id, cedula, nombre: body.nombre || "",
            socio_id: body.socioId || null, rol,
          });
          return json({ ok: true, creado: true });
        } else {
          // actualizar rol y, si se envió, la contraseña
          if (body.password && String(body.password).length >= 6) {
            const { error: e1 } = await admin.auth.admin.updateUserById(existente.id, { password: String(body.password) });
            if (e1) throw e1;
          }
          await admin.from("perfiles").upsert({
            id: existente.id, cedula, nombre: body.nombre || "",
            socio_id: body.socioId || null, rol,
          });
          return json({ ok: true, creado: false });
        }
      }

      case "quitar_acceso": {
        const cedula = String(body.cedula || "").trim();
        if (!cedula) return json({ error: "La cédula es obligatoria." }, 400);
        const existente = await buscarPorCedula(cedula);
        if (!existente) return json({ ok: true, nota: "No tenía acceso." });
        if (existente.id === solicitante.id) return json({ error: "No puedes quitar tu propio acceso." }, 400);
        const { error } = await admin.auth.admin.deleteUser(existente.id);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: "Acción no reconocida." }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
