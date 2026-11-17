/**
 * motos.js — Formulario y borrado de motocicletas (se usa desde la pantalla de Socios).
 * Guarda marca, modelo, color, año, cilindraje, placa y el socio propietario.
 * Todos los roles consultan; solo el administrador crea, edita y elimina.
 */
const Motos = (() => {
  const esc = (s) => UI.esc(s);

  function abrirForm(m, socios, socioIdInicial = "", alGuardar = () => {}) {
    const socioSel = m ? m.socioId : socioIdInicial;
    const anioMax = new Date().getFullYear() + 1;

    UI.openModal(m ? "Editar motocicleta" : "Ingresar motocicleta", `
      <form id="formMoto">
        <div class="form-grid">
          <div class="form-field">
            <label>Marca *</label>
            <input name="marca" required maxlength="60" value="${m ? esc(m.marca) : ""}" />
          </div>
          <div class="form-field">
            <label>Modelo</label>
            <input name="modelo" maxlength="60" value="${m ? esc(m.modelo) : ""}" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Color</label>
            <input name="color" maxlength="40" value="${m ? esc(m.color) : ""}" />
          </div>
          <div class="form-field">
            <label>Año</label>
            <input type="number" name="anio" min="1900" max="${anioMax}" step="1" value="${m ? esc(m.anio) : ""}" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Cilindraje (cc)</label>
            <input type="number" name="cilindraje" min="1" max="9999" step="1" value="${m ? esc(m.cilindraje) : ""}" />
          </div>
          <div class="form-field">
            <label>Placa</label>
            <input name="placa" maxlength="12" style="text-transform:uppercase" value="${m ? esc(m.placa) : ""}" />
          </div>
        </div>
        <div class="form-field">
          <label>Socio propietario</label>
          <select name="socioId">
            <option value="">— Sin asignar —</option>
            ${socios.map(s => `<option value="${esc(s.id)}" ${socioSel === s.id ? "selected" : ""}>${esc(s.nombre)}${s.activo ? "" : " (inactivo)"}</option>`).join("")}
          </select>
        </div>
        <p class="login-error" id="motoError"></p>
        <div class="btn-row">
          <button type="submit" class="btn">Guardar</button>
          <button type="button" class="btn btn-outline" id="cancelMoto">Cancelar</button>
        </div>
      </form>`);

    document.getElementById("cancelMoto").addEventListener("click", UI.closeModal);
    document.getElementById("formMoto").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const err = document.getElementById("motoError");
      err.textContent = "";
      const marca = (fd.get("marca") || "").trim();
      if (!marca) { err.textContent = "La marca es obligatoria."; return; }
      const anio = fd.get("anio");
      if (anio !== "" && (Number(anio) < 1900 || Number(anio) > anioMax)) {
        err.textContent = "El año no es válido."; return;
      }

      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Guardando...";
      try {
        await DB.motos.guardar({
          id: m ? m.id : undefined,
          marca,
          modelo: fd.get("modelo"),
          color: fd.get("color"),
          anio,
          cilindraje: fd.get("cilindraje"),
          placa: fd.get("placa"),
          socioId: fd.get("socioId"),
          creado: m ? m.creado : undefined,
        });
        UI.closeModal();
        UI.toast(m ? "Motocicleta actualizada." : "Motocicleta agregada.");
        alGuardar();
      } catch (ex) {
        console.error("Error al guardar motocicleta:", ex);
        err.textContent = ex.message || String(ex);
        btn.disabled = false;
        btn.textContent = "Guardar";
      }
    });
  }

  async function eliminar(m, alEliminar = () => {}) {
    if (!m) return;
    if (!confirm(`¿Eliminar la motocicleta "${m.marca} ${m.modelo}"?`)) return;
    try {
      await DB.motos.eliminar(m.id);
      UI.toast("Motocicleta eliminada.");
      alEliminar();
    } catch (err) {
      console.error("Error al eliminar motocicleta:", err);
      UI.toast("No se pudo eliminar: " + (err.message || err));
    }
  }

  return { abrirForm, eliminar };
})();
window.Motos = Motos;
