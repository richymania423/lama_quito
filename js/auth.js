/**
 * auth.js — Control de acceso por roles (lado cliente).
 * -------------------------------------------------------------
 * IMPORTANTE: al ser una app estática sin backend, este control
 * organiza la interfaz y evita acciones por error, pero NO es una
 * barrera de seguridad fuerte. Para seguridad real, la autenticación
 * debe hacerse en un backend (p. ej. Supabase Auth). Ver README.
 *
 * Roles:
 *  - admin      : administra todo el portal.
 *  - secretario : administra Asambleas y Asistencia; lectura del resto.
 *  - lectura    : solo lectura de Inicio, Socios, Asistencia y Cuadro anual.
 */
const Auth = (() => {
  const SESION_KEY = "secretario_lama_sesion";

  // Contraseñas por rol. Cámbialas aquí (o migra a backend).
  // Lectura puede entrar sin contraseña.
  const CREDENCIALES = {
    admin: "admin123",
    secretario: "secre123",
    lectura: "",
  };

  const ROLES = {
    admin: {
      nombre: "Administrador",
      // módulos visibles
      ver: ["dashboard", "socios", "asambleas", "asistencia", "cuadro"],
      // módulos que puede administrar (crear/editar/eliminar)
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

  let _rol = null;

  function cargarSesion() {
    try {
      const raw = localStorage.getItem(SESION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && ROLES[s.rol]) _rol = s.rol;
      }
    } catch (e) { _rol = null; }
    return _rol;
  }

  function login(rol, password) {
    if (!ROLES[rol]) return { ok: false, error: "Rol no válido." };
    const esperado = CREDENCIALES[rol] ?? "";
    if (esperado !== "" && password !== esperado) {
      return { ok: false, error: "Contraseña incorrecta." };
    }
    _rol = rol;
    localStorage.setItem(SESION_KEY, JSON.stringify({ rol, desde: Date.now() }));
    return { ok: true };
  }

  function logout() {
    _rol = null;
    localStorage.removeItem(SESION_KEY);
  }

  const rol = () => _rol;
  const info = () => (_rol ? ROLES[_rol] : null);
  const estaAutenticado = () => !!_rol;

  // ¿puede VER este módulo?
  function puedeVer(modulo) {
    const r = info();
    return !!r && r.ver.includes(modulo);
  }

  // ¿puede ADMINISTRAR (editar) este módulo?
  function puedeAdministrar(modulo) {
    const r = info();
    return !!r && r.administrar.includes(modulo);
  }

  function nombreRol() {
    const r = info();
    return r ? r.nombre : "";
  }

  return {
    ROLES, cargarSesion, login, logout, rol, info,
    estaAutenticado, puedeVer, puedeAdministrar, nombreRol,
  };
})();
window.Auth = Auth;
