/**
 * directiva.js — Vista "Directiva de Capítulo".
 * Muestra a los socios con cargo de directiva (foto, nombre completo y cargo).
 * Presidente y Vicepresidente se destacan en grande en la fila superior.
 */
const Directiva = (() => {
  // Cargos destacados (fila superior) y cargos del resto de la directiva
  const DESTACADOS = ["Presidente", "Vicepresidente"];
  const RESTO = ["Tesorero", "Secretario", "Oficial de Mototurismo", "Gerente de Negocios"];

  function tarjeta(cargo, socio, url, clase) {
    if (!socio) {
      return `
        <article class="dir-card ${clase} dir-vacante">
          ${Socios.avatarHtml("?", "", "avatar-xl")}
          <h3 class="dir-nombre muted">Vacante</h3>
          <p class="dir-cargo">${UI.esc(cargo)}</p>
        </article>`;
    }
    return `
      <article class="dir-card ${clase}">
        ${Socios.avatarHtml(socio.nombre, url, "avatar-xl")}
        <h3 class="dir-nombre">${UI.esc(socio.nombre)}</h3>
        <p class="dir-cargo">${UI.esc(cargo)}</p>
      </article>`;
  }

  async function render() {
    const cont = document.getElementById("directivaContenido");
    cont.innerHTML = `<p class="muted">Cargando...</p>`;
    try {
      const socios = await DB.socios.listar();
      const porCargo = {};
      socios.forEach(s => { if (s.rango && !porCargo[s.rango]) porCargo[s.rango] = s; });

      // URLs firmadas solo de quienes ocupan un cargo; si falla se muestran iniciales
      let urls = {};
      try {
        urls = await DB.fotos.urls([...DESTACADOS, ...RESTO].map(c => porCargo[c] && porCargo[c].fotoPath));
      } catch (err) {
        console.warn("No se pudieron obtener las fotos de la directiva:", err);
      }

      const fila = (cargos, clase) => cargos
        .map(c => tarjeta(c, porCargo[c], porCargo[c] ? urls[porCargo[c].fotoPath] : "", clase))
        .join("");

      cont.innerHTML = `
        <div class="dir-fila dir-destacados">${fila(DESTACADOS, "dir-card-grande")}</div>
        <div class="dir-fila dir-resto">${fila(RESTO, "dir-card-normal")}</div>`;
    } catch (err) {
      console.error("Error al cargar la directiva:", err);
      cont.innerHTML = `<p class="login-error">No se pudo cargar la directiva: ${UI.esc(err.message || String(err))}</p>`;
    }
  }

  return { render };
})();
window.Directiva = Directiva;
