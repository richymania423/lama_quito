/**
 * socios.js — Gestión del listado de socios (CRUD + búsqueda).
 */
const Socios = (() => {
  let _cache = [];

  async function render() {
    _cache = await DB.socios.listar();
    // botón "Nuevo socio" solo si puede administrar
    const btnNuevo = document.getElementById("btnNuevoSocio");
    if (btnNuevo) btnNuevo.style.display = UI.puede("socios") ? "" : "none";
    paint(document.getElementById("buscarSocio").value || "");
  }

  function paint(filtro) {
    const q = filtro.trim().toLowerCase();
    const filtrados = _cache.filter(s =>
      !q || s.nombre.toLowerCase().includes(q) || s.identificacion.toLowerCase().includes(q));
    const tbody = document.querySelector("#tablaSocios tbody");

    if (!filtrados.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align:center;padding:1.5rem">
        ${_cache.length ? "Sin resultados para la búsqueda." : "No hay socios. Agrega el primero con “+ Nuevo socio”."}
      </td></tr>`;
      return;
    }

    tbody.innerHTML = filtrados.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${UI.esc(s.nombre)}</td>
        <td>${UI.esc(s.identificacion) || "—"}</td>
        <td>${UI.esc(s.telefono) || "—"}</td>
        <td>${s.fechaNacimiento ? UI.fmtFecha(s.fechaNacimiento) : "—"}</td>
        <td>${s.activo
          ? '<span class="badge badge-active">Activo</span>'
          : '<span class="badge badge-inactive">Inactivo</span>'}</td>
        <td class="row-actions">
          ${UI.puede("socios") ? `
            <button class="icon-btn" title="Editar" data-edit="${s.id}">✏️</button>
            <button class="icon-btn" title="Eliminar" data-del="${s.id}">🗑️</button>
          ` : `<span class="muted">—</span>`}
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    tbody.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => eliminar(b.dataset.del)));
  }

  function abrirForm(id) {
    const s = id ? _cache.find(x => x.id === id) : null;
    UI.openModal(s ? "Editar socio" : "Nuevo socio", `
      <form id="formSocio">
        <input type="hidden" name="id" value="${s ? s.id : ""}" />
        <div class="form-field">
          <label>Nombre completo *</label>
          <input name="nombre" required value="${s ? UI.esc(s.nombre) : ""}" />
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Identificación / Cédula</label>
            <input name="identificacion" value="${s ? UI.esc(s.identificacion) : ""}" />
          </div>
          <div class="form-field">
            <label>Teléfono</label>
            <input name="telefono" value="${s ? UI.esc(s.telefono) : ""}" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Correo electrónico</label>
            <input type="email" name="email" value="${s ? UI.esc(s.email) : ""}" />
          </div>
          <div class="form-field">
            <label>Fecha de nacimiento</label>
            <input type="date" name="fechaNacimiento" value="${s ? (s.fechaNacimiento || "") : ""}" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Tipo de sangre</label>
            <select name="tipoSangre">
              <option value="">— Seleccionar —</option>
              ${["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(t =>
                `<option value="${t}" ${s && s.tipoSangre === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Sector de residencia</label>
            <select name="sectorResidencia">
              <option value="">— Seleccionar —</option>
              ${["Norte", "Sur", "Centro", "Valles"].map(sec =>
                `<option value="${sec}" ${s && s.sectorResidencia === sec ? "selected" : ""}>${sec}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="form-field">
          <label><input type="checkbox" name="activo" style="width:auto;margin-right:.4rem" ${(!s || s.activo) ? "checked" : ""} /> Socio activo</label>
        </div>

        ${UI.puede("socios") ? `
        <fieldset class="acceso-box">
          <legend>Acceso al sistema</legend>
          <p class="muted" style="margin-top:0">El socio ingresa con su <b>cédula</b> como usuario. Marca el acceso y define una contraseña.</p>
          <div class="form-field">
            <label><input type="checkbox" id="chkAcceso" name="tieneAcceso" style="width:auto;margin-right:.4rem" /> Tiene acceso al sistema</label>
          </div>
          <div id="accesoDetalle" class="hidden">
            <div class="form-field">
              <label><input type="checkbox" name="esSecretario" style="width:auto;margin-right:.4rem" /> Es secretario (si no, será solo lectura)</label>
            </div>
            <div class="form-field">
              <label>Contraseña <span class="muted" id="passHint"></span></label>
              <input type="text" name="accesoPassword" minlength="6" placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          <p class="login-error" id="accesoError"></p>
        </fieldset>
        ` : ""}

        <div class="btn-row">
          <button type="submit" class="btn">Guardar</button>
          <button type="button" class="btn btn-outline" id="cancelSocio">Cancelar</button>
        </div>
      </form>`);

    document.getElementById("cancelSocio").addEventListener("click", UI.closeModal);

    // --- sección de acceso (solo admin) ---
    const chkAcceso = document.getElementById("chkAcceso");
    if (chkAcceso) {
      const detalle = document.getElementById("accesoDetalle");
      const passHint = document.getElementById("passHint");
      const toggle = () => detalle.classList.toggle("hidden", !chkAcceso.checked);
      chkAcceso.addEventListener("change", toggle);
      // precargar estado de acceso actual del socio (si tiene cédula)
      if (s && s.identificacion) {
        Auth.gestionarAcceso("estado_acceso", { cedulas: [s.identificacion] })
          .then(({ estado }) => {
            const info = estado && estado[s.identificacion];
            if (info && info.tieneAcceso) {
              chkAcceso.checked = true;
              const chkSec = document.querySelector('[name="esSecretario"]');
              if (chkSec) chkSec.checked = info.rol === "secretario";
              if (passHint) passHint.textContent = "(déjala vacía para no cambiarla)";
            }
            toggle();
          })
          .catch(() => { /* si falla, se deja sin marcar */ });
      }
    }
    document.getElementById("formSocio").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const nombre = (fd.get("nombre") || "").trim();
      if (!nombre) return UI.toast("El nombre es obligatorio.");
      const cedula = (fd.get("identificacion") || "").trim();
      const quiereAcceso = fd.get("tieneAcceso") === "on";
      const esSecretario = fd.get("esSecretario") === "on";
      const accesoPass = fd.get("accesoPassword") || "";
      const accesoErr = document.getElementById("accesoError");
      if (accesoErr) accesoErr.textContent = "";

      // Validación: para dar acceso se requiere cédula
      if (quiereAcceso && !cedula) {
        if (accesoErr) accesoErr.textContent = "Para dar acceso, el socio debe tener cédula/identificación.";
        return;
      }

      const btnSubmit = e.target.querySelector("button[type=submit]");
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = "Guardando..."; }
      try {
        const guardado = await DB.socios.guardar({
          id: fd.get("id") || undefined,
          nombre,
          identificacion: cedula,
          telefono: fd.get("telefono"),
          email: fd.get("email"),
          fechaNacimiento: fd.get("fechaNacimiento"),
          tipoSangre: fd.get("tipoSangre"),
          sectorResidencia: fd.get("sectorResidencia"),
          activo: fd.get("activo") === "on",
          creado: s ? s.creado : undefined,
        });

        // Gestión de acceso (solo si el admin usó esa sección)
        if (document.getElementById("chkAcceso")) {
          try {
            if (quiereAcceso) {
              await Auth.gestionarAcceso("guardar_acceso", {
                cedula,
                password: accesoPass || undefined,
                rol: esSecretario ? "secretario" : "lectura",
                nombre,
                socioId: guardado.id,
              });
            } else if (cedula) {
              // si se desmarcó el acceso, quitar el usuario si existía
              await Auth.gestionarAcceso("quitar_acceso", { cedula });
            }
          } catch (accEx) {
            // el socio sí se guardó; informamos el problema de acceso
            UI.closeModal();
            UI.toast("Socio guardado, pero el acceso falló: " + (accEx.message || accEx));
            render();
            return;
          }
        }

        UI.closeModal();
        UI.toast(s ? "Socio actualizado." : "Socio agregado.");
        render();
      } catch (err) {
        console.error("Error al guardar socio:", err);
        if (accesoErr) accesoErr.textContent = "";
        UI.toast("No se pudo guardar: " + (err.message || err));
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = "Guardar"; }
      }
    });
  }

  async function eliminar(id) {
    const s = _cache.find(x => x.id === id);
    if (!confirm(`¿Eliminar al socio "${s ? s.nombre : ""}"? También se perderá su historial de asistencia.`)) return;
    try {
      // limpiar su historial de asistencia (además del ON DELETE CASCADE de la BD)
      const asis = await DB.asistencia.porSocio(id);
      await Promise.all(asis.map(a => DB.asistencia.eliminar(a.id)));
      await DB.socios.eliminar(id);
      UI.toast("Socio eliminado.");
      render();
    } catch (err) {
      console.error("Error al eliminar socio:", err);
      UI.toast("No se pudo eliminar: " + (err.message || err));
    }
  }

  function init() {
    document.getElementById("btnNuevoSocio").addEventListener("click", () => abrirForm(null));
    document.getElementById("buscarSocio").addEventListener("input", (e) => paint(e.target.value));
  }

  return { init, render };
})();
window.Socios = Socios;
