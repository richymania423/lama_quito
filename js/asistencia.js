/**
 * asistencia.js — Vista "Asamblea en curso":
 *  - Datos de la asamblea seleccionada
 *  - Orden del día (puntos) editable
 *  - Temas principales tratados
 *  - Registro de asistencia basado en el listado de socios
 *  - Lanzadera para generar el PDF
 */
const Asistencia = (() => {
  let _asambleaId = null;
  let _asamblea = null;
  let _socios = [];
  let _asis = {}; // socioId -> { presente, observacion }

  async function render() {
    const asambleas = await DB.asambleas.listar();
    const sel = document.getElementById("selectorAsamblea");
    sel.innerHTML = `<option value="">— Selecciona una asamblea —</option>` +
      asambleas.map(a => {
        const mes = a.mesCorrespondencia ? UI.esc(a.mesCorrespondencia) : "Sin mes";
        return `<option value="${a.id}" ${a.id === _asambleaId ? "selected" : ""}>
          ${mes} - ${UI.fmtFecha(a.fecha)}
        </option>`;
      }).join("");

    if (_asambleaId && asambleas.some(a => a.id === _asambleaId)) {
      await cargar(_asambleaId);
    } else {
      mostrarVacio();
    }
  }

  function mostrarVacio() {
    document.getElementById("asambleaDetalle").classList.add("hidden");
    document.getElementById("asistenciaEmpty").classList.remove("hidden");
  }

  async function abrir(id) {
    _asambleaId = id;
    const sel = document.getElementById("selectorAsamblea");
    if (sel) sel.value = id;
    await cargar(id);
  }

  async function cargar(id) {
    _asambleaId = id;
    _asamblea = await DB.asambleas.obtener(id);
    if (!_asamblea) return mostrarVacio();

    _socios = (await DB.socios.listar()).filter(s => s.activo);
    const registros = await DB.asistencia.porAsamblea(id);
    _asis = {};
    registros.forEach(r => { _asis[r.socioId] = { presente: r.presente, observacion: r.observacion }; });

    document.getElementById("asistenciaEmpty").classList.add("hidden");
    document.getElementById("asambleaDetalle").classList.remove("hidden");

    aplicarPermisosUI();
    pintarMeta();
    pintarOrdenDia();
    const ta = document.getElementById("temasTratados");
    ta.value = _asamblea.temas || "";
    ta.readOnly = !puedeEditar();
    pintarAsistencia();
  }

  // ---------- Permisos ----------
  function puedeEditar() { return UI.puede("asistencia"); }

  function aplicarPermisosUI() {
    const editable = puedeEditar();
    ["btnMarcarTodos", "btnDesmarcarTodos", "btnGuardarTemas"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = editable ? "" : "none";
    });
  }

  function pintarMeta() {
    const a = _asamblea;
    document.getElementById("asambleaMeta").innerHTML = `
      <div class="meta-item"><b>Fecha</b>${UI.fmtFecha(a.fecha)}</div>
      <div class="meta-item"><b>Hora</b>${UI.esc(a.hora) || "—"}</div>
      <div class="meta-item"><b>Lugar</b>${UI.esc(a.lugar) || "—"}</div>
      <div class="meta-item"><b>Mes correspondencia</b>${UI.esc(a.mesCorrespondencia) || "—"}</div>`;
  }

  // ---------- Orden del día (solo lectura; se edita en el módulo Asambleas) ----------
  function pintarOrdenDia() {
    const ol = document.getElementById("listaOrdenDia");
    const puntos = _asamblea.ordenDia || [];
    if (!puntos.length) {
      ol.innerHTML = `<li class="muted">Sin puntos. Edita la asamblea para definir el orden del día.</li>`;
      return;
    }
    ol.innerHTML = puntos.map((p, i) => `<li><span><b>${i + 1}.</b> ${UI.esc(p)}</span></li>`).join("");
  }

  // ---------- Temas ----------
  async function guardarTemas() {
    _asamblea.temas = document.getElementById("temasTratados").value;
    try {
      await DB.asambleas.guardar(_asamblea);
      const hint = document.getElementById("temasHint");
      hint.textContent = "✓ Guardado";
      setTimeout(() => (hint.textContent = ""), 2000);
    } catch (err) {
      console.error("Error al guardar temas:", err);
      UI.toast("No se pudieron guardar los temas: " + (err.message || err));
    }
  }

  // ---------- Asistencia ----------
  function pintarAsistencia() {
    const tbody = document.querySelector("#tablaAsistencia tbody");
    if (!_socios.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;padding:1.5rem">
        No hay socios activos. Agrega socios en la pestaña “Socios”.</td></tr>`;
      actualizarStats();
      return;
    }
    const editable = puedeEditar();
    tbody.innerHTML = _socios.map(s => {
      const r = _asis[s.id] || { presente: false, observacion: "" };
      return `<tr>
        <td style="text-align:center">
          <input type="checkbox" data-pres="${s.id}" ${r.presente ? "checked" : ""} ${editable ? "" : "disabled"} style="width:auto" />
        </td>
        <td>${UI.esc(s.nombre)}</td>
        <td>${UI.esc(s.identificacion) || "—"}</td>
        <td><input type="text" data-obs="${s.id}" value="${UI.esc(r.observacion)}" placeholder="Opcional" ${editable ? "" : "readonly"} /></td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-pres]").forEach(chk =>
      chk.addEventListener("change", () => marcar(chk.dataset.pres, chk.checked)));
    tbody.querySelectorAll("[data-obs]").forEach(inp =>
      inp.addEventListener("change", () => marcarObs(inp.dataset.obs, inp.value)));
    actualizarStats();
  }

  async function marcar(socioId, presente) {
    const prev = _asis[socioId] || { observacion: "" };
    _asis[socioId] = { presente, observacion: prev.observacion };
    try {
      await DB.asistencia.marcar({ asambleaId: _asambleaId, socioId, presente, observacion: prev.observacion });
    } catch (err) {
      console.error("Error al marcar asistencia:", err);
      UI.toast("No se pudo guardar la asistencia: " + (err.message || err));
    }
    actualizarStats();
  }

  async function marcarObs(socioId, observacion) {
    const prev = _asis[socioId] || { presente: false };
    _asis[socioId] = { presente: prev.presente, observacion };
    try {
      await DB.asistencia.marcar({ asambleaId: _asambleaId, socioId, presente: prev.presente, observacion });
    } catch (err) {
      console.error("Error al guardar observación:", err);
      UI.toast("No se pudo guardar la observación: " + (err.message || err));
    }
  }

  async function marcarTodos(valor) {
    try {
      for (const s of _socios) {
        const prev = _asis[s.id] || { observacion: "" };
        _asis[s.id] = { presente: valor, observacion: prev.observacion };
        await DB.asistencia.marcar({ asambleaId: _asambleaId, socioId: s.id, presente: valor, observacion: prev.observacion });
      }
    } catch (err) {
      console.error("Error al marcar todos:", err);
      UI.toast("No se pudo completar: " + (err.message || err));
    }
    pintarAsistencia();
  }

  function actualizarStats() {
    const total = _socios.length;
    const presentes = _socios.filter(s => _asis[s.id] && _asis[s.id].presente).length;
    const pct = total ? Math.round((presentes / total) * 100) : 0;
    document.getElementById("asistenciaStats").innerHTML = `
      <span>Presentes: <b>${presentes}</b></span>
      <span>Ausentes: <b>${total - presentes}</b></span>
      <span>Total socios activos: <b>${total}</b></span>
      <span>Asistencia: <b>${pct}%</b></span>`;
  }

  // ---------- Datos para el PDF ----------
  function datosParaPDF() {
    const presentes = _socios.filter(s => _asis[s.id] && _asis[s.id].presente);
    const ausentes = _socios.filter(s => !(_asis[s.id] && _asis[s.id].presente));
    return { asamblea: _asamblea, socios: _socios, asis: _asis, presentes, ausentes };
  }

  function init() {
    document.getElementById("selectorAsamblea").addEventListener("change", (e) => {
      if (e.target.value) cargar(e.target.value); else { _asambleaId = null; mostrarVacio(); }
    });
    document.getElementById("btnGuardarTemas").addEventListener("click", guardarTemas);
    document.getElementById("btnMarcarTodos").addEventListener("click", () => marcarTodos(true));
    document.getElementById("btnDesmarcarTodos").addEventListener("click", () => marcarTodos(false));
    document.getElementById("btnGenerarPDF").addEventListener("click", () => {
      if (!_asamblea) return UI.toast("Selecciona una asamblea primero.");
      PDF.actaAsamblea(datosParaPDF());
    });
  }

  return { init, render, abrir };
})();
window.Asistencia = Asistencia;
