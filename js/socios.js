/**
 * socios.js — Gestión del listado de socios (CRUD + búsqueda).
 */
const Socios = (() => {
  let _cache = [];
  let _copilotos = [];
  let _motos = [];
  const _abiertos = new Set(); // ids de socios con su rama desplegada
  let _urls = {}; // ruta de foto -> URL firmada temporal

  // Rangos de socio. Los 6 primeros son cargos de directiva: solo un socio puede tener cada uno.
  const RANGOS_UNICOS = [
    "Presidente", "Vicepresidente", "Tesorero", "Secretario",
    "Oficial de Mototurismo", "Gerente de Negocios",
  ];
  const RANGOS = [...RANGOS_UNICOS, "Full Color", "Rocket Prospect", "Prospecto"];

  // ---------- Utilidades de foto ----------
  function iniciales(nombre) {
    return (nombre || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";
  }

  function avatarHtml(nombre, url, extra = "") {
    return url
      ? `<img class="avatar ${extra}" src="${UI.esc(url)}" alt="" />`
      : `<span class="avatar avatar-vacio ${extra}">${UI.esc(iniciales(nombre))}</span>`;
  }

  // Reduce la imagen a un máximo de 400 px por lado y la convierte a JPEG.
  function redimensionar(file, max = 400) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * escala);
        const h = Math.round(img.naturalHeight * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; // las transparencias de PNG quedan sobre fondo blanco
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen."))),
          "image/jpeg", 0.82);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("El archivo no es una imagen válida."));
      };
      img.src = url;
    });
  }

  async function render() {
    _cache = await DB.socios.listar();
    // URLs firmadas de las fotos; si falla (p. ej. bucket aún no creado) se muestran iniciales
    try {
      _urls = await DB.fotos.urls(_cache.map(s => s.fotoPath));
    } catch (err) {
      console.warn("No se pudieron obtener las fotos:", err);
      _urls = {};
    }
    // copilotos; si la tabla aún no existe, Socios sigue funcionando sin ellos
    try {
      _copilotos = await DB.copilotos.listar();
    } catch (err) {
      console.warn("No se pudieron cargar los copilotos:", err);
      _copilotos = [];
    }
    try {
      _motos = await DB.motos.listar();
    } catch (err) {
      console.warn("No se pudieron cargar las motocicletas:", err);
      _motos = [];
    }
    // botones de alta solo si puede administrar
    const btnMoto = document.getElementById("btnNuevaMoto");
    if (btnMoto) btnMoto.style.display = UI.puede("copilotos") ? "" : "none";
    const btnNuevo = document.getElementById("btnNuevoSocio");
    if (btnNuevo) btnNuevo.style.display = UI.puede("socios") ? "" : "none";
    const btnCop = document.getElementById("btnNuevoCopiloto");
    if (btnCop) btnCop.style.display = UI.puede("copilotos") ? "" : "none";
    paint(document.getElementById("buscarSocio").value || "");
  }

  // Una rama del árbol: copiloto ("c") o motocicleta ("m")
  function filaRama(r, ultimo, puedeCop, padre, abierto) {
    const esMoto = r.tipo === "m";
    const x = r.item;
    let titulo, det;
    if (esMoto) {
      titulo = `🏍️ ${[x.marca, x.modelo].filter(Boolean).join(" ")}`;
      det = [x.color, x.anio ? "Año " + x.anio : "", x.cilindraje ? x.cilindraje + " cc" : "",
        x.placa ? "Placa " + x.placa : ""].filter(Boolean);
    } else {
      titulo = `👤 ${x.nombre}`;
      det = [x.parentesco, x.tipoSangre ? "Sangre " + x.tipoSangre : "",
        x.fechaNacimiento ? "Nac. " + UI.fmtFecha(x.fechaNacimiento) : ""].filter(Boolean);
    }
    const [attrE, attrD, nom] = esMoto
      ? ["data-editmoto", "data-delmoto", "motocicleta"] : ["data-editcop", "data-delcop", "copiloto"];
    return `<tr class="fila-copiloto" data-padre="${UI.esc(padre)}" ${abierto ? "" : "hidden"}>
      <td></td>
      <td colspan="5"><div class="arbol-celda">
        <span class="arbol-rama">${ultimo ? "└─" : "├─"}</span>
        <span>${UI.esc(titulo)}</span>
        <span class="copiloto-detalle">${det.map(d => UI.esc(d)).join(" · ")}</span>
      </div></td>
      <td class="row-actions">
        ${puedeCop ? `
          <button class="icon-btn" title="Editar ${nom}" ${attrE}="${UI.esc(x.id)}">✏️</button>
          <button class="icon-btn" title="Eliminar ${nom}" ${attrD}="${UI.esc(x.id)}">🗑️</button>
        ` : ""}
      </td>
    </tr>`;
  }

  const ramas = (cops, motos) => [
    ...cops.map(item => ({ tipo: "c", item })),
    ...motos.map(item => ({ tipo: "m", item })),
  ];
  function paint(filtro) {
    const q = filtro.trim().toLowerCase();
    const puedeCop = UI.puede("copilotos");
    const copDe = (id) => _copilotos.filter(c => c.socioId === id);
    const motosDe = (id) => _motos.filter(m => m.socioId === id);
    const coincideCop = (c) =>
      c.nombre.toLowerCase().includes(q) || (c.parentesco || "").toLowerCase().includes(q);
    const coincideMoto = (m) =>
      [m.marca, m.modelo, m.placa, m.color].some(v => String(v || "").toLowerCase().includes(q));
    const filtrados = _cache.filter(s =>
      !q || s.nombre.toLowerCase().includes(q) || s.identificacion.toLowerCase().includes(q) ||
      copDe(s.id).some(coincideCop) || motosDe(s.id).some(coincideMoto));
    const idsSocios = new Set(_cache.map(s => s.id));
    const sinSocio = (x) => !x.socioId || !idsSocios.has(x.socioId);
    const huerfanos = ramas(
      _copilotos.filter(c => sinSocio(c) && (!q || coincideCop(c))),
      _motos.filter(m => sinSocio(m) && (!q || coincideMoto(m))));
    const tbody = document.querySelector("#tablaSocios tbody");

    if (!filtrados.length && !huerfanos.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align:center;padding:1.5rem">
        ${_cache.length ? "Sin resultados para la búsqueda." : "No hay socios. Agrega el primero con “+ Nuevo socio”."}
      </td></tr>`;
      return;
    }

    const filaSocio = (s, i) => {
      // si se busca por un copiloto, solo se muestran los que coinciden (salvo que el socio coincida)
      const socioCoincide = !q || s.nombre.toLowerCase().includes(q) || s.identificacion.toLowerCase().includes(q);
      const abierto = !!q || _abiertos.has(s.id); // al buscar se despliega todo
      const hijos = ramas(
        copDe(s.id).filter(c => socioCoincide || coincideCop(c)),
        motosDe(s.id).filter(m => socioCoincide || coincideMoto(m)));
      return `
      <tr>
        <td>${hijos.length ? `<button class="toggle-arbol" data-toggle="${s.id}" aria-expanded="${abierto}" title="Mostrar u ocultar copilotos y motocicletas">${abierto ? "−" : "+"}</button>` : ""}${i + 1}</td>
        <td><span class="socio-nombre">${avatarHtml(s.nombre, _urls[s.fotoPath])}<span>${UI.esc(s.nombre)}${s.rango ? `<small class="socio-rango">${UI.esc(s.rango)}</small>` : ""}</span></span></td>
        <td>${UI.esc(s.identificacion) || "—"}</td>
        <td>${UI.esc(s.telefono) || "—"}</td>
        <td>${s.fechaNacimiento ? UI.fmtFecha(s.fechaNacimiento) : "—"}</td>
        <td>${s.activo
          ? '<span class="badge badge-active">Activo</span>'
          : '<span class="badge badge-inactive">Inactivo</span>'}</td>
        <td class="row-actions">
          ${UI.puede("socios") ? `
            <button class="icon-btn" title="Editar" data-edit="${s.id}">✏️</button>
            <button class="icon-btn" title="Eliminar" data-del="${s.id}">🗑️</button>
          ` : `<span class="muted">—</span>`}
          ${puedeCop ? `<button class="icon-btn" title="Ingresar copiloto" data-addcop="${s.id}">👤</button>
            <button class="icon-btn" title="Ingresar motocicleta" data-addmoto="${s.id}">🏍️</button>` : ""}
        </td>
      </tr>${hijos.map((r, k) => filaRama(r, k === hijos.length - 1, puedeCop, s.id, abierto)).join("")}`;
    };

    const grupoAbierto = !!q || _abiertos.has("_sin");
    const grupo = huerfanos.length ? `
      <tr class="fila-grupo"><td colspan="7"><button class="toggle-arbol" data-toggle="_sin" aria-expanded="${grupoAbierto}" title="Mostrar u ocultar">${grupoAbierto ? "−" : "+"}</button>Copilotos y motocicletas sin socio asignado (${huerfanos.length})</td></tr>
      ${huerfanos.map((r, k) => filaRama(r, k === huerfanos.length - 1, puedeCop, "_sin", grupoAbierto)).join("")}` : "";

    tbody.innerHTML = filtrados.map(filaSocio).join("") + grupo;

    tbody.querySelectorAll("[data-toggle]").forEach(b =>
      b.addEventListener("click", () => {
        const id = b.dataset.toggle;
        const abrir = b.getAttribute("aria-expanded") !== "true";
        if (abrir) _abiertos.add(id); else _abiertos.delete(id);
        b.setAttribute("aria-expanded", abrir);
        b.textContent = abrir ? "−" : "+";
        tbody.querySelectorAll("tr[data-padre]").forEach(tr => {
          if (tr.dataset.padre === id) tr.hidden = !abrir;
        });
      }));
    tbody.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    tbody.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => eliminar(b.dataset.del)));
    tbody.querySelectorAll("[data-addcop]").forEach(b =>
      b.addEventListener("click", () => { _abiertos.add(b.dataset.addcop); Copilotos.abrirForm(null, _cache, b.dataset.addcop, render); }));
    tbody.querySelectorAll("[data-addmoto]").forEach(b =>
      b.addEventListener("click", () => { _abiertos.add(b.dataset.addmoto); Motos.abrirForm(null, _cache, b.dataset.addmoto, render); }));
    tbody.querySelectorAll("[data-editmoto]").forEach(b =>
      b.addEventListener("click", () =>
        Motos.abrirForm(_motos.find(m => m.id === b.dataset.editmoto), _cache, "", render)));
    tbody.querySelectorAll("[data-delmoto]").forEach(b =>
      b.addEventListener("click", () =>
        Motos.eliminar(_motos.find(m => m.id === b.dataset.delmoto), render)));
    tbody.querySelectorAll("[data-editcop]").forEach(b =>
      b.addEventListener("click", () =>
        Copilotos.abrirForm(_copilotos.find(c => c.id === b.dataset.editcop), _cache, "", render)));
    tbody.querySelectorAll("[data-delcop]").forEach(b =>
      b.addEventListener("click", () =>
        Copilotos.eliminar(_copilotos.find(c => c.id === b.dataset.delcop), render)));
  }

  function abrirForm(id) {
    const s = id ? _cache.find(x => x.id === id) : null;
    UI.openModal(s ? "Editar socio" : "Nuevo socio", `
      <form id="formSocio">
        <input type="hidden" name="id" value="${s ? s.id : ""}" />
        <div class="foto-field">
          <div id="fotoPreview">${avatarHtml(s ? s.nombre : "", s ? _urls[s.fotoPath] : "", "avatar-lg")}</div>
          <div class="foto-controles">
            <label for="fotoInput">Foto del socio</label>
            <input type="file" id="fotoInput" accept="image/jpeg,image/png,image/webp" />
            <div class="btn-row" style="margin-top:.4rem">
              <button type="button" class="btn btn-sm btn-outline" id="btnQuitarFoto">Quitar foto</button>
              <span class="muted">Se reduce a 400 px automáticamente.</span>
            </div>
            <p class="login-error" id="fotoError"></p>
          </div>
        </div>
        <div class="form-field">
          <label>Nombre completo *</label>
          <input name="nombre" required value="${s ? UI.esc(s.nombre) : ""}" />
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Identificación / Cédula</label>
            <input name="identificacion" value="${s ? UI.esc(s.identificacion) : ""}" />
          </div>
          <div class="form-field">
            <label>Teléfono</label>
            <input name="telefono" value="${s ? UI.esc(s.telefono) : ""}" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Correo electrónico</label>
            <input type="email" name="email" value="${s ? UI.esc(s.email) : ""}" />
          </div>
          <div class="form-field">
            <label>Fecha de nacimiento</label>
            <input type="date" name="fechaNacimiento" value="${s ? (s.fechaNacimiento || "") : ""}" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Tipo de sangre</label>
            <select name="tipoSangre">
              <option value="">— Seleccionar —</option>
              ${["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(t =>
                `<option value="${t}" ${s && s.tipoSangre === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Sector de residencia</label>
            <select name="sectorResidencia">
              <option value="">— Seleccionar —</option>
              ${["Norte", "Sur", "Centro", "Valles"].map(sec =>
                `<option value="${sec}" ${s && s.sectorResidencia === sec ? "selected" : ""}>${sec}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="form-field">
          <label>Rango de socio</label>
          <select name="rango">
            <option value="">— Sin rango —</option>
            ${RANGOS.map(r => {
              // un cargo de directiva ya asignado a otro socio no se puede elegir
              const otro = RANGOS_UNICOS.includes(r)
                ? _cache.find(x => x.rango === r && x.id !== (s ? s.id : null))
                : null;
              return `<option value="${r}" ${s && s.rango === r ? "selected" : ""} ${otro ? "disabled" : ""}>${r}${otro ? ` (ocupado: ${UI.esc(otro.nombre)})` : ""}</option>`;
            }).join("")}
          </select>
          <p class="login-error" id="rangoError"></p>
        </div>
        <div class="form-field">
          <label><input type="checkbox" name="activo" style="width:auto;margin-right:.4rem" ${(!s || s.activo) ? "checked" : ""} /> Socio activo</label>
        </div>

        ${UI.puede("socios") ? `
        <fieldset class="acceso-box">
          <legend>Acceso al sistema</legend>
          <p class="muted" style="margin-top:0">El socio ingresa con su <b>cédula</b> como usuario. Marca el acceso y define una contraseña.</p>
          <div class="form-field">
            <label><input type="checkbox" id="chkAcceso" name="tieneAcceso" style="width:auto;margin-right:.4rem" /> Tiene acceso al sistema</label>
          </div>
          <div id="accesoDetalle" class="hidden">
            <div class="form-field">
              <label><input type="checkbox" name="esSecretario" style="width:auto;margin-right:.4rem" /> Es secretario (si no, será solo lectura)</label>
            </div>
            <div class="form-field">
              <label>Contraseña <span class="muted" id="passHint"></span></label>
              <input type="text" name="accesoPassword" minlength="6" placeholder="Mínimo 6 caracteres" />
            </div>
            <div class="form-field">
              <label><input type="checkbox" name="forzarCambio" style="width:auto;margin-right:.4rem" checked /> Debe cambiar esta clave al ingresar (el usuario elige una personal)</label>
            </div>
          </div>
          <p class="login-error" id="accesoError"></p>
        </fieldset>
        ` : ""}

        <div class="btn-row">
          <button type="submit" class="btn">Guardar</button>
          <button type="button" class="btn btn-outline" id="cancelSocio">Cancelar</button>
        </div>
      </form>`);

    document.getElementById("cancelSocio").addEventListener("click", UI.closeModal);

    // --- foto del socio ---
    let nuevaFoto = null;   // Blob JPEG ya redimensionado, pendiente de subir
    let quitarFoto = false; // true si el admin pidió quitar la foto actual
    const fotoInput = document.getElementById("fotoInput");
    const fotoPreview = document.getElementById("fotoPreview");
    const fotoError = document.getElementById("fotoError");
    const nombreActual = () => (document.querySelector('#formSocio [name="nombre"]').value || (s ? s.nombre : ""));

    fotoInput.addEventListener("change", async () => {
      fotoError.textContent = "";
      const file = fotoInput.files[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        fotoError.textContent = "Usa una imagen JPG, PNG o WEBP.";
        fotoInput.value = "";
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        fotoError.textContent = "La imagen es demasiado grande (máximo 15 MB).";
        fotoInput.value = "";
        return;
      }
      try {
        nuevaFoto = await redimensionar(file);
        quitarFoto = false;
        fotoPreview.innerHTML = avatarHtml(nombreActual(), URL.createObjectURL(nuevaFoto), "avatar-lg");
      } catch (err) {
        nuevaFoto = null;
        fotoError.textContent = err.message || String(err);
        fotoInput.value = "";
      }
    });

    document.getElementById("btnQuitarFoto").addEventListener("click", () => {
      nuevaFoto = null;
      quitarFoto = true;
      fotoInput.value = "";
      fotoError.textContent = "";
      fotoPreview.innerHTML = avatarHtml(nombreActual(), "", "avatar-lg");
    });

    // --- sección de acceso (solo admin) ---
    const chkAcceso = document.getElementById("chkAcceso");
    if (chkAcceso) {
      const detalle = document.getElementById("accesoDetalle");
      const passHint = document.getElementById("passHint");
      const toggle = () => detalle.classList.toggle("hidden", !chkAcceso.checked);
      chkAcceso.addEventListener("change", toggle);
      // precargar estado de acceso actual del socio (si tiene cédula)
      if (s && s.identificacion) {
        Auth.gestionarAcceso("estado_acceso", { cedulas: [s.identificacion] })
          .then(({ estado }) => {
            const info = estado && estado[s.identificacion];
            if (info && info.tieneAcceso) {
              chkAcceso.checked = true;
              const chkSec = document.querySelector('[name="esSecretario"]');
              if (chkSec) chkSec.checked = info.rol === "secretario";
              if (passHint) passHint.textContent = "(déjala vacía para no cambiarla)";
            }
            toggle();
          })
          .catch(() => { /* si falla, se deja sin marcar */ });
      }
    }
    document.getElementById("formSocio").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const nombre = (fd.get("nombre") || "").trim();
      if (!nombre) return UI.toast("El nombre es obligatorio.");
      const cedula = (fd.get("identificacion") || "").trim();

      // Rango: los cargos de directiva solo puede tenerlos un socio
      const rango = fd.get("rango") || "";
      const rangoErr = document.getElementById("rangoError");
      if (rangoErr) rangoErr.textContent = "";
      if (RANGOS_UNICOS.includes(rango)) {
        const otro = _cache.find(x => x.rango === rango && x.id !== (s ? s.id : null));
        if (otro) {
          if (rangoErr) rangoErr.textContent = `El cargo "${rango}" ya está asignado a ${otro.nombre}. Cámbiale el rango a esa persona primero.`;
          return;
        }
      }

      const quiereAcceso = fd.get("tieneAcceso") === "on";
      const esSecretario = fd.get("esSecretario") === "on";
      const accesoPass = fd.get("accesoPassword") || "";
      const accesoErr = document.getElementById("accesoError");
      if (accesoErr) accesoErr.textContent = "";

      // Validación: para dar acceso se requiere cédula
      if (quiereAcceso && !cedula) {
        if (accesoErr) accesoErr.textContent = "Para dar acceso, el socio debe tener cédula/identificación.";
        return;
      }

      const btnSubmit = e.target.querySelector("button[type=submit]");
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = "Guardando..."; }
      try {
        // Foto: se conserva la actual, se reemplaza por la nueva o se quita
        const socioId = fd.get("id") || DB._uid();
        const fotoAnterior = s ? s.fotoPath : "";
        let fotoPath = fotoAnterior;
        let fotoSubida = "";
        if (nuevaFoto) {
          fotoSubida = await DB.fotos.subir(socioId, nuevaFoto);
          fotoPath = fotoSubida;
        } else if (quitarFoto) {
          fotoPath = "";
        }

        let guardado;
        try {
          guardado = await DB.socios.guardar({
            id: socioId,
            nombre,
            identificacion: cedula,
            telefono: fd.get("telefono"),
            email: fd.get("email"),
            fechaNacimiento: fd.get("fechaNacimiento"),
            tipoSangre: fd.get("tipoSangre"),
            sectorResidencia: fd.get("sectorResidencia"),
            rango,
            fotoPath,
            activo: fd.get("activo") === "on",
            creado: s ? s.creado : undefined,
          });
        } catch (errGuardar) {
          // si no se pudo guardar el socio, no dejamos la foto subida huérfana
          if (fotoSubida) await DB.fotos.eliminar(fotoSubida).catch(() => {});
          throw errGuardar;
        }

        // borrar del bucket la foto anterior si fue reemplazada o quitada
        if (fotoAnterior && fotoAnterior !== fotoPath) {
          await DB.fotos.eliminar(fotoAnterior).catch((e) => console.warn("No se pudo borrar la foto anterior:", e));
        }

        // Gestión de acceso (solo si el admin usó esa sección)
        if (document.getElementById("chkAcceso")) {
          try {
            if (quiereAcceso) {
              await Auth.gestionarAcceso("guardar_acceso", {
                cedula,
                password: accesoPass || undefined,
                forzarCambio: fd.get("forzarCambio") === "on",
                rol: esSecretario ? "secretario" : "lectura",
                nombre,
                socioId: guardado.id,
              });
            } else if (cedula) {
              // si se desmarcó el acceso, quitar el usuario si existía
              await Auth.gestionarAcceso("quitar_acceso", { cedula });
            }
          } catch (accEx) {
            // el socio sí se guardó; informamos el problema de acceso
            UI.closeModal();
            UI.toast("Socio guardado, pero el acceso falló: " + (accEx.message || accEx));
            render();
            return;
          }
        }

        UI.closeModal();
        UI.toast(s ? "Socio actualizado." : "Socio agregado.");
        render();
      } catch (err) {
        console.error("Error al guardar socio:", err);
        if (accesoErr) accesoErr.textContent = "";
        // el índice único de la base también protege el cargo si otro admin lo asignó a la vez
        const msg = String(err.message || err);
        if (msg.includes("socios_rango_unico")) {
          if (rangoErr) rangoErr.textContent = "Ese cargo ya fue asignado a otro socio. Recarga la lista e inténtalo de nuevo.";
        } else {
          UI.toast("No se pudo guardar: " + msg);
        }
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = "Guardar"; }
      }
    });
  }

  async function eliminar(id) {
    const s = _cache.find(x => x.id === id);
    if (!confirm(`¿Eliminar al socio "${s ? s.nombre : ""}"? También se perderá su historial de asistencia.`)) return;
    try {
      // limpiar su historial de asistencia (además del ON DELETE CASCADE de la BD)
      const asis = await DB.asistencia.porSocio(id);
      await Promise.all(asis.map(a => DB.asistencia.eliminar(a.id)));
      await DB.socios.eliminar(id);
      if (s && s.fotoPath) {
        await DB.fotos.eliminar(s.fotoPath).catch((e) => console.warn("No se pudo borrar la foto:", e));
      }
      UI.toast("Socio eliminado.");
      render();
    } catch (err) {
      console.error("Error al eliminar socio:", err);
      UI.toast("No se pudo eliminar: " + (err.message || err));
    }
  }

  function init() {
    document.getElementById("btnNuevoSocio").addEventListener("click", () => abrirForm(null));
    document.getElementById("btnNuevoCopiloto").addEventListener("click", () =>
      Copilotos.abrirForm(null, _cache, "", render));
    document.getElementById("btnNuevaMoto").addEventListener("click", () =>
      Motos.abrirForm(null, _cache, "", render));
    document.getElementById("buscarSocio").addEventListener("input", (e) => paint(e.target.value));
  }

  return { init, render, avatarHtml, RANGOS, RANGOS_UNICOS };
})();
window.Socios = Socios;
