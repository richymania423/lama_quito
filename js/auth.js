/**
 * auth.js — Autenticación y control de acceso con Supabase Auth.
 * -------------------------------------------------------------
 * El login usa CÉDULA + contraseña. La app convierte la cédula en un
 * email sintético "<cedula>@lama.app" que es lo que Supabase Auth
 * valida. Tras autenticar, el rol se lee de la tabla "perfiles".
 *
 * Roles:
 *  - admin      : administra todo el portal (incluye gestión de socios/accesos).
 *  - secretario : administra Asambleas y Asistencia; lectura del resto.
 *  - lectura    : solo lectura de Inicio, Socios, Asistencia y Cuadro anual.
 */
const Auth = (() => {
  // Dominio del email sintético. El admin puede usar su propia cédula/usuario.
  const DOMINIO = "lama.app";
  const cedulaAEmail = (cedula) => `${String(cedula || "").trim()}@${DOMINIO}`;

  // Usa el mismo cliente de Supabase que db.js (DB._sb) para compartir sesión.
  const sb = () => (window.DB && window.DB._sb) ? window.DB._sb
    : window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

  const ROLES = {
    admin: {
      nombre: "Administrador",
      ver: ["dashboard", "socios", "asambleas", "asistencia", "cuadro"],
      administrar: ["socios", "asambleas", "asistencia", "cuadro", "respaldo"],
    },
    secretario: {
      nombre: "Secretario",
      ver: ["dashboard", "socios", "asambleas", "asistencia", "cuadro"],
      administrar: ["asambleas", "asistencia"],
    },
    lectura: {
      nombre: "Lectura",
      ver: ["dashboard", "socios", "asistencia", "cuadro"],
      administrar: [],
    },
  };

  let _rol = null;      // rol del usuario actual
  let _usuario = null;  // { id, email, cedula }

  // Lee el rol del usuario autenticado desde la tabla perfiles.
  async function cargarRol() {
    const { data: s } = await sb().auth.getUser();
    const user = s ? s.user : null;
    if (!user) { _rol = null; _usuario = null; return null; }
    const cedula = (user.email || "").split("@")[0];
    _usuario = { id: user.id, email: user.email, cedula };
    const { data, error } = await sb().from("perfiles").select("rol").eq("id", user.id).maybeSingle();
    if (error || !data) { _rol = "lectura"; } // por defecto si no hay perfil aún
    else { _rol = ROLES[data.rol] ? data.rol : "lectura"; }
    return _rol;
  }

  // Restaura la sesión existente (si el usuario ya había iniciado sesión).
  async function cargarSesion() {
    const { data } = await sb().auth.getSession();
    if (data && data.session) { return await cargarRol(); }
    _rol = null; _usuario = null;
    return null;
  }

  // Inicia sesión con cédula o correo + contraseña.
  // Si el valor contiene "@" se usa como email tal cual (p. ej. el admin con
  // correo real); si no, se trata como cédula y se convierte a email sintético.
  async function login(usuario, password) {
    const entrada = String(usuario || "").trim();
    const email = entrada.includes("@") ? entrada : cedulaAEmail(entrada);
    const { error } = await sb().auth.signInWithPassword({ email, password: password || "" });
    if (error) return { ok: false, error: traducir(error.message) };
    await cargarRol();
    return { ok: true };
  }

  async function logout() {
    await sb().auth.signOut();
    _rol = null; _usuario = null;
  }

  // Cambiar la propia contraseña (cualquier usuario autenticado).
  async function cambiarMiPassword(nueva) {
    const { error } = await sb().auth.updateUser({ password: nueva });
    if (error) return { ok: false, error: traducir(error.message) };
    return { ok: true };
  }

  function traducir(msg) {
    const m = (msg || "").toLowerCase();
    if (m.includes("invalid login")) return "Cédula o contraseña incorrectas.";
    if (m.includes("email not confirmed")) return "El usuario aún no está confirmado.";
    if (m.includes("password should be at least")) return "La contraseña es demasiado corta (mínimo 6 caracteres).";
    return msg;
  }

  const rol = () => _rol;
  const usuario = () => _usuario;
  const info = () => (_rol ? ROLES[_rol] : null);
  const estaAutenticado = () => !!_rol;

  function puedeVer(modulo) {
    const r = info();
    return !!r && r.ver.includes(modulo);
  }
  function puedeAdministrar(modulo) {
    const r = info();
    return !!r && r.administrar.includes(modulo);
  }
  function nombreRol() {
    const r = info();
    return r ? r.nombre : "";
  }

  // token de acceso actual (para llamar a la Edge Function de gestión de accesos)
  async function accessToken() {
    const { data } = await sb().auth.getSession();
    return data && data.session ? data.session.access_token : null;
  }

  // Llama a la Edge Function de gestión de accesos (requiere ser admin).
  async function gestionarAcceso(accion, payload = {}) {
    const fn = window.APP_CONFIG.FN_GESTION_USUARIOS || "gestion-usuarios";
    const url = `${window.APP_CONFIG.SUPABASE_URL}/functions/v1/${fn}`;
    const token = await accessToken();
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": window.APP_CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ accion, ...payload }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.log("[auth] gestionarAcceso respuesta:", resp.status, data);
      throw new Error(data.error || `Error ${resp.status}`);
    }
    return data;
  }

  return {
    ROLES, DOMINIO, cedulaAEmail, cargarSesion, login, logout, cambiarMiPassword,
    rol, usuario, info, estaAutenticado, puedeVer, puedeAdministrar,
    nombreRol, accessToken, gestionarAcceso,
  };
})();
window.Auth = Auth;
