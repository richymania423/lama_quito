/**
 * cuadro.js — Cuadro de asistencias de socios a asambleas durante el año.
 * Filas = socios, columnas = asambleas del año, celda = asistió o no, + % anual.
 */
const Cuadro = (() => {
  let _datos = null; // datos preparados para el PDF del año seleccionado

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

    if (!socios.length) {
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td class="muted" style="text-align:center;padding:1.5rem">No hay socios registrados.</td></tr>`;
      _datos = null;
      return;
    }
    if (!delAnio.length) {
      thead.innerHTML = "";
      tbody.innerHTML = `<tr><td class="muted" style="text-align:center;padding:1.5rem">No hay asambleas registradas en ${anio}.</td></tr>`;
      _datos = null;
      return;
    }

    // matriz de asistencia: matriz[socioId][asambleaId] = true/false
    const matriz = {};
    socios.forEach(s => { matriz[s.id] = {}; });
    asistencia.forEach(r => {
      if (matriz[r.socioId]) matriz[r.socioId][r.asambleaId] = r.presente;
    });

    // porcentaje anual por socio
    const porcentajes = {};
    socios.forEach(s => {
      const presentes = delAnio.filter(a => matriz[s.id] && matriz[s.id][a.id]).length;
      porcentajes[s.id] = Math.round((presentes / delAnio.length) * 100);
    });

    // encabezado
    thead.innerHTML = `<tr>
      <th>Socio</th>
      ${delAnio.map(a => `<th title="${UI.esc(a.lugar || "")}">${UI.fmtFecha(a.fecha).slice(0, 5)}</th>`).join("")}
      <th>%</th>
    </tr>`;

    // filas
    tbody.innerHTML = socios.map(s => `
      <tr>
        <td>${UI.esc(s.nombre)}</td>
        ${delAnio.map(a => {
          const ok = matriz[s.id] && matriz[s.id][a.id];
          return ok ? `<td class="yes">✓</td>` : `<td class="no">·</td>`;
        }).join("")}
        <td class="pct">${porcentajes[s.id]}%</td>
      </tr>`).join("");

    // guarda datos para exportar a PDF
    _datos = { anio, socios, asambleas: delAnio, matriz, porcentajes };
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
