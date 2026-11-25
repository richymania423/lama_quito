/**
 * puntaje.js — Módulo "Puntaje": el administrador edita los parámetros del sistema de puntos
 * (valores por evento, kilómetros y bonificaciones). Se guardan en la tabla puntos_config.
 */
const Puntaje = (() => {
  const GRUPOS = ["Eventos", "Kilómetros", "Bonificaciones"];
  const esc = (s) => UI.esc(s);

  async function render() {
    const cont = document.getElementById("puntajeContenido");
    cont.innerHTML = `<p class="muted">Cargando...</p>`;
    const cfg = await Puntos.cargar();
    const v = cfg.valores;
    const editable = UI.puede("puntaje") && cfg.disponible;

    const aviso = !cfg.disponible
      ? `<div class="panel ind-alerta"><p style="margin:0">Falta crear la tabla de parámetros: ejecuta <b>docs/supabase_puntos.sql</b> en Supabase.
          Mientras tanto el ranking usa los valores por defecto.</p></div>`
      : "";
    const estado = cfg.origen === "base"
      ? `Última modificación: ${cfg.actualizado ? new Date(cfg.actualizado).toLocaleString("es-EC") : "—"}${cfg.actualizadoPor ? ` por ${esc(cfg.actualizadoPor)}` : ""}.`
      : "Se están usando los valores por defecto (aún no se han guardado cambios).";

    cont.innerHTML = `${aviso}
      <form id="formPuntaje" novalidate>
        ${GRUPOS.map(g => `
          <div class="panel">
            <h3>${g}</h3>
            <div class="form-grid puntaje-grid">
              ${Puntos.PARAMETROS.filter(p => p.grupo === g).map(p => `
                <div class="form-field">
                  <label for="pp_${p.clave}">${esc(p.etiqueta)}</label>
                  <div class="campo-sufijo">
                    <input type="number" id="pp_${p.clave}" name="${p.clave}" min="0" step="${p.paso || 1}" inputmode="decimal"
                      value="${v[p.clave]}" required ${editable ? "" : "disabled"} />
                    <span class="muted">${esc(p.sufijo)}</span>
                  </div>
                  <small class="muted">Por defecto: ${Puntos.fmt(Puntos.DEFECTO[p.clave])}</small>
                </div>`).join("")}
            </div>
          </div>`).join("")}

        <div class="panel">
          <h3>Ejemplo con estos valores</h3>
          <p id="puntajeEjemplo" class="ind-sub"></p>
          <p class="ind-sub">Reglas fijas: solo cuentan eventos registrados con asistencia; como acompañante no suma puntos;
            el organizador recibe su bono solo si asistió; las bonificaciones mensuales se otorgan al terminar cada mes y,
            si el año es perfecto, se otorga solo la anual.</p>
        </div>

        <p class="muted" id="puntajeEstado">${estado}</p>
        <p class="login-error" id="puntajeError"></p>
        ${editable ? `
        <div class="btn-row">
          <button type="submit" class="btn">Guardar parámetros</button>
          <button type="button" class="btn btn-outline" id="btnPuntajeDefecto">Restaurar valores por defecto</button>
        </div>` : ""}
      </form>`;

    const form = document.getElementById("formPuntaje");
    form.addEventListener("input", pintarEjemplo);
    pintarEjemplo();
    if (!editable) return;

    document.getElementById("btnPuntajeDefecto").addEventListener("click", () => {
      Puntos.PARAMETROS.forEach(p => { form.elements[p.clave].value = Puntos.DEFECTO[p.clave]; });
      pintarEjemplo();
      UI.toast("Valores por defecto cargados. Pulsa “Guardar parámetros” para aplicarlos.");
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("puntajeError");
      err.textContent = "";
      const valores = {};
      for (const p of Puntos.PARAMETROS) {
        const inp = form.elements[p.clave];
        const txt = String(inp.value).trim().replace(",", ".");
        const n = Number(txt);
        if (txt === "" || !Number.isFinite(n) || n < 0) {
          err.textContent = `“${p.etiqueta}” debe ser un número mayor o igual a 0.`;
          inp.focus();
          return;
        }
        valores[p.clave] = n;
      }
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await DB.puntos.guardar(valores, Auth.nombreUsuario());
        UI.toast("Parámetros de puntaje guardados.");
        await render();
      } catch (ex) {
        console.error("Error al guardar parámetros de puntaje:", ex);
        err.textContent = "No se pudo guardar: " + (ex.message || ex);
        btn.disabled = false;
      }
    });
  }

  // Ejemplo en vivo: una rodada interna de 120 km organizada por el socio y un aniversario nacional de 600 km
  function pintarEjemplo() {
    const form = document.getElementById("formPuntaje");
    const el = document.getElementById("puntajeEjemplo");
    if (!form || !el) return;
    const n = (k) => { const x = Number(String(form.elements[k].value).replace(",", ".")); return Number.isFinite(x) && x >= 0 ? x : 0; };
    const f = Puntos.fmt;
    const km1 = Math.min(120, n("maxKmEvento")), km2 = Math.min(600, n("maxKmEvento"));
    const r1 = n("rodadaInterna") + km1 * n("porKm") + n("organizador");
    const r2 = n("aniversarioNacional") + km2 * n("porKm");
    el.innerHTML = `Rodada interna de 120 km que el socio organizó: ${f(n("rodadaInterna"))} + ${f(km1)} km × ${f(n("porKm"))} + ${f(n("organizador"))} = <b>${f(r1)} pts</b>.
      Aniversario nacional de 600 km: ${f(n("aniversarioNacional"))} + ${f(km2)} km × ${f(n("porKm"))} = <b>${f(r2)} pts</b>.
      Una asamblea: <b>${f(n("asamblea"))} pts</b>.`;
  }

  return { render };
})();
window.Puntaje = Puntaje;
