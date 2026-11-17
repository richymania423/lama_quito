/**
 * cuadro.js — Cuadro de asistencias de socios a asambleas durante el año.
 * Filas = socios, columnas = asambleas del año, celda = asistió o no, + % anual.
 * Además calcula indicadores: % de asistencia por socio, ranking de participación,
 * miembros más activos y miembros con inasistencias recurrentes. La misma información
 * se muestra en pantalla y se exporta al PDF "Indicadores de Participación".
 *
 * Base de cálculo: solo cuentan las asambleas del año que ya se realizaron (fecha hasta hoy)
 * y que tienen asistencia registrada. Las futuras o sin registro aparecen como "–" y no
 * penalizan a nadie. Los indicadores consideran únicamente socios activos.
 */
const Cuadro = (() => {
  const UMBRAL_INASISTENCIAS = 3; // "recurrente" = 3 o más inasistencias en el año
  const TOP_ACTIVOS = 5;

  let _datos = null; // datos preparados para el PDF del año seleccionado

  const esc = (s) => UI.esc(s);
  const corto = (fecha) => UI.fmtFecha(fecha).slice(0, 5); // dd/mm

  function hoyLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function render() {
    const [socios, asambleas, asistencia] = await Promise.all([
      DB.socios.listar(), DB.asambleas.listar(), DB.asistencia.todos(),
    ]);

    // años disponibles según las asambleas (más el actual)
    const anios = new Set(asambleas.map(a => (a.fecha || "").slice(0, 4)).filter(Boolean));
    anios.add(String(new Date().getFullYear()));
    const listaAnios = [...anios].sort((a, b) => b.localeCompare(a));

    const selAnio = document.getElementById("selectorAnio");
    const anterior = selAnio.value;
    selAnio.innerHTML = listaAnios.map(a => `<option value="${a}">${a}</option>`).join("");
    if (anterior && listaAnios.includes(anterior)) selAnio.value = anterior;

    pintar(selAnio.value, socios, asambleas, asistencia);
  }

  function pintar(anio, socios, asambleas, asistencia) {
    const delAnio = asambleas
      .filter(a => (a.fecha || "").startsWith(anio))
      .sort((x, y) => (x.fecha || "").localeCompare(y.fecha || ""));

    const thead = document.querySelector("#tablaCuadro thead");
    const tbody = document.querySelector("#tablaCuadro tbody");
    const ind = document.getElementById("cuadroIndicadores");

    if (!socios.length) {
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td class="muted" style="text-align:center;padding:1.5rem">No hay socios registrados.</td></tr>`;
      ind.innerHTML = "";
      _datos = null;
      return;
    }
    if (!delAnio.length) {
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td class="muted" style="text-align:center;padding:1.5rem">No hay asambleas registradas en ${anio}.</td></tr>`;
      ind.innerHTML = "";
      _datos = null;
      return;
    }

    // matriz de asistencia: matriz[socioId][asambleaId] = true/false
    const matriz = {};
    socios.forEach(s => { matriz[s.id] = {}; });
    asistencia.forEach(r => {
      if (matriz[r.socioId]) matriz[r.socioId][r.asambleaId] = r.presente;
    });

    // asambleas que cuentan: ya realizadas y con asistencia registrada
    const hoy = hoyLocal();
    const conRegistro = new Set(asistencia.map(r => r.asambleaId));
    const consideradas = delAnio.filter(a => a.fecha <= hoy && conRegistro.has(a.id));
    const idsConsideradas = new Set(consideradas.map(a => a.id));
    const total = consideradas.length;

    // porcentaje anual por socio
    const porcentajes = {};
    socios.forEach(s => {
      const presentes = consideradas.filter(a => matriz[s.id][a.id]).length;
      porcentajes[s.id] = total ? Math.round((presentes / total) * 100) : 0;
    });

    // encabezado
    thead.innerHTML = `<tr>
      <th>Socio</th>
      ${delAnio.map(a => `<th class="${idsConsideradas.has(a.id) ? "" : "pend"}" title="${esc(a.lugar || "")}">${corto(a.fecha)}</th>`).join("")}
      <th>%</th>
    </tr>`;

    // filas
    tbody.innerHTML = socios.map(s => `
      <tr>
        <td>${esc(s.nombre)}</td>
        ${delAnio.map(a => {
          if (!idsConsideradas.has(a.id)) return `<td class="pend" title="Sin asistencia registrada">–</td>`;
          return matriz[s.id][a.id] ? `<td class="yes">✓</td>` : `<td class="no">·</td>`;
        }).join("")}
        <td class="pct">${total ? porcentajes[s.id] + "%" : "—"}</td>
      </tr>`).join("");

    // indicadores (solo socios activos)
    const filas = socios.filter(s => s.activo).map(s => {
      const faltas = consideradas.filter(a => !matriz[s.id][a.id]);
      return { socio: s, asist: total - faltas.length, inasist: faltas.length, pct: porcentajes[s.id], faltas };
    });
    const indicadores = (total && filas.length) ? calcular(filas, total) : null;
    pintarIndicadores(anio, total, delAnio.length, filas.length, indicadores);

    // datos para exportar a PDF
    _datos = {
      anio, socios, asambleas: delAnio, matriz, porcentajes,
      consideradas: [...idsConsideradas], total, totalAnio: delAnio.length,
      activos: filas.length, indicadores, umbral: UMBRAL_INASISTENCIAS,
    };
  }

  // ---------- Cálculo de indicadores ----------
  const porNombre = (a, b) => a.socio.nombre.localeCompare(b.socio.nombre);

  function calcular(filas, total) {
    const promedio = Math.round(filas.reduce((s, f) => s + f.pct, 0) / filas.length);
    const perfectos = filas.filter(f => f.pct === 100).length;

    // 1) % por socio (orden alfabético)
    const alfabetico = [...filas].sort(porNombre);

    // 2) Ranking de participación (los empates comparten posición)
    const ranking = [...filas].sort((a, b) => b.asist - a.asist || porNombre(a, b));
    ranking.forEach((f, i) => {
      const prev = ranking[i - 1];
      f.pos = prev && prev.asist === f.asist ? prev.pos : i + 1;
    });

    // 3) Miembros más activos (primeros del ranking con al menos una asistencia)
    const conAsistencia = ranking.filter(f => f.asist > 0);
    const activos = conAsistencia.slice(0, TOP_ACTIVOS);
    const corte = activos[activos.length - 1];
    const empatados = corte
      ? conAsistencia.slice(TOP_ACTIVOS).filter(f => f.asist === corte.asist).length
      : 0;

    // 4) Inasistencias recurrentes
    const recurrentes = filas
      .filter(f => f.inasist >= UMBRAL_INASISTENCIAS)
      .sort((a, b) => b.inasist - a.inasist || porNombre(a, b));

    return { total, promedio, perfectos, alfabetico, ranking, activos, empatados, recurrentes };
  }

  // ---------- Indicadores en pantalla ----------
  const claseBarra = (pct) => (pct >= 80 ? "barra-alta" : pct >= 50 ? "barra-media" : "barra-baja");
  const barra = (pct) =>
    `<span class="barra" role="img" aria-label="${pct}%"><span class="${claseBarra(pct)}" style="width:${pct}%"></span></span>`;
  const medalla = (pos) => (pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}`);

  function pintarIndicadores(anio, total, totalAnio, cantActivos, r) {
    const cont = document.getElementById("cuadroIndicadores");

    if (!total) {
      cont.innerHTML = `<div class="panel"><p class="ind-vacio">Todavía no hay asambleas realizadas con asistencia registrada en ${esc(anio)}. Los indicadores aparecerán cuando se registre la primera.</p></div>`;
      return;
    }
    if (!cantActivos || !r) {
      cont.innerHTML = `<div class="panel"><p class="ind-vacio">No hay socios activos para calcular indicadores.</p></div>`;
      return;
    }

    const nota = `Sobre ${total} asamblea${total === 1 ? "" : "s"} realizada${total === 1 ? "" : "s"} con asistencia registrada. Solo socios activos.`;

    cont.innerHTML = `
      <div class="cards-grid">
        <div class="stat-card">
          <span class="stat-num">${total}</span>
          <span class="stat-label">Asambleas con asistencia${total !== totalAnio ? ` (de ${totalAnio} del año)` : ""}</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${r.promedio}%</span>
          <span class="stat-label">Asistencia promedio</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${r.perfectos}</span>
          <span class="stat-label">Socios con 100% de asistencia</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${r.recurrentes.length}</span>
          <span class="stat-label">Con ${UMBRAL_INASISTENCIAS} o más inasistencias</span>
        </div>
      </div>

      <div class="ind-grid">
        <div class="panel">
          <h3>% de asistencia por socio</h3>
          <p class="ind-sub">${nota}</p>
          <ul class="ind-lista ind-scroll">
            ${r.alfabetico.map(f => `
              <li>
                <span class="ind-nombre">${esc(f.socio.nombre)}<small class="ind-dato">${f.asist} de ${total}</small></span>
                <b class="ind-pct">${f.pct}%</b>
                ${barra(f.pct)}
              </li>`).join("")}
          </ul>
        </div>

        <div class="panel">
          <h3>Ranking de participación</h3>
          <p class="ind-sub">Ordenado de mayor a menor asistencia. Los empates comparten posición.</p>
          <ul class="ind-lista ind-rank ind-scroll">
            ${r.ranking.map(f => `
              <li>
                <span class="ind-pos">${medalla(f.pos)}</span>
                <span class="ind-nombre">${esc(f.socio.nombre)}<small class="ind-dato">${f.asist} de ${total}</small></span>
                <b class="ind-pct">${f.pct}%</b>
                ${barra(f.pct)}
              </li>`).join("")}
          </ul>
        </div>

        <div class="panel">
          <h3>Miembros más activos</h3>
          <p class="ind-sub">Los ${TOP_ACTIVOS} socios con más asistencias del año.</p>
          ${r.activos.length ? `
            <ul class="ind-lista">
              ${r.activos.map(f => `
                <li>
                  <span class="ind-nombre">⭐ ${esc(f.socio.nombre)}<small class="ind-dato">${f.asist} asistencia${f.asist === 1 ? "" : "s"} de ${total}</small></span>
                  <b class="ind-pct">${f.pct}%</b>
                </li>`).join("")}
            </ul>
            ${r.empatados ? `<p class="ind-sub" style="margin-top:.6rem">y ${r.empatados} socio${r.empatados === 1 ? "" : "s"} más con la misma asistencia.</p>` : ""}
          ` : `<p class="ind-vacio">Aún no hay asistencias registradas.</p>`}
        </div>

        <div class="panel ind-alerta">
          <h3>Inasistencias recurrentes</h3>
          <p class="ind-sub">Socios con ${UMBRAL_INASISTENCIAS} o más inasistencias en el año.</p>
          ${r.recurrentes.length ? `
            <ul class="ind-lista">
              ${r.recurrentes.map(f => `
                <li>
                  <span class="ind-nombre">${esc(f.socio.nombre)}<small class="ind-dato">Faltó: ${f.faltas.map(a => corto(a.fecha)).join(", ")}</small></span>
                  <b class="ind-pct">${f.inasist} falta${f.inasist === 1 ? "" : "s"}</b>
                </li>`).join("")}
            </ul>
          ` : `<p class="ind-vacio">Ningún socio activo tiene ${UMBRAL_INASISTENCIAS} o más inasistencias. 🎉</p>`}
        </div>
      </div>`;
  }

  function init() {
    document.getElementById("selectorAnio").addEventListener("change", render);
    document.getElementById("btnPDFCuadro").addEventListener("click", () => {
      if (!_datos) return UI.toast("No hay datos para exportar en este año.");
      PDF.cuadroAnual(_datos);
    });
  }

  return { init, render };
})();
window.Cuadro = Cuadro;
