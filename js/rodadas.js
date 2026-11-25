/**
 * rodadas.js — Registro de rodadas y asistencia de socios.
 * Campos: fecha, hora de encuentro, hora de salida, lugar de encuentro, destino,
 * tipo de evento (catálogo en js/puntos.js), distancia (km, solo ida) y socio encargado.
 * En la asistencia se marca si el socio fue como acompañante (ese evento no le suma puntos).
 */
const Rodadas = (() => {
  const SIN_FECHA = "sin-fecha";
  const anioDe = (r) => (r.fecha ? r.fecha.slice(0, 4) : SIN_FECHA);

  let _cache = [];
  let _asisTodas = [];
  let _socios = [];
  let _anio = String(new Date().getFullYear());
  let _tipo = "";

  // detalle
  let _rodada = null;
  let _asis = {};          // socioId -> { presente, observacion }
  let _sociosAsis = [];    // socios activos listados en la asistencia

  const puedeEditar = () => UI.puede("rodadas");
  const nombreSocio = (id) => {
    const s = _socios.find(x => x.id === id);
    return s ? s.nombre : "";
  };
  const fmtKm = (v) => (v === "" || v == null ? "—" : `${String(v).replace(".", ",")} km`);

  async function render() {
    try {
      const [rodadas, asis, socios] = await Promise.all([
        DB.rodadas.listar(), DB.rodadasAsistencia.todos(), DB.socios.listar(),
      ]);
      _cache = rodadas; _asisTodas = asis; _socios = socios;
    } catch (err) {
      console.error("Error al cargar rodadas:", err);
      UI.toast("No se pudieron cargar las rodadas: " + (err.message || err));
      _cache = []; _asisTodas = [];
    }
    const btn = document.getElementById("btnNuevaRodada");
    if (btn) btn.style.display = puedeEditar() ? "" : "none";
    if (_rodada && _cache.some(r => r.id === _rodada.id)) {
      await abrirDetalle(_rodada.id);
    } else {
      mostrarLista();
      pintarFiltroAnio();
      paint();
    }
  }

  function mostrarLista() {
    _rodada = null;
    Mapa.quitar();
    document.getElementById("rodadaDetalle").classList.add("hidden");
    document.getElementById("rodadasLista").classList.remove("hidden");
  }

  function pintarFiltroAnio() {
    const sel = document.getElementById("filtroAnioRodadas");
    if (!sel) return;
    const actual = String(new Date().getFullYear());
    const anios = new Set([actual, ..._cache.map(anioDe).filter(x => x !== SIN_FECHA)]);
    const lista = [...anios].sort((x, y) => y.localeCompare(x));
    if (!lista.includes(_anio)) _anio = actual;
    sel.innerHTML = lista.map(y => `<option value="${y}" ${y === _anio ? "selected" : ""}>${y}</option>`).join("");
  }

  function paint() {
    const editar = puedeEditar();
    const tbody = document.querySelector("#tablaRodadas tbody");
    if (!_cache.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;padding:1.5rem">
        No hay rodadas. Crea la primera con “+ Nueva rodada”.</td></tr>`;
      return;
    }
    const filas = _cache
      .filter(r => anioDe(r) === _anio && (!_tipo || r.tipo === _tipo))
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    if (!filas.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;padding:1.5rem">
        No hay rodadas ${_tipo ? `de tipo “${UI.esc(Puntos.tipo(_tipo).nombre)}” ` : ""}en ${UI.esc(_anio)}.</td></tr>`;
      return;
    }
    tbody.innerHTML = filas.map(r => {
      const asis = _asisTodas.filter(x => x.rodadaId === r.id && x.presente).length;
      const encargado = nombreSocio(r.socioEncargadoId);
      return `<tr>
        <td>${UI.fmtFecha(r.fecha)}</td>
        <td>${UI.esc(r.horaEncuentro) || "—"}</td>
        <td>${UI.esc(r.lugarEncuentro) || "—"}</td>
        <td>${UI.esc(r.destino) || "—"}</td>
        <td><span class="badge ${Puntos.tipo(r.tipo).badge}" title="${UI.esc(Puntos.tipo(r.tipo).nombre)}">${UI.esc(Puntos.tipo(r.tipo).corto)}</span></td>
        <td>${fmtKm(r.distanciaKm)}</td>
        <td>${UI.esc(encargado) || "—"}</td>
        <td>${asis}</td>
        <td class="row-actions">
          <button class="icon-btn" title="Registrar asistencia" data-open="${r.id}">📝</button>
          <button class="icon-btn" title="Descargar convocatoria (PDF)" data-conv="${r.id}">📢</button>
          <button class="icon-btn" title="Descargar registro de rodada (PDF)" data-pdf="${r.id}">📄</button>
          ${editar ? `
            <button class="icon-btn" title="Editar" data-edit="${r.id}">✏️</button>
            <button class="icon-btn" title="Eliminar" data-del="${r.id}">🗑️</button>` : ""}
        </td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => abrirDetalle(b.dataset.open)));
    tbody.querySelectorAll("[data-conv]").forEach(b => b.addEventListener("click", () => descargarConvocatoria(b.dataset.conv)));
    tbody.querySelectorAll("[data-pdf]").forEach(b => b.addEventListener("click", () => descargarPDF(b.dataset.pdf)));
    tbody.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    tbody.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => eliminar(b.dataset.del)));
  }

  // ---------- Formulario ----------
  function abrirForm(id) {
    const r = id ? _cache.find(x => x.id === id) : null;
    const hoy = new Date().toISOString().slice(0, 10);
    // socios activos; si el encargado actual está inactivo, también se incluye
    const candidatos = _socios.filter(s => s.activo || (r && s.id === r.socioEncargadoId));
    const opcSocios = `<option value="">— Sin asignar —</option>` + candidatos.map(s =>
      `<option value="${s.id}" ${r && r.socioEncargadoId === s.id ? "selected" : ""}>${UI.esc(s.nombre)}</option>`).join("");
    const opcTipo = Puntos.TIPOS.map(t =>
      `<option value="${t.codigo}" ${(r ? r.tipo : "Interna") === t.codigo ? "selected" : ""}>${t.nombre}</option>`).join("");

    UI.openModal(r ? "Editar rodada" : "Nueva rodada", `
      <form id="formRodada">
        <input type="hidden" name="id" value="${r ? r.id : ""}" />
        <div class="form-grid">
          <div class="form-field">
            <label>Fecha de salida *</label>
            <input type="date" name="fecha" required value="${r ? r.fecha : hoy}" />
          </div>
          <div class="form-field">
            <label>Tipo de evento *</label>
            <select name="tipo">${opcTipo}</select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Hora de encuentro</label>
            <input type="time" name="horaEncuentro" value="${r ? r.horaEncuentro : "07:00"}" />
          </div>
          <div class="form-field">
            <label>Hora de salida</label>
            <input type="time" name="horaSalida" value="${r ? r.horaSalida : "08:00"}" />
          </div>
        </div>
        <div class="form-field">
          <label>Lugar de encuentro</label>
          <input name="lugarEncuentro" value="${r ? UI.esc(r.lugarEncuentro) : ""}" placeholder="Gasolinera, parque, dirección..." />
        </div>
        <div class="form-field">
          <label>Coordenadas del encuentro</label>
          <input name="coordEncuentro" inputmode="text" autocomplete="off"
            value="${r && Mapa.hay(r.encuentroLat, r.encuentroLng) ? Mapa.texto(r.encuentroLat, r.encuentroLng) : ""}"
            placeholder="-0.180653, -78.467834  o enlace de Google Maps" />
          <small class="muted" id="coordHint">Opcional. Pega las coordenadas o el enlace completo de Google Maps para mostrar un mapa.</small>
        </div>
        <div class="form-field">
          <label>Destino</label>
          <input name="destino" value="${r ? UI.esc(r.destino) : ""}" placeholder="Ciudad o lugar de llegada" />
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Distancia (km, solo ida)</label>
            <input type="number" name="distanciaKm" min="0" step="0.1" inputmode="decimal" value="${r && r.distanciaKm !== "" ? r.distanciaKm : ""}" />
          </div>
          <div class="form-field">
            <label>Socio encargado</label>
            <select name="socioEncargadoId">${opcSocios}</select>
          </div>
        </div>
        <div class="btn-row">
          <button type="submit" class="btn">Guardar</button>
          <button type="button" class="btn btn-outline" id="cancelRodada">Cancelar</button>
        </div>
      </form>`);

    document.getElementById("cancelRodada").addEventListener("click", UI.closeModal);
    // confirma al vuelo qué coordenadas se leyeron (útil al pegar un enlace)
    const inpCoord = document.querySelector('#formRodada [name="coordEncuentro"]');
    const hintCoord = document.getElementById("coordHint");
    const textoHint = hintCoord.textContent;
    inpCoord.addEventListener("input", () => {
      const v = inpCoord.value.trim();
      const c = v ? Mapa.parsear(v) : null;
      hintCoord.textContent = !v ? textoHint : c ? `✓ Ubicación: ${Mapa.texto(c.lat, c.lng)}` : "No se reconocen coordenadas en ese texto.";
    });
    document.getElementById("formRodada").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (!fd.get("fecha")) return UI.toast("La fecha es obligatoria.");
      const km = fd.get("distanciaKm");
      if (km !== "" && Number(km) < 0) return UI.toast("La distancia no puede ser negativa.");
      const hE = fd.get("horaEncuentro"), hS = fd.get("horaSalida");
      if (hE && hS && hS < hE) return UI.toast("La hora de salida no puede ser anterior a la de encuentro.");
      const coordTxt = String(fd.get("coordEncuentro") || "").trim();
      const coord = coordTxt ? Mapa.parsear(coordTxt) : null;
      if (coordTxt && !coord) {
        return UI.toast(/goo\.gl|maps\.app/i.test(coordTxt)
          ? "Ese es un enlace corto de Google Maps. Ábrelo y copia el enlace completo, o copia las coordenadas."
          : "Coordenadas no válidas. Usa el formato: -0.180653, -78.467834");
      }
      try {
        await DB.rodadas.guardar({
          id: fd.get("id") || undefined,
          fecha: fd.get("fecha"),
          horaEncuentro: hE,
          horaSalida: hS,
          lugarEncuentro: fd.get("lugarEncuentro"),
          destino: fd.get("destino"),
          tipo: fd.get("tipo"),
          distanciaKm: km,
          socioEncargadoId: fd.get("socioEncargadoId"),
          encuentroLat: coord ? coord.lat : null,
          encuentroLng: coord ? coord.lng : null,
          creado: r ? r.creado : undefined,
        });
        UI.closeModal();
        UI.toast(r ? "Rodada actualizada." : "Rodada creada.");
        _anio = String(fd.get("fecha")).slice(0, 4);
        _tipo = "";
        const selT = document.getElementById("filtroTipoRodadas");
        if (selT) selT.value = "";
        render();
      } catch (err) {
        console.error("Error al guardar rodada:", err);
        UI.toast("No se pudo guardar: " + (err.message || err));
      }
    });
  }

  async function eliminar(id) {
    const r = _cache.find(x => x.id === id);
    if (!confirm(`¿Eliminar la rodada del ${r ? UI.fmtFecha(r.fecha) : ""}${r && r.destino ? " a " + r.destino : ""}? Se perderá su asistencia.`)) return;
    try {
      await DB.rodadas.eliminar(id);
      UI.toast("Rodada eliminada.");
      render();
    } catch (err) {
      console.error("Error al eliminar rodada:", err);
      UI.toast("No se pudo eliminar: " + (err.message || err));
    }
  }

  // ---------- Detalle / asistencia ----------
  async function abrirDetalle(id) {
    try {
      const rodada = await DB.rodadas.obtener(id);
      if (!rodada) { mostrarLista(); pintarFiltroAnio(); paint(); return; }
      _rodada = rodada;
      if (!_socios.length) _socios = await DB.socios.listar();
      _sociosAsis = _socios.filter(s => s.activo);
      const registros = await DB.rodadasAsistencia.porRodada(id);
      _asis = {};
      registros.forEach(x => { _asis[x.socioId] = { presente: x.presente, acompanante: x.acompanante, observacion: x.observacion }; });
    } catch (err) {
      console.error("Error al abrir rodada:", err);
      UI.toast("No se pudo abrir la rodada: " + (err.message || err));
      return;
    }
    document.getElementById("rodadasLista").classList.add("hidden");
    document.getElementById("rodadaDetalle").classList.remove("hidden");
    ["btnRodadaMarcarTodos", "btnRodadaDesmarcarTodos"].forEach(i => {
      const el = document.getElementById(i);
      if (el) el.style.display = puedeEditar() ? "" : "none";
    });
    pintarMeta();
    pintarAsistencia();
    window.scrollTo({ top: 0 });
  }

  function pintarMeta() {
    const r = _rodada;
    document.getElementById("rodadaMeta").innerHTML = `
      <div class="meta-item"><b>Fecha de salida</b>${UI.fmtFecha(r.fecha)}</div>
      <div class="meta-item"><b>Tipo</b>${UI.esc(Puntos.tipo(r.tipo).nombre)}</div>
      <div class="meta-item"><b>Hora de encuentro</b>${UI.esc(r.horaEncuentro) || "—"}</div>
      <div class="meta-item"><b>Hora de salida</b>${UI.esc(r.horaSalida) || "—"}</div>
      <div class="meta-item"><b>Lugar de encuentro</b>${UI.esc(r.lugarEncuentro) || "—"}</div>
      <div class="meta-item"><b>Destino</b>${UI.esc(r.destino) || "—"}</div>
      <div class="meta-item"><b>Distancia (solo ida)</b>${fmtKm(r.distanciaKm)}</div>
      <div class="meta-item"><b>Socio encargado</b>${UI.esc(nombreSocio(r.socioEncargadoId)) || "—"}</div>`;
    pintarMapa();
  }

  // Mapa del punto de encuentro: solo si la rodada tiene coordenadas
  function pintarMapa() {
    const r = _rodada;
    const cont = document.getElementById("rodadaUbicacion");
    const div = document.getElementById("rodadaMapa");
    Mapa.quitar();
    if (!Mapa.hay(r.encuentroLat, r.encuentroLng)) {
      cont.classList.add("hidden");
      return;
    }
    cont.classList.remove("hidden");
    document.getElementById("btnGoogleMaps").href = Mapa.urlGoogle(r.encuentroLat, r.encuentroLng);
    document.getElementById("rodadaCoordTxt").textContent = Mapa.texto(r.encuentroLat, r.encuentroLng);
    div.innerHTML = "";
    Mapa.mostrar(div, r.encuentroLat, r.encuentroLng, r.lugarEncuentro || "Punto de encuentro").catch(err => {
      console.warn("Mapa no disponible:", err);
      div.innerHTML = `<p class="muted mapa-aviso">No se pudo cargar el mapa. Revisa tu conexión o usa “Abrir en Google Maps”.</p>`;
    });
  }

  function pintarAsistencia() {
    const tbody = document.querySelector("#tablaRodadaAsistencia tbody");
    if (!_sociosAsis.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:1.5rem">
        No hay socios activos. Agrega socios en la pestaña “Socios”.</td></tr>`;
      actualizarStats();
      return;
    }
    const editable = puedeEditar();
    tbody.innerHTML = _sociosAsis.map(s => {
      const x = _asis[s.id] || { presente: false, acompanante: false, observacion: "" };
      // "acompañante" solo se puede marcar si el socio asistió
      return `<tr>
        <td style="text-align:center">
          <input type="checkbox" data-pres="${s.id}" ${x.presente ? "checked" : ""} ${editable ? "" : "disabled"} style="width:auto" aria-label="Presente" />
        </td>
        <td>${UI.esc(s.nombre)}</td>
        <td>${UI.esc(s.identificacion) || "—"}</td>
        <td style="text-align:center">
          <input type="checkbox" data-acomp="${s.id}" ${x.presente && x.acompanante ? "checked" : ""} ${editable && x.presente ? "" : "disabled"}
            style="width:auto" aria-label="Fue como acompañante" title="Fue como acompañante en otra moto: no suma puntos" />
        </td>
        <td><input type="text" data-obs="${s.id}" value="${UI.esc(x.observacion)}" placeholder="Opcional" ${editable ? "" : "readonly"} /></td>
      </tr>`;
    }).join("");
    tbody.querySelectorAll("[data-pres]").forEach(c =>
      c.addEventListener("change", () => marcar(c.dataset.pres, c.checked)));
    tbody.querySelectorAll("[data-acomp]").forEach(c =>
      c.addEventListener("change", () => marcarAcompanante(c.dataset.acomp, c.checked)));
    tbody.querySelectorAll("[data-obs]").forEach(i =>
      i.addEventListener("change", () => marcarObs(i.dataset.obs, i.value)));
    actualizarStats();
  }

  const registro = (socioId) => _asis[socioId] || { presente: false, acompanante: false, observacion: "" };

  async function guardarAsis(socioId) {
    const x = registro(socioId);
    await DB.rodadasAsistencia.marcar({ rodadaId: _rodada.id, socioId, presente: x.presente, acompanante: x.acompanante, observacion: x.observacion });
  }

  async function marcar(socioId, presente) {
    const prev = registro(socioId);
    // si deja de estar presente, también deja de ser acompañante
    _asis[socioId] = { presente, acompanante: presente ? prev.acompanante : false, observacion: prev.observacion };
    const acomp = document.querySelector(`[data-acomp="${socioId}"]`);
    if (acomp) {
      acomp.disabled = !presente || !puedeEditar();
      if (!presente) acomp.checked = false;
    }
    try {
      await guardarAsis(socioId);
    } catch (err) {
      console.error("Error al marcar asistencia:", err);
      UI.toast("No se pudo guardar la asistencia: " + (err.message || err));
    }
    actualizarStats();
  }

  async function marcarAcompanante(socioId, acompanante) {
    const prev = registro(socioId);
    _asis[socioId] = { ...prev, acompanante: prev.presente && acompanante };
    try {
      await guardarAsis(socioId);
    } catch (err) {
      console.error("Error al marcar acompañante:", err);
      UI.toast("No se pudo guardar: " + (err.message || err));
      _asis[socioId] = prev;                        // vuelve atrás si no se guardó
      const c = document.querySelector(`[data-acomp="${socioId}"]`);
      if (c) c.checked = !!prev.acompanante;
    }
    actualizarStats();
  }

  async function marcarObs(socioId, observacion) {
    _asis[socioId] = { ...registro(socioId), observacion };
    try {
      await guardarAsis(socioId);
    } catch (err) {
      console.error("Error al guardar observación:", err);
      UI.toast("No se pudo guardar la observación: " + (err.message || err));
    }
  }

  async function marcarTodos(valor) {
    try {
      for (const s of _sociosAsis) {
        const prev = registro(s.id);
        _asis[s.id] = { presente: valor, acompanante: valor ? prev.acompanante : false, observacion: prev.observacion };
        await guardarAsis(s.id);
      }
    } catch (err) {
      console.error("Error al marcar todos:", err);
      UI.toast("No se pudo completar: " + (err.message || err));
    }
    pintarAsistencia();
  }

  function actualizarStats() {
    const total = _sociosAsis.length;
    const presentes = _sociosAsis.filter(s => _asis[s.id] && _asis[s.id].presente).length;
    const acomp = _sociosAsis.filter(s => _asis[s.id] && _asis[s.id].presente && _asis[s.id].acompanante).length;
    const pct = total ? Math.round((presentes / total) * 100) : 0;
    document.getElementById("rodadaStats").innerHTML = `
      <span>Asistieron: <b>${presentes}</b>${acomp ? ` (${acomp} como acompañante)` : ""}</span>
      <span>No asistieron: <b>${total - presentes}</b></span>
      <span>Total socios activos: <b>${total}</b></span>
      <span>Participación: <b>${pct}%</b></span>`;
  }

  // ---------- PDF ----------
  // Desde el detalle usa los datos en pantalla; desde el listado los carga de la base.
  async function descargarPDF(id) {
    try {
      let rodada = _rodada, asis = _asis, socios = _sociosAsis;
      if (!rodada || rodada.id !== id) {
        rodada = await DB.rodadas.obtener(id);
        if (!rodada) return UI.toast("No se encontró la rodada.");
        if (!_socios.length) _socios = await DB.socios.listar();
        socios = _socios.filter(s => s.activo);
        asis = {};
        (await DB.rodadasAsistencia.porRodada(id)).forEach(x => { asis[x.socioId] = { presente: x.presente, acompanante: x.acompanante, observacion: x.observacion }; });
      }
      const presentes = socios.filter(s => asis[s.id] && asis[s.id].presente);
      const ausentes = socios.filter(s => !(asis[s.id] && asis[s.id].presente));
      // el PDF arma el mapa del encuentro (si hay coordenadas) al tamaño del espacio libre
      await PDF.registroRodada({
        rodada, encargado: nombreSocio(rodada.socioEncargadoId), socios, asis, presentes, ausentes,
      });
    } catch (err) {
      console.error("Error al generar el PDF de la rodada:", err);
      UI.toast("No se pudo generar el PDF: " + (err.message || err));
    }
  }

  // Convocatoria: disponible para todos los roles que ven el módulo (igual que en asambleas)
  async function descargarConvocatoria(id) {
    try {
      const rodada = (_rodada && _rodada.id === id) ? _rodada : await DB.rodadas.obtener(id);
      if (!rodada) return UI.toast("No se encontró la rodada.");
      if (!_socios.length) _socios = await DB.socios.listar();
      await PDF.convocatoriaRodada(rodada, { encargado: nombreSocio(rodada.socioEncargadoId) });
    } catch (err) {
      console.error("Error al generar la convocatoria de la rodada:", err);
      UI.toast("No se pudo generar la convocatoria: " + (err.message || err));
    }
  }

  function init() {
    document.getElementById("btnConvocatoriaRodada").addEventListener("click", () => {
      if (!_rodada) return UI.toast("Abre una rodada primero.");
      descargarConvocatoria(_rodada.id);
    });
    document.getElementById("btnPDFRodada").addEventListener("click", () => {
      if (!_rodada) return UI.toast("Abre una rodada primero.");
      descargarPDF(_rodada.id);
    });
    document.getElementById("btnNuevaRodada").addEventListener("click", () => abrirForm(null));
    document.getElementById("btnVolverRodadas").addEventListener("click", () => { _rodada = null; render(); });
    document.getElementById("btnRodadaMarcarTodos").addEventListener("click", () => marcarTodos(true));
    document.getElementById("btnRodadaDesmarcarTodos").addEventListener("click", () => marcarTodos(false));
    const selA = document.getElementById("filtroAnioRodadas");
    if (selA) selA.addEventListener("change", () => { _anio = selA.value; paint(); });
    const selT = document.getElementById("filtroTipoRodadas");
    if (selT) selT.addEventListener("change", () => { _tipo = selT.value; paint(); });
  }

  return { init, render };
})();
window.Rodadas = Rodadas;
