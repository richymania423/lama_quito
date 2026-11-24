/**
 * db.js — Capa de datos de LAMA QuitoConnect (Supabase)
 * -------------------------------------------------------------
 * Usa Supabase (PostgreSQL) como almacén en la nube. Mantiene el
 * MISMO contrato público (window.DB) que la versión IndexedDB, por
 * lo que el resto de la aplicación no cambia.
 *
 * Requiere:
 *   - El cliente supabase-js cargado en index.html (window.supabase).
 *   - js/config.js con window.APP_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY }.
 *
 * Mapeo de columnas (la interfaz usa camelCase; Postgres usa snake_case):
 *   socios.fechaNacimiento        <-> fecha_nacimiento
 *   asambleas.mesCorrespondencia  <-> mes_correspondencia
 *   asambleas.ordenDia (array)    <-> orden_dia (jsonb)
 *   asistencia.asambleaId         <-> asamblea_id
 *   asistencia.socioId            <-> socio_id
 *   *.creado                      <-> creado (timestamptz)
 */
const DB = (() => {
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error("[db.js] Falta el cliente supabase-js o js/config.js con las credenciales.");
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  function uid() {
    // id compatible con la versión anterior (texto); Postgres lo guarda como text
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  }

  function check(error) {
    if (error) throw new Error(error.message || "Error de Supabase");
  }

  // -------- Mapeos fila (DB) -> objeto (app) --------
  const socioDesde = (r) => ({
    id: r.id,
    nombre: r.nombre || "",
    identificacion: r.identificacion || "",
    telefono: r.telefono || "",
    email: r.email || "",
    fechaNacimiento: r.fecha_nacimiento || "",
    tipoSangre: r.tipo_sangre || "",
    sectorResidencia: r.sector_residencia || "",
    fotoPath: r.foto_path || "",
    rango: r.rango || "",
    activo: r.activo !== false,
    creado: r.creado,
  });
  const asambleaDesde = (r) => ({
    id: r.id,
    fecha: r.fecha || "",
    hora: r.hora || "",
    lugar: r.lugar || "",
    mesCorrespondencia: r.mes_correspondencia || "",
    ordenDia: Array.isArray(r.orden_dia) ? r.orden_dia : (r.orden_dia || []),
    temas: r.temas || "",
    extraordinaria: r.extraordinaria === true,   // false = Ordinaria (por defecto)
    creado: r.creado,
  });
  const asistenciaDesde = (r) => ({
    id: r.id,
    asambleaId: r.asamblea_id,
    socioId: r.socio_id,
    presente: !!r.presente,
    observacion: r.observacion || "",
  });

  // ====================== SOCIOS ======================
  const socios = {
    listar: async () => {
      const { data, error } = await sb.from("socios").select("*").order("nombre", { ascending: true });
      check(error);
      return (data || []).map(socioDesde);
    },
    obtener: async (id) => {
      const { data, error } = await sb.from("socios").select("*").eq("id", id).maybeSingle();
      check(error);
      return data ? socioDesde(data) : null;
    },
    guardar: async (d) => {
      const fila = {
        id: d.id || uid(),
        nombre: (d.nombre || "").trim(),
        identificacion: (d.identificacion || "").trim(),
        telefono: (d.telefono || "").trim(),
        email: (d.email || "").trim(),
        fecha_nacimiento: d.fechaNacimiento || null,
        tipo_sangre: d.tipoSangre || "",
        sector_residencia: (d.sectorResidencia || "").trim(),
        foto_path: d.fotoPath || null,
        rango: d.rango || null,
        activo: d.activo !== false,
        creado: d.creado || new Date().toISOString(),
      };
      const { data, error } = await sb.from("socios").upsert(fila).select().single();
      check(error);
      return socioDesde(data);
    },
    eliminar: async (id) => {
      const { error } = await sb.from("socios").delete().eq("id", id);
      check(error);
    },
  };

  // ====================== COPILOTOS ======================
  const copilotoDesde = (r) => ({
    id: r.id,
    nombre: r.nombre || "",
    parentesco: r.parentesco || "",
    tipoSangre: r.tipo_sangre || "",
    fechaNacimiento: r.fecha_nacimiento || "",
    socioId: r.socio_id || "",   // socio con quien tiene afinidad
    creado: r.creado,
  });

  const copilotos = {
    listar: async () => {
      const { data, error } = await sb.from("copilotos").select("*").order("nombre", { ascending: true });
      check(error);
      return (data || []).map(copilotoDesde);
    },
    guardar: async (d) => {
      const fila = {
        id: d.id || uid(),
        nombre: (d.nombre || "").trim(),
        parentesco: d.parentesco || null,
        tipo_sangre: d.tipoSangre || null,
        fecha_nacimiento: d.fechaNacimiento || null,
        socio_id: d.socioId || null,
        creado: d.creado || new Date().toISOString(),
      };
      const { data, error } = await sb.from("copilotos").upsert(fila).select().single();
      check(error);
      return copilotoDesde(data);
    },
    eliminar: async (id) => {
      const { error } = await sb.from("copilotos").delete().eq("id", id);
      check(error);
    },
  };

  // ====================== MOTOCICLETAS ======================
  const motoDesde = (r) => ({
    id: r.id,
    marca: r.marca || "",
    modelo: r.modelo || "",
    color: r.color || "",
    anio: r.anio == null ? "" : r.anio,
    cilindraje: r.cilindraje == null ? "" : r.cilindraje,
    placa: r.placa || "",
    socioId: r.socio_id || "",
    creado: r.creado,
  });

  const entOpc = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Math.trunc(Number(v)));

  const motos = {
    listar: async () => {
      const { data, error } = await sb.from("motos").select("*").order("marca", { ascending: true });
      check(error);
      return (data || []).map(motoDesde);
    },
    guardar: async (d) => {
      const fila = {
        id: d.id || uid(),
        marca: (d.marca || "").trim(),
        modelo: (d.modelo || "").trim() || null,
        color: (d.color || "").trim() || null,
        anio: entOpc(d.anio),
        cilindraje: entOpc(d.cilindraje),
        placa: (d.placa || "").trim().toUpperCase() || null,
        socio_id: d.socioId || null,
        creado: d.creado || new Date().toISOString(),
      };
      const { data, error } = await sb.from("motos").upsert(fila).select().single();
      check(error);
      return motoDesde(data);
    },
    eliminar: async (id) => {
      const { error } = await sb.from("motos").delete().eq("id", id);
      check(error);
    },
  };

  // ====================== DOCUMENTOS (tabla + Storage, bucket privado) ======================
  const BUCKET_DOCS = "documentos";

  const documentoDesde = (r) => ({
    id: r.id,
    titulo: r.titulo || "",
    descripcion: r.descripcion || "",
    categoria: r.categoria || "Otros",
    archivoPath: r.archivo_path || "",
    nombreArchivo: r.nombre_archivo || "",
    mime: r.mime || "",
    tamano: Number(r.tamano) || 0,
    subidoPor: r.subido_por || "",
    creado: r.creado,
  });

  // Quita tildes y caracteres que Storage no acepta en el nombre guardado
  const nombreSeguro = (nombre) =>
    String(nombre || "archivo")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "archivo";

  const documentos = {
    listar: async () => {
      const { data, error } = await sb.from("documentos").select("*").order("creado", { ascending: false });
      check(error);
      return (data || []).map(documentoDesde);
    },
    // Sube el archivo al bucket y devuelve su ruta
    subirArchivo: async (id, file, mime) => {
      const path = `${id}/${nombreSeguro(file.name)}`;
      const { error } = await sb.storage.from(BUCKET_DOCS)
        .upload(path, file, { contentType: mime, upsert: false });
      check(error);
      return path;
    },
    guardar: async (d) => {
      const fila = {
        id: d.id || uid(),
        titulo: (d.titulo || "").trim(),
        descripcion: (d.descripcion || "").trim() || null,
        categoria: d.categoria || "Otros",
        archivo_path: d.archivoPath,
        nombre_archivo: d.nombreArchivo || null,
        mime: d.mime || null,
        tamano: d.tamano || null,
        subido_por: d.subidoPor || null,
        creado: d.creado || new Date().toISOString(),
      };
      const { data, error } = await sb.from("documentos").upsert(fila).select().single();
      check(error);
      return documentoDesde(data);
    },
    eliminarArchivo: async (path) => {
      if (!path) return;
      const { error } = await sb.storage.from(BUCKET_DOCS).remove([path]);
      check(error);
    },
    eliminar: async (id) => {
      const { error } = await sb.from("documentos").delete().eq("id", id);
      check(error);
    },
    // URL firmada temporal (5 min). Con "descargar" el navegador baja el archivo con su nombre original.
    url: async (path, { descargar = false, nombre = "" } = {}) => {
      const opciones = descargar ? { download: nombre || true } : undefined;
      const { data, error } = await sb.storage.from(BUCKET_DOCS).createSignedUrl(path, 300, opciones);
      check(error);
      return data.signedUrl;
    },
  };

  // ====================== FOTOS (Storage, bucket privado) ======================
  const BUCKET_FOTOS = "fotos-socios";
  const fotos = {
    // Sube la imagen con un nombre único; devuelve la ruta para guardarla en el socio.
    subir: async (socioId, blob) => {
      const path = `${socioId}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from(BUCKET_FOTOS)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      check(error);
      return path;
    },
    eliminar: async (path) => {
      if (!path) return;
      const { error } = await sb.storage.from(BUCKET_FOTOS).remove([path]);
      check(error);
    },
    // Devuelve { ruta: urlFirmada } válidas por 1 hora.
    urls: async (paths) => {
      const lista = [...new Set((paths || []).filter(Boolean))];
      if (!lista.length) return {};
      const { data, error } = await sb.storage.from(BUCKET_FOTOS).createSignedUrls(lista, 3600);
      check(error);
      const mapa = {};
      (data || []).forEach((x) => { if (x.signedUrl) mapa[x.path] = x.signedUrl; });
      return mapa;
    },
  };

  // ====================== ASAMBLEAS ======================
  const asambleas = {
    listar: async () => {
      const { data, error } = await sb.from("asambleas").select("*").order("fecha", { ascending: false });
      check(error);
      return (data || []).map(asambleaDesde);
    },
    obtener: async (id) => {
      const { data, error } = await sb.from("asambleas").select("*").eq("id", id).maybeSingle();
      check(error);
      return data ? asambleaDesde(data) : null;
    },
    guardar: async (d) => {
      const fila = {
        id: d.id || uid(),
        fecha: d.fecha || null,
        hora: d.hora || null,
        lugar: (d.lugar || "").trim(),
        mes_correspondencia: d.mesCorrespondencia || "",
        orden_dia: Array.isArray(d.ordenDia) ? d.ordenDia : [],
        temas: d.temas || "",
        extraordinaria: d.extraordinaria === true,
        creado: d.creado || new Date().toISOString(),
      };
      let { data, error } = await sb.from("asambleas").upsert(fila).select().single();
      // Si aún no se ejecutó docs/supabase_asambleas_extraordinaria.sql, la columna no existe:
      // una asamblea Ordinaria se guarda igual; una Extraordinaria avisa qué falta.
      if (error && /extraordinaria/i.test(error.message || "")) {
        if (fila.extraordinaria) {
          throw new Error("Para guardar asambleas extraordinarias, ejecuta primero docs/supabase_asambleas_extraordinaria.sql en Supabase.");
        }
        delete fila.extraordinaria;
        ({ data, error } = await sb.from("asambleas").upsert(fila).select().single());
      }
      check(error);
      return asambleaDesde(data);
    },
    eliminar: async (id) => {
      // la FK con ON DELETE CASCADE borra la asistencia asociada en la BD
      const { error } = await sb.from("asambleas").delete().eq("id", id);
      check(error);
    },
  };

  // ====================== ASISTENCIA ======================
  const asistencia = {
    porAsamblea: async (asambleaId) => {
      const { data, error } = await sb.from("asistencia").select("*").eq("asamblea_id", asambleaId);
      check(error);
      return (data || []).map(asistenciaDesde);
    },
    porSocio: async (socioId) => {
      const { data, error } = await sb.from("asistencia").select("*").eq("socio_id", socioId);
      check(error);
      return (data || []).map(asistenciaDesde);
    },
    marcar: async ({ asambleaId, socioId, presente, observacion }) => {
      const fila = {
        id: `${asambleaId}__${socioId}`,
        asamblea_id: asambleaId,
        socio_id: socioId,
        presente: !!presente,
        observacion: observacion || "",
      };
      const { error } = await sb.from("asistencia").upsert(fila, { onConflict: "id" });
      check(error);
      return asistenciaDesde(fila);
    },
    eliminar: async (id) => {
      const { error } = await sb.from("asistencia").delete().eq("id", id);
      check(error);
    },
    todos: async () => {
      const { data, error } = await sb.from("asistencia").select("*");
      check(error);
      return (data || []).map(asistenciaDesde);
    },
  };

  // ====================== RESPALDO ======================
  async function exportar() {
    const [s, a, as] = await Promise.all([socios.listar(), asambleas.listar(), asistencia.todos()]);
    return { version: 2, exportado: new Date().toISOString(), socios: s, asambleas: a, asistencia: as };
  }

  async function importar(data) {
    if (!data || !Array.isArray(data.socios)) throw new Error("Archivo de respaldo inválido.");
    // inserta/actualiza respetando el mapeo de columnas
    for (const s of data.socios || []) await socios.guardar(s);
    for (const a of data.asambleas || []) await asambleas.guardar(a);
    for (const x of data.asistencia || []) {
      await asistencia.marcar({
        asambleaId: x.asambleaId, socioId: x.socioId,
        presente: x.presente, observacion: x.observacion,
      });
    }
  }

  async function borrarTodo() {
    // borra asistencia primero por la relación de claves foráneas
    await sb.from("asistencia").delete().neq("id", "");
    await sb.from("asambleas").delete().neq("id", "");
    await sb.from("socios").delete().neq("id", "");
  }

  return { socios, copilotos, motos, fotos, documentos, asambleas, asistencia, exportar, importar, borrarTodo, _uid: uid, _sb: sb };
})();

window.DB = DB;
