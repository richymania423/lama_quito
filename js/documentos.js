/**
 * documentos.js — Módulo "Documentación".
 * Todos los roles pueden ver y descargar documentos. Administrador y secretario
 * pueden subir, editar y eliminar (la base de datos también lo exige).
 * Los archivos viven en un bucket privado de Supabase y se abren con enlaces temporales.
 */
const Documentacion = (() => {
  const CATEGORIAS = ["Estatutos", "Reglamentos", "Actas", "Otros"];
  const MAX_MB = 10;
  const MAX_BYTES = MAX_MB * 1024 * 1024;

  // extensión -> tipo MIME aceptado por el bucket
  const TIPOS = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  };
  // formatos que el navegador puede mostrar sin descargarlos
  const VISIBLES = ["pdf", "txt", "jpg", "jpeg", "png", "webp"];

  let _docs = [];

  const esc = (s) => UI.esc(s);
  const extension = (nombre) => (String(nombre || "").split(".").pop() || "").toLowerCase();

  function icono(ext) {
    if (ext === "pdf") return "📕";
    if (ext === "doc" || ext === "docx") return "📘";
    if (ext === "xls" || ext === "xlsx") return "📗";
    if (ext === "ppt" || ext === "pptx") return "📙";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "🖼️";
    return "📄";
  }

  function tamanoLegible(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
    return bytes + " B";
  }

  function fecha(iso) {
    const x = new Date(iso);
    if (isNaN(x)) return "—";
    return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
  }

  async function render() {
    const btn = document.getElementById("btnNuevoDoc");
    if (btn) btn.style.display = UI.puede("documentacion") ? "" : "none";
    const tbody = document.querySelector("#tablaDocumentos tbody");
    tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:1.5rem">Cargando...</td></tr>`;
    try {
      _docs = await DB.documentos.listar();
      paint();
    } catch (err) {
      console.error("Error al cargar documentos:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--danger)">
        No se pudieron cargar los documentos: ${esc(err.message || String(err))}</td></tr>`;
    }
  }

  function paint() {
    const q = (document.getElementById("buscarDoc").value || "").trim().toLowerCase();
    const cat = document.getElementById("filtroCategoria").value;
    const puede = UI.puede("documentacion");
    const tbody = document.querySelector("#tablaDocumentos tbody");

    const filtrados = _docs.filter(d =>
      (!cat || d.categoria === cat) &&
      (!q || d.titulo.toLowerCase().includes(q) ||
        d.descripcion.toLowerCase().includes(q) ||
        d.nombreArchivo.toLowerCase().includes(q)));

    if (!filtrados.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:1.5rem">
        ${_docs.length ? "Sin resultados para la búsqueda." : "Aún no hay documentos."}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtrados.map(d => {
      const ext = extension(d.nombreArchivo || d.archivoPath);
      return `<tr>
        <td><span class="doc-titulo">${icono(ext)} <b>${esc(d.titulo)}</b>${d.descripcion ? `<small class="doc-desc">${esc(d.descripcion)}</small>` : ""}</span></td>
        <td><span class="badge badge-rol">${esc(d.categoria)}</span></td>
        <td>${esc(ext.toUpperCase())} · ${tamanoLegible(d.tamano)}</td>
        <td>${fecha(d.creado)}</td>
        <td class="row-actions">
          ${VISIBLES.includes(ext) ? `<button class="icon-btn" title="Ver" data-ver="${d.id}">👁️</button>` : ""}
          <button class="icon-btn" title="Descargar" data-desc="${d.id}">⬇️</button>
          ${puede ? `
            <button class="icon-btn" title="Editar" data-edit="${d.id}">✏️</button>
            <button class="icon-btn" title="Eliminar" data-del="${d.id}">🗑️</button>
          ` : ""}
        </td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-ver]").forEach(b => b.addEventListener("click", () => abrir(b.dataset.ver, "ver")));
    tbody.querySelectorAll("[data-desc]").forEach(b => b.addEventListener("click", () => abrir(b.dataset.desc, "descargar")));
    tbody.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    tbody.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => eliminar(b.dataset.del)));
  }

  // Abre el documento en otra pestaña ("ver") o lo descarga ("descargar")
  async function abrir(id, modo) {
    const d = _docs.find(x => x.id === id);
    if (!d) return;
    // la pestaña se abre antes del await para que el navegador no la bloquee
    const ventana = modo === "ver" ? window.open("", "_blank") : null;
    try {
      const url = await DB.documentos.url(d.archivoPath, {
        descargar: modo === "descargar",
        nombre: d.nombreArchivo,
      });
      if (ventana) {
        ventana.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        if (modo === "ver") a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      if (ventana) ventana.close();
      console.error("Error al abrir documento:", err);
      UI.toast("No se pudo abrir el documento: " + (err.message || err));
    }
  }

  function abrirForm(id) {
    const d = id ? _docs.find(x => x.id === id) : null;
    UI.openModal(d ? "Editar documento" : "Subir documento", `
      <form id="formDoc">
        <div class="form-field">
          <label>Título *</label>
          <input name="titulo" required maxlength="150" value="${d ? esc(d.titulo) : ""}" />
        </div>
        <div class="form-field">
          <label>Categoría *</label>
          <select name="categoria">
            ${CATEGORIAS.map(c => `<option value="${c}" ${d && d.categoria === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Descripción</label>
          <textarea name="descripcion" rows="3" maxlength="500">${d ? esc(d.descripcion) : ""}</textarea>
        </div>
        ${d ? `
          <p class="muted">Archivo: <b>${esc(d.nombreArchivo)}</b>. Para cambiar el archivo, elimina este documento y sube uno nuevo.</p>
        ` : `
          <div class="form-field">
            <label>Archivo * <span class="muted">(PDF, Word, Excel, PowerPoint, texto o imagen; máx. ${MAX_MB} MB)</span></label>
            <input type="file" name="archivo" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp" required />
          </div>
        `}
        <p class="login-error" id="docError"></p>
        <div class="btn-row">
          <button type="submit" class="btn">${d ? "Guardar" : "Subir"}</button>
          <button type="button" class="btn btn-outline" id="cancelDoc">Cancelar</button>
        </div>
      </form>`);

    document.getElementById("cancelDoc").addEventListener("click", UI.closeModal);
    document.getElementById("formDoc").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const err = document.getElementById("docError");
      err.textContent = "";
      const titulo = (fd.get("titulo") || "").trim();
      if (!titulo) { err.textContent = "El título es obligatorio."; return; }

      const btn = e.target.querySelector("button[type=submit]");
      const textoBtn = btn.textContent;
      btn.disabled = true;
      btn.textContent = d ? "Guardando..." : "Subiendo...";
      try {
        if (d) {
          // solo cambian los datos; el archivo se conserva
          await DB.documentos.guardar({
            ...d, titulo, categoria: fd.get("categoria"), descripcion: fd.get("descripcion"),
          });
        } else {
          const file = fd.get("archivo");
          if (!file || !file.name) throw new Error("Selecciona un archivo.");
          if (!file.size) throw new Error("El archivo está vacío.");
          const ext = extension(file.name);
          if (!TIPOS[ext]) throw new Error("Tipo de archivo no permitido. Usa PDF, Word, Excel, PowerPoint, texto o imagen.");
          if (file.size > MAX_BYTES) throw new Error(`El archivo supera el máximo de ${MAX_MB} MB.`);

          const nuevoId = DB._uid();
          const mime = TIPOS[ext];
          const ruta = await DB.documentos.subirArchivo(nuevoId, file, mime);
          try {
            await DB.documentos.guardar({
              id: nuevoId,
              titulo,
              categoria: fd.get("categoria"),
              descripcion: fd.get("descripcion"),
              archivoPath: ruta,
              nombreArchivo: file.name,
              mime,
              tamano: file.size,
              subidoPor: (Auth.usuario() && Auth.usuario().cedula) || "",
            });
          } catch (errGuardar) {
            // si no se pudo registrar, no dejamos el archivo huérfano en el bucket
            await DB.documentos.eliminarArchivo(ruta).catch(() => {});
            throw errGuardar;
          }
        }
        UI.closeModal();
        UI.toast(d ? "Documento actualizado." : "Documento subido.");
        render();
      } catch (ex) {
        console.error("Error al guardar documento:", ex);
        err.textContent = ex.message || String(ex);
        btn.disabled = false;
        btn.textContent = textoBtn;
      }
    });
  }

  async function eliminar(id) {
    const d = _docs.find(x => x.id === id);
    if (!d) return;
    if (!confirm(`¿Eliminar el documento "${d.titulo}"? Los socios dejarán de poder verlo.`)) return;
    try {
      await DB.documentos.eliminar(id);
      await DB.documentos.eliminarArchivo(d.archivoPath)
        .catch((e) => console.warn("No se pudo borrar el archivo del bucket:", e));
      UI.toast("Documento eliminado.");
      render();
    } catch (err) {
      console.error("Error al eliminar documento:", err);
      UI.toast("No se pudo eliminar: " + (err.message || err));
    }
  }

  function init() {
    const sel = document.getElementById("filtroCategoria");
    sel.innerHTML = `<option value="">Todas las categorías</option>` +
      CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join("");
    sel.addEventListener("change", paint);
    document.getElementById("buscarDoc").addEventListener("input", paint);
    document.getElementById("btnNuevoDoc").addEventListener("click", () => abrirForm(null));
  }

  return { init, render };
})();
window.Documentacion = Documentacion;
