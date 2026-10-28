/**
 * asambleas.js — Registro de asambleas realizadas.
 * Campos: fecha, hora, lugar, mes de correspondencia, orden del día (puntos), temas.
 */
const Asambleas = (() => {
  let _cache = [];
  let _ordenDia = []; // puntos del orden del día en edición dentro del form

  async function render() {
    const [asambleas, asistencia] = await Promise.all([
      DB.asambleas.listar(), DB.asistencia.todos(),
    ]);
    _cache = asambleas;
    const puedeEditar = UI.puede("asambleas");
    const btnNueva = document.getElementById("btnNuevaAsamblea");
    if (btnNueva) btnNueva.style.display = puedeEditar ? "" : "none";
    const tbody = document.querySelector("#tablaAsambleas tbody");

    if (!asambleas.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:1.5rem">
        No hay asambleas. Crea la primera con “+ Nueva asamblea”.</td></tr>`;
      return;
    }

    const hoy = new Date().toISOString().slice(0, 10);
    tbody.innerHTML = asambleas.map(a => {
      const asis = asistencia.filter(x => x.asambleaId === a.id && x.presente).length;
      // no se permite eliminar asambleas con fecha anterior a hoy (ya realizadas)
      const fechaPasada = a.fecha && a.fecha < hoy;
      return `<tr>
        <td>${UI.fmtFecha(a.fecha)}</td>
        <td>${UI.esc(a.hora) || "—"}</td>
        <td>${UI.esc(a.lugar) || "—"}</td>
        <td>${UI.esc(a.mesCorrespondencia) || "—"}</td>
        <td>${asis}</td>
        <td class="row-actions">
          <button class="icon-btn" title="Abrir / registrar asistencia" data-open="${a.id}">📝</button>
          ${puedeEditar ? `
            <button class="icon-btn" title="Editar" data-edit="${a.id}">✏️</button>
            <button class="icon-btn" title="${fechaPasada ? 'No se puede eliminar una asamblea ya realizada' : 'Eliminar'}"
              data-del="${a.id}" ${fechaPasada ? "disabled" : ""}>🗑️</button>
          ` : ""}
        </td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-open]").forEach(b =>
      b.addEventListener("click", () => { Asistencia.abrir(b.dataset.open); UI.setView("asistencia"); }));
    tbody.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    tbody.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => eliminar(b.dataset.del)));
  }

  function abrirForm(id) {
    const a = id ? _cache.find(x => x.id === id) : null;
    const hoy = new Date().toISOString().slice(0, 10);
    const mesActual = UI.MESES[new Date().getMonth()];
    const opcionesMes = UI.MESES.map(m =>
      `<option value="${m}" ${a ? (a.mesCorrespondencia === m ? "selected" : "") : (m === mesActual ? "selected" : "")}>${m}</option>`).join("");

    UI.openModal(a ? "Editar asamblea" : "Nueva asamblea", `
      <form id="formAsamblea">
        <input type="hidden" name="id" value="${a ? a.id : ""}" />
        <div class="form-grid">
          <div class="form-field">
            <label>Fecha *</label>
            <input type="date" name="fecha" required value="${a ? a.fecha : hoy}" />
          </div>
          <div class="form-field">
            <label>Hora</label>
            <input type="time" name="hora" value="${a ? a.hora : "19:00"}" />
          </div>
        </div>
        <div class="form-field">
          <label>Lugar</label>
          <input name="lugar" value="${a ? UI.esc(a.lugar) : ""}" placeholder="Sede, salón, dirección..." />
        </div>
        <div class="form-field">
          <label>Mes de correspondencia</label>
          <select name="mesCorrespondencia">${opcionesMes}</select>
        </div>
        <div class="form-field">
          <label>Orden del día</label>
          <div class="orden-editor">
            <div class="orden-add">
              <input type="text" id="nuevoPuntoInput" placeholder="Escribe un punto y presiona Agregar" />
              <button type="button" class="btn btn-sm" id="btnAgregarPunto">Agregar</button>
            </div>
            <ol id="ordenDiaEditor" class="orden-dia"></ol>
          </div>
        </div>
        <div class="btn-row">
          <button type="submit" class="btn">Guardar</button>
          <button type="button" class="btn btn-outline" id="cancelAsamblea">Cancelar</button>
        </div>
      </form>`);

    // --- editor de orden del día ---
    _ordenDia = a && Array.isArray(a.ordenDia) ? [...a.ordenDia] : [];
    pintarOrdenEditor();
    const inputPunto = document.getElementById("nuevoPuntoInput");
    const addPunto = () => {
      const v = inputPunto.value.trim();
      if (!v) return;
      _ordenDia.push(v);
      inputPunto.value = "";
      inputPunto.focus();
      pintarOrdenEditor();
    };
    document.getElementById("btnAgregarPunto").addEventListener("click", addPunto);
    inputPunto.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addPunto(); }
    });

    document.getElementById("cancelAsamblea").addEventListener("click", UI.closeModal);
    document.getElementById("formAsamblea").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (!fd.get("fecha")) return UI.toast("La fecha es obligatoria.");
      try {
        await DB.asambleas.guardar({
          id: fd.get("id") || undefined,
          fecha: fd.get("fecha"),
          hora: fd.get("hora"),
          lugar: fd.get("lugar"),
          mesCorrespondencia: fd.get("mesCorrespondencia"),
          ordenDia: [..._ordenDia],
          temas: a ? a.temas : "",
          creado: a ? a.creado : undefined,
        });
        UI.closeModal();
        UI.toast(a ? "Asamblea actualizada." : "Asamblea creada.");
        render();
      } catch (err) {
        console.error("Error al guardar asamblea:", err);
        UI.toast("No se pudo guardar: " + (err.message || err));
      }
    });
  }

  // ---------- Editor de orden del día (dentro del form) ----------
  function pintarOrdenEditor() {
    const ol = document.getElementById("ordenDiaEditor");
    if (!ol) return;
    if (!_ordenDia.length) {
      ol.innerHTML = `<li class="muted">Aún no hay puntos. Agrega el primero arriba.</li>`;
      return;
    }
    ol.innerHTML = _ordenDia.map((p, i) => `
      <li>
        <span><b>${i + 1}.</b> ${UI.esc(p)}</span>
        <span class="orden-actions">
          <button type="button" class="icon-btn" title="Subir" data-up="${i}" ${i === 0 ? "disabled" : ""}>▲</button>
          <button type="button" class="icon-btn" title="Bajar" data-down="${i}" ${i === _ordenDia.length - 1 ? "disabled" : ""}>▼</button>
          <button type="button" class="icon-btn" title="Eliminar" data-del="${i}">🗑️</button>
        </span>
      </li>`).join("");

    ol.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => { _ordenDia.splice(+b.dataset.del, 1); pintarOrdenEditor(); }));
    ol.querySelectorAll("[data-up]").forEach(b =>
      b.addEventListener("click", () => { const i = +b.dataset.up; [_ordenDia[i - 1], _ordenDia[i]] = [_ordenDia[i], _ordenDia[i - 1]]; pintarOrdenEditor(); }));
    ol.querySelectorAll("[data-down]").forEach(b =>
      b.addEventListener("click", () => { const i = +b.dataset.down; [_ordenDia[i + 1], _ordenDia[i]] = [_ordenDia[i], _ordenDia[i + 1]]; pintarOrdenEditor(); }));
  }

  async function eliminar(id) {
    const a = _cache.find(x => x.id === id);
    const hoy = new Date().toISOString().slice(0, 10);
    if (a && a.fecha && a.fecha < hoy) {
      return UI.toast("No se puede eliminar una asamblea con fecha anterior a hoy.");
    }
    if (!confirm(`¿Eliminar la asamblea del ${a ? UI.fmtFecha(a.fecha) : ""}? Se perderá su asistencia y temas.`)) return;
    try {
      await DB.asambleas.eliminar(id);
      UI.toast("Asamblea eliminada.");
      render();
    } catch (err) {
      console.error("Error al eliminar asamblea:", err);
      UI.toast("No se pudo eliminar: " + (err.message || err));
    }
  }

  function init() {
    document.getElementById("btnNuevaAsamblea").addEventListener("click", () => abrirForm(null));
  }

  return { init, render };
})();
window.Asambleas = Asambleas;
