/**
 * asambleas.js — Registro de asambleas realizadas.
 * Campos: fecha, hora, lugar, mes de correspondencia, orden del día (puntos), temas.
 */
const Asambleas = (() => {
  let _cache = [];
  let _asistencia = [];
  let _anio = String(new Date().getFullYear()); // filtro de año; por defecto el año en curso
  let _ordenDia = []; // puntos del orden del día en edición dentro del form

  const SIN_FECHA = "sin-fecha";
  const anioDe = (a) => (a.fecha ? a.fecha.slice(0, 4) : SIN_FECHA);

  async function render() {
    const [asambleas, asistencia] = await Promise.all([
      DB.asambleas.listar(), DB.asistencia.todos(),
    ]);
    _cache = asambleas;
    _asistencia = asistencia;
    const btnNueva = document.getElementById("btnNuevaAsamblea");
    if (btnNueva) btnNueva.style.display = UI.puede("asambleas") ? "" : "none";
    pintarFiltroAnio();
    paint();
  }

  // Años disponibles según las asambleas registradas, más el año en curso (orden descendente)
  function pintarFiltroAnio() {
    const sel = document.getElementById("filtroAnioAsambleas");
    if (!sel) return;
    const actual = String(new Date().getFullYear());
    const anios = new Set([actual, ..._cache.map(anioDe).filter(x => x !== SIN_FECHA)]);
    const lista = [...anios].sort((x, y) => y.localeCompare(x));
    if (_cache.some(a => !a.fecha)) lista.push(SIN_FECHA);
    if (!lista.includes(_anio)) _anio = actual;
    sel.innerHTML = lista.map(y =>
      `<option value="${y}" ${y === _anio ? "selected" : ""}>${y === SIN_FECHA ? "Sin fecha" : y}</option>`).join("");
  }

  function paint() {
    const puedeEditar = UI.puede("asambleas");
    const tbody = document.querySelector("#tablaAsambleas tbody");

    if (!_cache.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:1.5rem">
        No hay asambleas. Crea la primera con “+ Nueva asamblea”.</td></tr>`;
      return;
    }

    const asambleas = _cache.filter(a => anioDe(a) === _anio);
    if (!asambleas.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:1.5rem">
        No hay asambleas registradas en ${UI.esc(_anio)}.</td></tr>`;
      return;
    }

    const asistencia = _asistencia;
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
          <button class="icon-btn" title="Descargar convocatoria (PDF)" data-conv="${a.id}">📄</button>
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
    tbody.querySelectorAll("[data-conv]").forEach(b =>
      b.addEventListener("click", async () => {
        const a = _cache.find(x => x.id === b.dataset.conv);
        if (!a) return;
        try {
          await PDF.convocatoria(a);
        } catch (err) {
          console.error("Error al generar la convocatoria:", err);
          UI.toast("No se pudo generar la convocatoria: " + (err.message || err));
        }
      }));
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
          <label>Coordenadas del lugar</label>
          <input name="coordLugar" inputmode="text" autocomplete="off"
            value="${a && Mapa.hay(a.lugarLat, a.lugarLng) ? Mapa.texto(a.lugarLat, a.lugarLng) : ""}"
            placeholder="-0.180653, -78.467834  o enlace de Google Maps" />
          <small class="muted" id="coordLugarHint">Opcional. Pega las coordenadas o el enlace completo de Google Maps para mostrar un mapa.</small>
        </div>
        <div class="form-field">
          <label>Mes de correspondencia</label>
          <select name="mesCorrespondencia">${opcionesMes}</select>
        </div>
        <div class="form-field">
          <label><input type="checkbox" name="extraordinaria" style="width:auto;margin-right:.4rem" ${a && a.extraordinaria ? "checked" : ""} /> Asamblea extraordinaria</label>
          <small class="muted">Sin marcar, la asamblea es Ordinaria.</small>
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
    // confirma al vuelo qué coordenadas se leyeron (útil al pegar un enlace)
    const inpCoord = document.querySelector('#formAsamblea [name="coordLugar"]');
    const hintCoord = document.getElementById("coordLugarHint");
    const textoHint = hintCoord.textContent;
    inpCoord.addEventListener("input", () => {
      const v = inpCoord.value.trim();
      const c = v ? Mapa.parsear(v) : null;
      hintCoord.textContent = !v ? textoHint : c ? `✓ Ubicación: ${Mapa.texto(c.lat, c.lng)}` : "No se reconocen coordenadas en ese texto.";
    });
    document.getElementById("formAsamblea").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (!fd.get("fecha")) return UI.toast("La fecha es obligatoria.");
      const coordTxt = String(fd.get("coordLugar") || "").trim();
      const coord = coordTxt ? Mapa.parsear(coordTxt) : null;
      if (coordTxt && !coord) {
        return UI.toast(/goo\.gl|maps\.app/i.test(coordTxt)
          ? "Ese es un enlace corto de Google Maps. Ábrelo y copia el enlace completo, o copia las coordenadas."
          : "Coordenadas no válidas. Usa el formato: -0.180653, -78.467834");
      }
      try {
        await DB.asambleas.guardar({
          id: fd.get("id") || undefined,
          fecha: fd.get("fecha"),
          hora: fd.get("hora"),
          lugar: fd.get("lugar"),
          mesCorrespondencia: fd.get("mesCorrespondencia"),
          ordenDia: [..._ordenDia],
          extraordinaria: fd.get("extraordinaria") === "on",
          lugarLat: coord ? coord.lat : null,
          lugarLng: coord ? coord.lng : null,
          temas: a ? a.temas : "",
          creado: a ? a.creado : undefined,
        });
        UI.closeModal();
        UI.toast(a ? "Asamblea actualizada." : "Asamblea creada.");
        _anio = String(fd.get("fecha")).slice(0, 4); // muestra el año de la asamblea guardada
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
    const sel = document.getElementById("filtroAnioAsambleas");
    if (sel) sel.addEventListener("change", () => { _anio = sel.value; paint(); });
  }

  return { init, render };
})();
window.Asambleas = Asambleas;
