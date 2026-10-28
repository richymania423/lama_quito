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
    // refresca datos de la vista al entrar
    if (name === "dashboard") Dashboard.render();
    if (name === "socios") Socios.render();
    if (name === "asambleas") Asambleas.render();
    if (name === "asistencia") Asistencia.render();
    if (name === "cuadro") Cuadro.render();
  }

  // ---------- Modal ----------
  const backdrop = () => document.getElementById("modalBackdrop");
  function openModal(title, bodyHtml) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    backdrop().classList.remove("hidden");
  }
  function closeModal() { backdrop().classList.add("hidden"); }

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
    // panel "Datos y respaldo": visible solo para quien puede administrarlo (admin)
    const panelRespaldo = document.getElementById("panelRespaldo");
    if (panelRespaldo) {
      panelRespaldo.style.display = Auth.puedeAdministrar("respaldo") ? "" : "none";
    }
  }

  return { setView, openModal, closeModal, toast, esc, fmtFecha, MESES, puede, aplicarPermisos };
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

    // cumpleañeros del mes en curso
    renderCumple(socios);

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

  function renderCumple(socios) {
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
    cont.innerHTML = cumple.map(s => `
      <div class="item">
        <span>🎉 <b>${UI.esc(s.nombre)}</b></span>
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
  a.download = `respaldo-secretario-lama-${new Date().toISOString().slice(0, 10)}.json`;
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

/* ====================== LOGIN / SESIÓN ====================== */
function iniciarSesionUI() {
  document.body.classList.add("auth-ok");
  UI.aplicarPermisos();
  UI.setView("dashboard");
}

function mostrarLogin() {
  document.body.classList.remove("auth-ok");
  const err = document.getElementById("loginError");
  if (err) err.textContent = "";
}

function configurarLogin() {
  const selRol = document.getElementById("loginRol");
  const passWrap = document.getElementById("loginPassWrap");

  // oculta el campo de contraseña para el rol Lectura
  const togglePass = () => {
    passWrap.style.display = selRol.value === "lectura" ? "none" : "";
  };
  selRol.addEventListener("change", togglePass);
  togglePass();

  document.getElementById("formLogin").addEventListener("submit", (e) => {
    e.preventDefault();
    const rol = selRol.value;
    const pass = document.getElementById("loginPass").value;
    const res = Auth.login(rol, pass);
    const err = document.getElementById("loginError");
    if (!res.ok) { err.textContent = res.error; return; }
    err.textContent = "";
    document.getElementById("loginPass").value = "";
    iniciarSesionUI();
  });

  document.getElementById("btnLogout").addEventListener("click", () => {
    Auth.logout();
    mostrarLogin();
  });
}

/* ====================== ARRANQUE ====================== */
document.addEventListener("DOMContentLoaded", () => {
  // navegación
  document.querySelectorAll(".nav-btn").forEach(btn =>
    btn.addEventListener("click", () => UI.setView(btn.dataset.view)));

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
  Cuadro.init();

  // autenticación: restaura sesión o pide login
  configurarLogin();
  if (Auth.cargarSesion()) {
    iniciarSesionUI();
  } else {
    mostrarLogin();
  }
});
