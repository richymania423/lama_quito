/**
 * app.js — Núcleo de la aplicación: navegación, modal, toast,
 * respaldo y arranque. Expone helpers en window.UI.
 */
const UI = (() => {
  // ---------- Navegación entre vistas ----------
  function setView(name) {
    // control de acceso: si el rol no puede ver el módulo, vuelve a inicio
    if (!Auth.puedeVer(name)) {
      if (name !== "dashboard") toast("No tienes acceso a ese módulo.");
      name = "dashboard";
    }
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    const view = document.getElementById("view-" + name);
    const btn = document.querySelector(`.nav-btn[data-view="${name}"]`);
    if (view) view.classList.add("active");
    if (btn) btn.classList.add("active");
    // el encabezado indica en qué sección estás, ya que el menú permanece oculto
    const etiqueta = document.getElementById("vistaActual");
    if (etiqueta && btn) {
      const txt = btn.querySelector(".nav-txt");
      etiqueta.textContent = txt ? txt.textContent : "";
    }
    // refresca datos de la vista al entrar
    if (name === "dashboard") Dashboard.render();
    if (name === "directiva") Directiva.render();
    if (name === "documentacion") Documentacion.render();
    if (name === "socios") Socios.render();
    if (name === "asambleas") Asambleas.render();
    if (name === "asistencia") Asistencia.render();
    if (name === "rodadas") Rodadas.render();
    if (name === "cuadro") Cuadro.render();
    if (name === "puntaje") Puntaje.render();
  }

  // ---------- Modal ----------
  const backdrop = () => document.getElementById("modalBackdrop");
  function openModal(title, bodyHtml) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    backdrop().classList.remove("hidden");
  }
  function closeModal() {
    if (backdrop().dataset.bloqueado) return; // modal obligatorio (cambio de clave)
    backdrop().classList.add("hidden");
  }
  // Modal que no se puede cerrar hasta completar la acción.
  function openModalObligatorio(title, bodyHtml) {
    openModal(title, bodyHtml);
    backdrop().dataset.bloqueado = "1";
    document.getElementById("modalClose").classList.add("hidden");
  }
  function liberarModal() {
    delete backdrop().dataset.bloqueado;
    document.getElementById("modalClose").classList.remove("hidden");
    backdrop().classList.add("hidden");
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ---------- Utilidades ----------
  function esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmtFecha(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // ---------- Permisos (atajo) ----------
  const puede = (modulo) => Auth.puedeAdministrar(modulo);

  // Oculta/muestra botones de navegación y barra de sesión según el rol
  function aplicarPermisos() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("oculto", !Auth.puedeVer(btn.dataset.view));
    });
    const sr = document.getElementById("sessionRol");
    if (sr) sr.textContent = "Rol: " + Auth.nombreRol();
    // usuario que inició sesión, encima del rol
    const su = document.getElementById("sessionUsuario");
    if (su) {
      const quien = Auth.nombreUsuario();
      su.textContent = quien;
      const u = Auth.usuario();
      su.title = u ? (u.nombre ? `${u.nombre} (${u.cedula})` : quien) : "";
    }
    // panel "Datos y respaldo": visible solo para quien puede administrarlo (admin)
    const panelRespaldo = document.getElementById("panelRespaldo");
    if (panelRespaldo) {
      panelRespaldo.style.display = Auth.puedeAdministrar("respaldo") ? "" : "none";
    }
  }

  return { setView, openModal, openModalObligatorio, liberarModal, closeModal, toast, esc, fmtFecha, MESES, puede, aplicarPermisos };
})();
window.UI = UI;

/* ====================== DASHBOARD ====================== */
const Dashboard = (() => {
  async function render() {
    const [socios, asambleas, asistencia] = await Promise.all([
      DB.socios.listar(), DB.asambleas.listar(), DB.asistencia.todos(),
    ]);
    const activos = socios.filter(s => s.activo).length;
    document.getElementById("statSocios").textContent = socios.length;
    document.getElementById("statActivos").textContent = activos;

    // asambleas realizadas del año en curso (fecha anterior a hoy)
    const hoy = new Date().toISOString().slice(0, 10);
    const anioActual = String(new Date().getFullYear());
    const realizadas = asambleas.filter(a =>
      a.fecha && a.fecha.startsWith(anioActual) && a.fecha < hoy).length;
    document.getElementById("statAsambleas").textContent = realizadas;

    // asistencia promedio
    let promedio = 0;
    if (asambleas.length && activos) {
      const presentes = asistencia.filter(a => a.presente).length;
      promedio = Math.round((presentes / (asambleas.length * socios.length)) * 100) || 0;
    }
    document.getElementById("statPromedio").textContent = promedio + "%";

    // rodadas: realizadas del año, km y próximas salidas
    await renderRodadas(socios, hoy, anioActual);

    // cumpleañeros del mes en curso
    await renderCumple(socios);

    // últimas asambleas
    const cont = document.getElementById("dashUltimas");
    if (!asambleas.length) {
      cont.innerHTML = `<p class="muted">Aún no hay asambleas registradas.</p>`;
    } else {
      cont.innerHTML = asambleas.slice(0, 5).map(a => {
        const asis = asistencia.filter(x => x.asambleaId === a.id && x.presente).length;
        return `<div class="item">
          <span><b>${UI.fmtFecha(a.fecha)}</b> · ${UI.esc(a.lugar || "Sin lugar")}
            ${a.mesCorrespondencia ? `· <span class="muted">${UI.esc(a.mesCorrespondencia)}</span>` : ""}</span>
          <span class="muted">${asis} asistente(s)</span>
        </div>`;
      }).join("");
    }
  }

  // Una rodada cuenta como "realizada" si su fecha ya pasó (o es hoy).
  // Si las tablas de rodadas aún no existen, la sección se muestra vacía sin romper el Inicio.
  async function renderRodadas(socios, hoy, anioActual) {
    const cont = document.getElementById("dashRodadas");
    let rodadas = [];
    try {
      rodadas = await DB.rodadas.listar();
    } catch (err) {
      console.warn("No se pudieron cargar las rodadas:", err);
      document.getElementById("statRodadas").textContent = "—";
      document.getElementById("statKm").textContent = "—";
      cont.innerHTML = `<p class="muted">Las rodadas no están disponibles todavía.</p>`;
      return;
    }
    const realizadas = rodadas.filter(r => r.fecha && r.fecha.startsWith(anioActual) && r.fecha <= hoy);
    const km = realizadas.reduce((t, r) => t + (Number(r.distanciaKm) || 0), 0);
    document.getElementById("statRodadas").textContent = realizadas.length;
    document.getElementById("statKm").textContent = km.toLocaleString("es-EC", { maximumFractionDigits: 1 });

    const proximas = rodadas
      .filter(r => r.fecha && r.fecha >= hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaEncuentro || "").localeCompare(b.horaEncuentro || ""))
      .slice(0, 5);
    if (!proximas.length) {
      cont.innerHTML = `<p class="muted">No hay rodadas programadas.</p>`;
      return;
    }
    const nombre = (id) => { const s = socios.find(x => x.id === id); return s ? s.nombre : ""; };
    cont.innerHTML = proximas.map(r => `
      <div class="item">
        <span><b>${UI.fmtFecha(r.fecha)}</b>${r.horaEncuentro ? ` · ${UI.esc(r.horaEncuentro)}` : ""}
          · ${UI.esc(r.destino || "Destino por definir")}
          <span class="badge ${Puntos.tipo(r.tipo).badge}" title="${UI.esc(Puntos.tipo(r.tipo).nombre)}">${UI.esc(Puntos.tipo(r.tipo).corto)}</span></span>
        <span class="muted">${r.lugarEncuentro ? "Encuentro: " + UI.esc(r.lugarEncuentro) : ""}${nombre(r.socioEncargadoId) ? ` · A cargo: ${UI.esc(nombre(r.socioEncargadoId))}` : ""}</span>
      </div>`).join("");
  }

  async function renderCumple(socios) {
    const mesActual = new Date().getMonth(); // 0-11
    document.getElementById("mesCumple").textContent = UI.MESES[mesActual];

    const cumple = socios
      .filter(s => {
        if (!s.fechaNacimiento) return false;
        // fechaNacimiento en formato YYYY-MM-DD; el mes es el 2do segmento
        const mes = parseInt(s.fechaNacimiento.split("-")[1], 10) - 1;
        return mes === mesActual;
      })
      .map(s => ({ ...s, dia: parseInt(s.fechaNacimiento.split("-")[2], 10) }))
      .sort((a, b) => a.dia - b.dia);

    const cont = document.getElementById("dashCumple");
    if (!cumple.length) {
      cont.innerHTML = `<p class="muted">No hay socios que cumplan años este mes.</p>`;
      return;
    }
    // URLs firmadas de las fotos de los cumpleañeros; si falla se muestran iniciales
    let urls = {};
    try {
      urls = await DB.fotos.urls(cumple.map(s => s.fotoPath));
    } catch (err) {
      console.warn("No se pudieron obtener las fotos de cumpleañeros:", err);
    }

    cont.innerHTML = cumple.map(s => `
      <div class="item">
        <span class="socio-nombre">${Socios.avatarHtml(s.nombre, urls[s.fotoPath], "avatar-md")}<span>🎉 <b>${UI.esc(s.nombre)}</b></span></span>
        <span class="muted">${String(s.dia).padStart(2, "0")} de ${UI.MESES[mesActual]}</span>
      </div>`).join("");
  }

  return { render };
})();
window.Dashboard = Dashboard;

/* ====================== RESPALDO ====================== */
async function handleExport() {
  const data = await DB.exportar();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `respaldo-lama-quitoconnect-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  UI.toast("Respaldo exportado.");
}

function handleImport(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await DB.importar(JSON.parse(reader.result));
      UI.toast("Respaldo importado correctamente.");
      UI.setView("dashboard");
    } catch (e) {
      UI.toast("Error: " + e.message);
    }
    ev.target.value = "";
  };
  reader.readAsText(file);
}

async function handleReset() {
  if (!confirm("¿Seguro que deseas borrar TODOS los datos? Esta acción no se puede deshacer.")) return;
  await DB.borrarTodo();
  UI.toast("Todos los datos fueron borrados.");
  UI.setView("dashboard");
}

/* ====================== MENÚ LATERAL ====================== */
// Se abre con el botón "Menú" y se oculta solo: al elegir una opción, al pulsar fuera,
// con la tecla Esc y, en equipos con ratón, al sacar el puntero del panel.
const Menu = (() => {
  let _timer = null;
  const nav = () => document.getElementById("mainNav");
  const overlay = () => document.getElementById("navOverlay");
  const boton = () => document.getElementById("btnMenu");
  const abierto = () => nav().classList.contains("abierto");

  function abrir() {
    nav().classList.add("abierto");
    overlay().classList.add("abierto");
    boton().setAttribute("aria-expanded", "true");
    const destino = nav().querySelector(".nav-btn.active:not(.oculto)") || nav().querySelector(".nav-btn:not(.oculto)");
    if (destino) destino.focus({ preventScroll: true });
  }

  function cerrar(devolverFoco = false) {
    clearTimeout(_timer);
    if (!abierto()) return;
    nav().classList.remove("abierto");
    overlay().classList.remove("abierto");
    boton().setAttribute("aria-expanded", "false");
    if (devolverFoco) boton().focus({ preventScroll: true });
  }

  function iniciar() {
    boton().addEventListener("click", () => (abierto() ? cerrar(true) : abrir()));
    overlay().addEventListener("click", () => cerrar());
    document.getElementById("btnCerrarMenu").addEventListener("click", () => cerrar(true));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && abierto()) cerrar(true);
    });
    // con ratón: se oculta solo poco después de sacar el puntero del panel
    if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
      nav().addEventListener("mouseenter", () => clearTimeout(_timer));
      nav().addEventListener("mouseleave", () => {
        clearTimeout(_timer);
        _timer = setTimeout(() => cerrar(), 700);
      });
    }
  }

  return { iniciar, abrir, cerrar };
})();

/* ====================== LOGIN / SESIÓN ====================== */
function iniciarSesionUI() {
  document.body.classList.add("auth-ok");
  UI.aplicarPermisos();
  UI.setView("dashboard");
  // clave inicial asignada por el admin: el usuario debe elegir una personal
  Auth.debeCambiarClave().then(d => { if (d) pedirClavePersonal(); }).catch(() => {});
}

function pedirClavePersonal() {
  UI.openModalObligatorio("Elige tu clave personal", `
    <form id="formClavePersonal">
      <p class="muted" style="margin-top:0">Ingresaste con una clave inicial. Por seguridad, define tu propia clave para continuar.</p>
      <div class="form-field">
        <label>Nueva contraseña</label>
        <input type="password" name="nueva" minlength="6" required autocomplete="new-password" placeholder="Mínimo 6 caracteres" />
      </div>
      <div class="form-field">
        <label>Repite la nueva contraseña</label>
        <input type="password" name="repetir" minlength="6" required autocomplete="new-password" />
      </div>
      <p class="login-error" id="claveError"></p>
      <div class="btn-row">
        <button type="submit" class="btn">Guardar contraseña</button>
        <button type="button" class="btn btn-outline" id="claveSalir">Salir</button>
      </div>
    </form>`);
  document.getElementById("claveSalir").addEventListener("click", async () => {
    UI.liberarModal();
    await Auth.logout();
    mostrarLogin();
  });
  document.getElementById("formClavePersonal").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const err = document.getElementById("claveError");
    err.textContent = "";
    const nueva = fd.get("nueva") || "";
    if (nueva.length < 6) { err.textContent = "La contraseña debe tener al menos 6 caracteres."; return; }
    if (nueva !== fd.get("repetir")) { err.textContent = "Las contraseñas no coinciden."; return; }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    const res = await Auth.establecerClavePersonal(nueva);
    if (!res.ok) { err.textContent = res.error; btn.disabled = false; return; }
    UI.liberarModal();
    UI.toast("Contraseña actualizada.");
  });
}

function mostrarLogin() {
  Menu.cerrar();
  document.body.classList.remove("auth-ok");
  const err = document.getElementById("loginError");
  if (err) err.textContent = "";
}

function configurarLogin() {
  const form = document.getElementById("formLogin");
  const btn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cedula = document.getElementById("loginCedula").value;
    const pass = document.getElementById("loginPass").value;
    const err = document.getElementById("loginError");
    err.textContent = "";
    btn.disabled = true;
    btn.textContent = "Ingresando...";
    try {
      const res = await Auth.login(cedula, pass);
      if (!res.ok) { err.textContent = res.error; return; }
      document.getElementById("loginPass").value = "";
      iniciarSesionUI();
    } catch (ex) {
      err.textContent = "Error de conexión: " + (ex.message || ex);
    } finally {
      btn.disabled = false;
      btn.textContent = "Ingresar";
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await Auth.logout();
    mostrarLogin();
  });
}

/* ====================== ARRANQUE ====================== */
document.addEventListener("DOMContentLoaded", () => {
  // navegación (el menú lateral se oculta al elegir una opción)
  document.querySelectorAll(".nav-btn").forEach(btn =>
    btn.addEventListener("click", () => {
      UI.setView(btn.dataset.view);
      Menu.cerrar(true);
    }));
  Menu.iniciar();

  // modal
  document.getElementById("modalClose").addEventListener("click", UI.closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") UI.closeModal();
  });

  // respaldo
  document.getElementById("btnExport").addEventListener("click", handleExport);
  document.getElementById("fileImport").addEventListener("change", handleImport);
  document.getElementById("btnReset").addEventListener("click", handleReset);

  // listeners de módulos
  Socios.init();
  Asambleas.init();
  Asistencia.init();
  Rodadas.init();
  Cuadro.init();
  Documentacion.init();

  // autenticación: restaura sesión o pide login
  configurarLogin();
  Auth.cargarSesion().then((rol) => {
    if (rol) iniciarSesionUI();
    else mostrarLogin();
  }).catch(() => mostrarLogin());
});
