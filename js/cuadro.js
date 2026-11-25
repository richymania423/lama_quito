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
    // rodadas: si las tablas aún no existen, el cuadro sigue funcionando sin esa sección
    let rodadas = null, rodadasAsis = [];
    try {
      [rodadas, rodadasAsis] = await Promise.all([DB.rodadas.listar(), DB.rodadasAsistencia.todos()]);
    } catch (err) {
      console.warn("No se pudieron cargar las rodadas:", err);
    }

    // años disponibles según las asambleas y rodadas (más el actual)
    const anios = new Set([...asambleas, ...(rodadas || [])].map(a => (a.fecha || "").slice(0, 4)).filter(Boolean));
    anios.add(String(new Date().getFullYear()));
    const listaAnios = [...anios].sort((a, b) => b.localeCompare(a));

    const selAnio = document.getElementById("selectorAnio");
    const anterior = selAnio.value;
    selAnio.innerHTML = listaAnios.map(a => `<option value="${a}">${a}</option>`).join("");
    if (anterior && listaAnios.includes(anterior)) selAnio.value = anterior;

    pintar(selAnio.value, socios, asambleas, asistencia);
    _rodadas = calcularRodadas(selAnio.value, socios, rodadas, rodadasAsis);
    pintarRodadas(selAnio.value, _rodadas);

    // puntos: con los parámetros vigentes (módulo Puntaje)
    await Puntos.cargar();
    _puntos = Puntos.calcular({
      anio: selAnio.value, socios, asambleas, asistencia, rodadas: rodadas || [], rodadasAsis,
    });
    pintarPuntos(_puntos);
  }

  // ---------- Ranking de puntos ----------
  let _puntos = null;
  const pts = (n) => Puntos.fmt(n);

  // celda "puntos (cantidad)"; vacía si no hay nada
  const celda = (g, extra = "") => g.pts || g.n
    ? `${pts(g.pts)}${g.n != null ? ` <small class="ind-dato">(${g.n}${extra})</small>` : ""}`
    : `<span class="muted">—</span>`;

  function aniversarios(f) {
    return {
      n: f.anivCapitulo.n + f.anivNacional.n + f.anivInternacional.n,
      pts: f.anivCapitulo.pts + f.anivNacional.pts + f.anivInternacional.pts,
    };
  }
  const bonos = (f) => ({ pts: f.mensual.pts + f.anual.pts });

  function pintarPuntos(p) {
    const cont = document.getElementById("cuadroPuntos");
    if (!cont) return;
    const v = p.valores;
    const reglas = `Asamblea ${pts(v.asamblea)} · Rodada interna ${pts(v.rodadaInterna)} · Aniversario de otro capítulo ${pts(v.aniversarioCapitulo)}
      · nacional ${pts(v.aniversarioNacional)} · internacional ${pts(v.aniversarioInternacional)} · Actividad social ${pts(v.social)}
      · Organizador ${pts(v.organizador)} · ${pts(v.porKm)} por km (máx. ${pts(v.maxKmEvento)} km por evento)
      · Mes perfecto ${pts(v.bonoMensual)} · Año perfecto ${pts(v.bonoAnual)} (reemplaza a las mensuales).`;
    const origen = Puntos.config().origen === "base" ? "" : " Se usan los valores por defecto.";

    if (!p.eventos.total) {
      cont.innerHTML = `<div class="panel"><p class="ind-vacio">Todavía no hay asambleas ni rodadas realizadas con asistencia registrada en ${esc(p.anio)}.</p>
        <p class="ind-sub">${reglas}${origen}</p></div>`;
      return;
    }
    if (!p.filas.length) {
      cont.innerHTML = `<div class="panel"><p class="ind-vacio">No hay socios activos.</p></div>`;
      return;
    }
    const pl = (n, s) => `${n} ${s}${n === 1 ? "" : "s"}`;
    cont.innerHTML = `
      <p class="ind-sub">Sobre ${pl(p.eventos.total, "evento")} del año con asistencia registrada
        (${pl(p.eventos.asambleas, "asamblea")} y ${pl(p.eventos.rodadas, "rodada")} o actividad${p.eventos.rodadas === 1 ? "" : "es"}).
        Toca un socio para ver el detalle.</p>
      <div class="table-wrap">
        <table class="data-table tabla-puntos" id="tablaPuntos">
          <thead><tr>
            <th>Pos.</th><th>Socio</th><th>Asambleas</th><th>Internas</th><th>Aniversarios</th><th>Sociales</th>
            <th>Km</th><th>Organizador</th><th>Bonificación</th><th>Total</th>
          </tr></thead>
          <tbody>
            ${p.filas.map((f, i) => `<tr class="fila-puntos" data-i="${i}" tabindex="0" role="button" aria-label="Ver detalle de puntos de ${esc(f.socio.nombre)}">
              <td style="text-align:center">${medalla(f.pos)}</td>
              <td>${esc(f.socio.nombre)}${f.anual.enCamino ? ` <span class="badge badge-active" title="Ha asistido a todos los eventos del año hasta hoy">🎯 año perfecto en curso</span>` : ""}${f.acompanante ? ` <small class="ind-dato">${f.acompanante} como acompañante</small>` : ""}</td>
              <td style="text-align:right">${celda(f.asambleas)}</td>
              <td style="text-align:right">${celda(f.internas)}</td>
              <td style="text-align:right">${celda(aniversarios(f))}</td>
              <td style="text-align:right">${celda(f.sociales)}</td>
              <td style="text-align:right">${f.km.pts ? `${pts(f.km.pts)} <small class="ind-dato">(${pts(f.km.km)} km)</small>` : `<span class="muted">—</span>`}</td>
              <td style="text-align:right">${celda(f.organizador)}</td>
              <td style="text-align:right">${bonos(f).pts ? `${pts(bonos(f).pts)} <small class="ind-dato">(${f.anual.pts ? "año perfecto" : pl(f.mensual.n, "mes")})</small>` : `<span class="muted">—</span>`}</td>
              <td style="text-align:right"><b>${pts(f.total)}</b></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="ind-sub" style="margin-top:.5rem">${reglas}${origen} Solo socios activos y eventos oficiales registrados.
        Como acompañante no suma puntos. Las bonificaciones mensuales se otorgan al terminar cada mes y la anual al terminar el año.</p>`;

    cont.querySelectorAll(".fila-puntos").forEach(tr => {
      const abrir = () => verDetalle(p.filas[Number(tr.dataset.i)], p);
      tr.addEventListener("click", abrir);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } });
    });
  }

  function verDetalle(f, p) {
    const filas = f.detalle.map(d => `<tr>
        <td>${UI.fmtFecha(d.fecha)}</td><td>${esc(d.evento)}</td><td>${esc(d.concepto)}</td>
        <td style="text-align:right">${d.puntos ? pts(d.puntos) : `<span class="muted">0</span>`}</td>
      </tr>`).join("");
    UI.openModal(`Puntos de ${f.socio.nombre} · ${p.anio}`, `
      <div class="cards-grid" style="margin-bottom:.8rem">
        <div class="stat-card"><span class="stat-num">${pts(f.total)}</span><span class="stat-label">Puntos totales</span></div>
        <div class="stat-card"><span class="stat-num">${f.pos}°</span><span class="stat-label">Posición</span></div>
        <div class="stat-card"><span class="stat-num">${f.eventosAsistidos} / ${p.eventos.total}</span><span class="stat-label">Eventos asistidos</span></div>
      </div>
      ${f.anual.enCamino ? `<p class="ind-sub">🎯 Ha asistido a todos los eventos del año hasta hoy. Si se mantiene, al cerrar el año recibirá la bonificación anual (${pts(p.valores.bonoAnual)}) en lugar de las mensuales.</p>` : ""}
      ${f.detalle.length ? `<div class="table-wrap"><table class="data-table" id="tablaDetallePuntos">
        <thead><tr><th>Fecha</th><th>Evento</th><th>Concepto</th><th>Puntos</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="3"><b>Total</b></td><td style="text-align:right"><b>${pts(f.total)}</b></td></tr></tfoot>
      </table></div>` : `<p class="ind-vacio">Aún no suma puntos en ${esc(p.anio)}.</p>`}`);
  }

  // ---------- Rodadas ----------
  // Igual que en asambleas: cuentan las rodadas del año ya realizadas y con asistencia registrada.
  let _rodadas = null;

  function calcularRodadas(anio, socios, rodadas, asis) {
    if (!rodadas) return { disponible: false };
    const hoy = hoyLocal();
    const delAnio = rodadas.filter(r => (r.fecha || "").startsWith(anio))
      .sort((x, y) => (x.fecha || "").localeCompare(y.fecha || ""));
    const conRegistro = new Set(asis.map(x => x.rodadaId));
    const consideradas = delAnio.filter(r => r.fecha <= hoy && conRegistro.has(r.id));
    const ids = new Set(consideradas.map(r => r.id));
    const reg = new Map(asis.filter(x => x.presente && ids.has(x.rodadaId)).map(x => [`${x.rodadaId}__${x.socioId}`, x]));
    const total = consideradas.length;
    const km = (r) => Number(r.distanciaKm) || 0;
    const esInterna = (r) => Puntos.tipo(r.tipo).codigo === "Interna";
    const esAniv = (r) => !!Puntos.tipo(r.tipo).aniversario;
    const esSocial = (r) => Puntos.tipo(r.tipo).codigo === "Social";

    const filas = socios.filter(s => s.activo).map(s => {
      const fue = consideradas.filter(r => reg.has(`${r.id}__${s.id}`));
      // como acompañante cuenta la asistencia, pero no los km
      const conMoto = fue.filter(r => !reg.get(`${r.id}__${s.id}`).acompanante);
      return {
        socio: s,
        asist: fue.length,
        internas: fue.filter(esInterna).length,
        aniversario: fue.filter(esAniv).length,
        sociales: fue.filter(esSocial).length,
        km: conMoto.reduce((t, r) => t + km(r), 0),
        pct: total ? Math.round((fue.length / total) * 100) : 0,
      };
    }).sort((a, b) => b.asist - a.asist || b.km - a.km || a.socio.nombre.localeCompare(b.socio.nombre));
    filas.forEach((f, i) => {
      const prev = filas[i - 1];
      f.pos = prev && prev.asist === f.asist && prev.km === f.km ? prev.pos : i + 1;
    });

    return {
      disponible: true,
      anio,
      totalAnio: delAnio.length,
      total,
      internas: consideradas.filter(esInterna).length,
      aniversario: consideradas.filter(esAniv).length,
      sociales: consideradas.filter(esSocial).length,
      kmTotal: consideradas.reduce((t, r) => t + km(r), 0),
      promedio: filas.length && total ? Math.round(filas.reduce((t, f) => t + f.pct, 0) / filas.length) : 0,
      filas,
    };
  }

  const fmtKm = (n) => `${Number(n || 0).toLocaleString("es-EC", { maximumFractionDigits: 1 })} km`;

  function pintarRodadas(anio, r) {
    const cont = document.getElementById("cuadroRodadas");
    if (!cont) return;
    if (!r.disponible) {
      cont.innerHTML = `<div class="panel"><p class="ind-vacio">Las rodadas no están disponibles todavía.</p></div>`;
      return;
    }
    if (!r.total) {
      cont.innerHTML = `<div class="panel"><p class="ind-vacio">Todavía no hay rodadas realizadas con asistencia registrada en ${esc(anio)}${r.totalAnio ? ` (${r.totalAnio} registrada${r.totalAnio === 1 ? "" : "s"} en el año)` : ""}.</p></div>`;
      return;
    }
    cont.innerHTML = `
      <div class="cards-grid">
        <div class="stat-card">
          <span class="stat-num">${r.total}</span>
          <span class="stat-label">Rodadas y eventos con asistencia${r.total !== r.totalAnio ? ` (de ${r.totalAnio} del año)` : ""}</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${r.internas} / ${r.aniversario} / ${r.sociales}</span>
          <span class="stat-label">Internas / Aniversarios / Sociales</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${fmtKm(r.kmTotal)}</span>
          <span class="stat-label">Distancia total de las rodadas</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">${r.promedio}%</span>
          <span class="stat-label">Participación promedio</span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table" id="tablaCuadroRodadas">
          <thead><tr>
            <th>Pos.</th><th>Socio</th><th>Eventos</th><th>Internas</th><th>Aniversarios</th><th>Sociales</th><th>Km recorridos</th><th>%</th>
          </tr></thead>
          <tbody>
            ${r.filas.map(f => `<tr>
              <td style="text-align:center">${medalla(f.pos)}</td>
              <td>${esc(f.socio.nombre)}</td>
              <td style="text-align:center">${f.asist} de ${r.total}</td>
              <td style="text-align:center">${f.internas}</td>
              <td style="text-align:center">${f.aniversario}</td>
              <td style="text-align:center">${f.sociales}</td>
              <td style="text-align:right">${fmtKm(f.km)}</td>
              <td style="text-align:center"><b>${f.pct}%</b></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="ind-sub" style="margin-top:.5rem">Solo socios activos. Km recorridos = suma de la distancia (solo ida) de las rodadas a las que asistió con su moto; como acompañante no suma km.</p>`;
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
      // sin asambleas el PDF aún puede incluir la participación en rodadas
      _datos = { anio, socios, asambleas: [], matriz: {}, porcentajes: {}, consideradas: [], total: 0, totalAnio: 0, indicadores: null, umbral: UMBRAL_INASISTENCIAS };
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
      const hayRodadas = _rodadas && _rodadas.disponible && _rodadas.total;
      if (!_datos.asambleas.length && !hayRodadas) return UI.toast("No hay datos para exportar en este año.");
      const hayPuntos = _puntos && _puntos.eventos.total && _puntos.filas.length;
      PDF.cuadroAnual({ ..._datos, rodadas: hayRodadas ? _rodadas : null, puntos: hayPuntos ? _puntos : null });
    });
  }

  return { init, render };
})();
window.Cuadro = Cuadro;
