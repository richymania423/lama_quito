/**
 * db.js — Capa de datos de Secretario LAMA (Supabase)
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
        creado: d.creado || new Date().toISOString(),
      };
      const { data, error } = await sb.from("asambleas").upsert(fila).select().single();
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

  return { socios, asambleas, asistencia, exportar, importar, borrarTodo, _uid: uid, _sb: sb };
})();

window.DB = DB;
