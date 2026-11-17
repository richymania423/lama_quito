/**
 * copilotos.js — Formulario y borrado de copilotos (se usa desde la pantalla de Socios).
 * Guarda nombre, parentesco, tipo de sangre, fecha de nacimiento y el socio con quien
 * tiene afinidad. Todos los roles consultan; solo el administrador crea, edita y elimina
 * (la base de datos también lo exige).
 */
const Copilotos = (() => {
  const PARENTESCOS = ["Esposo/a", "Pareja", "Hijo/a", "Padre", "Madre", "Hermano/a", "Amigo/a", "Otro"];
  const TIPOS_SANGRE = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

  const esc = (s) => UI.esc(s);

  /**
   * c: copiloto a editar (o null para uno nuevo)
   * socios: lista de socios para el selector
   * socioIdInicial: socio preseleccionado al crear
   * alGuardar: callback tras guardar
   */
  function abrirForm(c, socios, socioIdInicial = "", alGuardar = () => {}) {
    const parentescos = c && c.parentesco && !PARENTESCOS.includes(c.parentesco)
      ? [...PARENTESCOS, c.parentesco] : PARENTESCOS;
    const socioSel = c ? c.socioId : socioIdInicial;

    UI.openModal(c ? "Editar copiloto" : "Ingresar copiloto", `
      <form id="formCopiloto">
        <div class="form-field">
          <label>Nombre completo *</label>
          <input name="nombre" required maxlength="150" value="${c ? esc(c.nombre) : ""}" />
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Parentesco</label>
            <select name="parentesco">
              <option value="">— Seleccionar —</option>
              ${parentescos.map(p => `<option value="${esc(p)}" ${c && c.parentesco === p ? "selected" : ""}>${esc(p)}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Tipo de sangre</label>
            <select name="tipoSangre">
              <option value="">— Seleccionar —</option>
              ${TIPOS_SANGRE.map(t => `<option value="${t}" ${c && c.tipoSangre === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Fecha de nacimiento</label>
            <input type="date" name="fechaNacimiento" value="${c ? esc(c.fechaNacimiento) : ""}" />
          </div>
          <div class="form-field">
            <label>Socio con quien tiene afinidad</label>
            <select name="socioId">
              <option value="">— Sin asignar —</option>
              ${socios.map(s => `<option value="${esc(s.id)}" ${socioSel === s.id ? "selected" : ""}>${esc(s.nombre)}${s.activo ? "" : " (inactivo)"}</option>`).join("")}
            </select>
          </div>
        </div>
        <p class="login-error" id="copilotoError"></p>
        <div class="btn-row">
          <button type="submit" class="btn">Guardar</button>
          <button type="button" class="btn btn-outline" id="cancelCopiloto">Cancelar</button>
        </div>
      </form>`);

    document.getElementById("cancelCopiloto").addEventListener("click", UI.closeModal);
    document.getElementById("formCopiloto").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const err = document.getElementById("copilotoError");
      err.textContent = "";
      const nombre = (fd.get("nombre") || "").trim();
      if (!nombre) { err.textContent = "El nombre es obligatorio."; return; }

      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Guardando...";
      try {
        await DB.copilotos.guardar({
          id: c ? c.id : undefined,
          nombre,
          parentesco: fd.get("parentesco"),
          tipoSangre: fd.get("tipoSangre"),
          fechaNacimiento: fd.get("fechaNacimiento"),
          socioId: fd.get("socioId"),
          creado: c ? c.creado : undefined,
        });
        UI.closeModal();
        UI.toast(c ? "Copiloto actualizado." : "Copiloto agregado.");
        alGuardar();
      } catch (ex) {
        console.error("Error al guardar copiloto:", ex);
        err.textContent = ex.message || String(ex);
        btn.disabled = false;
        btn.textContent = "Guardar";
      }
    });
  }

  async function eliminar(c, alEliminar = () => {}) {
    if (!c) return;
    if (!confirm(`¿Eliminar al copiloto "${c.nombre}"?`)) return;
    try {
      await DB.copilotos.eliminar(c.id);
      UI.toast("Copiloto eliminado.");
      alEliminar();
    } catch (err) {
      console.error("Error al eliminar copiloto:", err);
      UI.toast("No se pudo eliminar: " + (err.message || err));
    }
  }

  return { abrirForm, eliminar };
})();
window.Copilotos = Copilotos;
