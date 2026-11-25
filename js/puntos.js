/**
 * puntos.js — Sistema de puntos por participación.
 *  - TIPOS: catálogo de tipos de evento de Rodadas (código guardado, nombres y concepto de puntos).
 *  - PARAMETROS / DEFECTO: parámetros del puntaje; el administrador los edita en el módulo "Puntaje".
 *  - cargar(): lee los parámetros guardados (o usa los valores por defecto).
 *  - calcular(): puntos por socio en un año, con desglose y detalle evento por evento.
 *
 * Reglas (acordadas con la directiva):
 *  - Solo cuentan eventos registrados, con fecha hasta hoy y con asistencia registrada.
 *  - Asambleas ordinarias y extraordinarias valen lo mismo.
 *  - Km: distancia registrada de la rodada (solo ida), hasta el máximo por evento.
 *  - Organizador: el socio encargado, si asistió (máximo uno por evento).
 *  - Socio que fue como acompañante: ese evento no le suma nada (tampoco cuenta para la
 *    asistencia perfecta).
 *  - Asistencia perfecta: considera asambleas y rodadas/eventos juntos. Mensual: por cada mes
 *    terminado con eventos y asistencia a todos. Anual: al terminar el año con asistencia a todos;
 *    en ese caso se otorga SOLO la anual (reemplaza a las mensuales).
 *  - Se calcula sobre el año completo para todos los socios activos.
 */
const Puntos = (() => {
  // ---------- Tipos de evento ----------
  const TIPOS = [
    { codigo: "Interna", nombre: "Rodada oficial interna", corto: "Interna", clave: "rodadaInterna",
      frase: "rodada oficial interna", titulo: "RODADA", badge: "badge-rol" },
    { codigo: "AniversarioCapitulo", nombre: "Aniversario de otro capítulo", corto: "Aniv. capítulo", clave: "aniversarioCapitulo",
      frase: "salida al aniversario de otro capítulo", titulo: "RODADA", badge: "badge-active", aniversario: true },
    { codigo: "AniversarioNacional", nombre: "Aniversario nacional", corto: "Aniv. nacional", clave: "aniversarioNacional",
      frase: "salida al aniversario nacional", titulo: "RODADA", badge: "badge-active", aniversario: true },
    { codigo: "AniversarioInternacional", nombre: "Aniversario internacional", corto: "Aniv. internacional", clave: "aniversarioInternacional",
      frase: "salida al aniversario internacional", titulo: "RODADA", badge: "badge-active", aniversario: true },
    { codigo: "Social", nombre: "Actividad social o benéfica", corto: "Social", clave: "social",
      frase: "actividad social o benéfica", titulo: "ACTIVIDAD", badge: "badge-social" },
  ];
  const CODIGOS = TIPOS.map(t => t.codigo);
  // "Aniversario" era el tipo anterior a este sistema: equivale a aniversario de otro capítulo
  const normalizarTipo = (c) => (c === "Aniversario" ? "AniversarioCapitulo" : CODIGOS.includes(c) ? c : "Interna");
  const tipo = (c) => TIPOS.find(t => t.codigo === normalizarTipo(c));

  // ---------- Parámetros ----------
  const PARAMETROS = [
    { clave: "asamblea", etiqueta: "Asistencia a reunión interna (asamblea)", grupo: "Eventos", sufijo: "pts" },
    { clave: "rodadaInterna", etiqueta: "Rodada oficial interna", grupo: "Eventos", sufijo: "pts" },
    { clave: "aniversarioCapitulo", etiqueta: "Aniversario de otro capítulo", grupo: "Eventos", sufijo: "pts" },
    { clave: "aniversarioNacional", etiqueta: "Aniversario nacional", grupo: "Eventos", sufijo: "pts" },
    { clave: "aniversarioInternacional", etiqueta: "Aniversario internacional", grupo: "Eventos", sufijo: "pts" },
    { clave: "social", etiqueta: "Actividad social o benéfica", grupo: "Eventos", sufijo: "pts" },
    { clave: "organizador", etiqueta: "Organizador de evento", grupo: "Eventos", sufijo: "pts" },
    { clave: "porKm", etiqueta: "Puntos por kilómetro recorrido", grupo: "Kilómetros", sufijo: "pts/km", paso: 0.01 },
    { clave: "maxKmEvento", etiqueta: "Máximo de km computables por evento", grupo: "Kilómetros", sufijo: "km", paso: 1 },
    { clave: "bonoMensual", etiqueta: "Bonificación por asistencia perfecta mensual", grupo: "Bonificaciones", sufijo: "pts" },
    { clave: "bonoAnual", etiqueta: "Bonificación por asistencia perfecta anual", grupo: "Bonificaciones", sufijo: "pts" },
  ];
  const DEFECTO = {
    asamblea: 15, rodadaInterna: 20, aniversarioCapitulo: 60, aniversarioNacional: 80,
    aniversarioInternacional: 100, social: 40, organizador: 30, porKm: 0.05, maxKmEvento: 1500,
    bonoMensual: 20, bonoAnual: 250,
  };

  // Deja solo claves conocidas con números válidos (>= 0); lo demás toma el valor por defecto
  function limpiar(v) {
    const out = { ...DEFECTO };
    PARAMETROS.forEach(({ clave }) => {
      const n = Number(v && v[clave]);
      if (v && v[clave] !== "" && v[clave] != null && Number.isFinite(n) && n >= 0) out[clave] = n;
    });
    return out;
  }

  let _config = { valores: { ...DEFECTO }, origen: "defecto", actualizado: null, actualizadoPor: "", disponible: false };

  // Lee los parámetros de la base. Si la tabla aún no existe, usa los valores por defecto.
  async function cargar() {
    try {
      const fila = await DB.puntos.obtener();
      _config = fila
        ? { valores: limpiar(fila.valores), origen: "base", actualizado: fila.actualizado, actualizadoPor: fila.actualizadoPor, disponible: true }
        : { valores: { ...DEFECTO }, origen: "defecto", actualizado: null, actualizadoPor: "", disponible: true };
    } catch (err) {
      console.warn("Parámetros de puntaje no disponibles; se usan los valores por defecto:", err);
      _config = { valores: { ...DEFECTO }, origen: "defecto", actualizado: null, actualizadoPor: "", disponible: false };
    }
    return _config;
  }
  const config = () => _config;

  // ---------- Cálculo ----------
  const r2 = (n) => Math.round(n * 100) / 100;
  const fmt = (n) => Number(n || 0).toLocaleString("es-EC", { maximumFractionDigits: 2 });

  function hoyLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  // primer día del mes siguiente (YYYY-MM-DD); un mes está "terminado" si ese día ya llegó
  const inicioMesSiguiente = (anio, mes) =>
    mes === 12 ? `${Number(anio) + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;

  /**
   * @returns {{ anio, valores, anioCerrado, eventos: {asambleas, rodadas, total}, filas: Array }}
   *  fila = { socio, pos, total, eventosAsistidos, asambleas:{n,pts}, internas, anivCapitulo,
   *           anivNacional, anivInternacional, sociales (cada uno {n,pts}), km:{km,pts},
   *           organizador:{n,pts}, mensual:{n,pts,meses[]}, anual:{pts,enCamino},
   *           acompanante:n, detalle:[{fecha, evento, concepto, puntos}] }
   */
  function calcular({ anio, socios, asambleas, asistencia, rodadas = [], rodadasAsis = [], valores = _config.valores, hoy = hoyLocal() }) {
    const v = limpiar(valores);
    anio = String(anio);
    const conAsisAsamblea = new Set(asistencia.map(x => x.asambleaId));
    const conAsisRodada = new Set(rodadasAsis.map(x => x.rodadaId));

    // eventos que cuentan: del año, ya realizados y con asistencia registrada
    const eventos = [
      ...asambleas
        .filter(a => (a.fecha || "").startsWith(anio) && a.fecha <= hoy && conAsisAsamblea.has(a.id))
        .map(a => ({ clase: "asamblea", id: a.id, fecha: a.fecha,
          nombre: `Asamblea ${a.extraordinaria ? "extraordinaria" : "ordinaria"}${a.mesCorrespondencia ? " · " + a.mesCorrespondencia : ""}` })),
      ...rodadas
        .filter(r => (r.fecha || "").startsWith(anio) && r.fecha <= hoy && conAsisRodada.has(r.id))
        .map(r => ({ clase: "rodada", id: r.id, fecha: r.fecha, rodada: r, tipo: tipo(r.tipo),
          nombre: `${tipo(r.tipo).nombre}${r.destino ? " · " + r.destino : ""}` })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha));

    const presAsamblea = new Set(asistencia.filter(x => x.presente).map(x => `${x.asambleaId}__${x.socioId}`));
    const asisRodada = new Map(rodadasAsis.map(x => [`${x.rodadaId}__${x.socioId}`, x]));
    const anioCerrado = `${anio}-12-31` < hoy;

    const filas = socios.filter(s => s.activo).map(s => {
      const f = {
        socio: s, total: 0, eventosAsistidos: 0, acompanante: 0,
        asambleas: { n: 0, pts: 0 }, internas: { n: 0, pts: 0 }, anivCapitulo: { n: 0, pts: 0 },
        anivNacional: { n: 0, pts: 0 }, anivInternacional: { n: 0, pts: 0 }, sociales: { n: 0, pts: 0 },
        km: { km: 0, pts: 0 }, organizador: { n: 0, pts: 0 },
        mensual: { n: 0, pts: 0, meses: [] }, anual: { pts: 0, enCamino: false }, detalle: [],
      };
      const sumar = (grupo, pts, fecha, evento, concepto) => {
        if (grupo) { grupo.n = (grupo.n || 0) + 1; grupo.pts = r2(grupo.pts + pts); }
        f.total = r2(f.total + pts);
        f.detalle.push({ fecha, evento, concepto, puntos: r2(pts) });
      };
      const asistio = new Set(); // eventos que cuentan como asistidos (para la asistencia perfecta)

      eventos.forEach(e => {
        if (e.clase === "asamblea") {
          if (!presAsamblea.has(`${e.id}__${s.id}`)) return;
          asistio.add(e.id);
          sumar(f.asambleas, v.asamblea, e.fecha, e.nombre, "Asistencia a asamblea");
          return;
        }
        const reg = asisRodada.get(`${e.id}__${s.id}`);
        if (!reg || !reg.presente) return;
        if (reg.acompanante) {
          f.acompanante++;
          f.detalle.push({ fecha: e.fecha, evento: e.nombre, concepto: "Fue como acompañante (no suma)", puntos: 0 });
          return;
        }
        asistio.add(e.id);
        const grupo = { rodadaInterna: f.internas, aniversarioCapitulo: f.anivCapitulo, aniversarioNacional: f.anivNacional,
          aniversarioInternacional: f.anivInternacional, social: f.sociales }[e.tipo.clave];
        sumar(grupo, v[e.tipo.clave], e.fecha, e.nombre, e.tipo.nombre);
        const km = Number(e.rodada.distanciaKm) || 0;
        if (km > 0) {
          const computables = Math.min(km, v.maxKmEvento);
          const pts = r2(computables * v.porKm);
          f.km.km = r2(f.km.km + computables);
          f.km.pts = r2(f.km.pts + pts);
          f.total = r2(f.total + pts);
          f.detalle.push({ fecha: e.fecha, evento: e.nombre,
            concepto: `Kilómetros: ${fmt(computables)} km${km > v.maxKmEvento ? ` (de ${fmt(km)}, máximo ${fmt(v.maxKmEvento)})` : ""}`, puntos: pts });
        }
        if (e.rodada.socioEncargadoId === s.id) {
          sumar(f.organizador, v.organizador, e.fecha, e.nombre, "Organizador del evento");
        }
      });
      f.eventosAsistidos = asistio.size;

      // asistencia perfecta
      const todosAnio = eventos.length > 0 && eventos.every(e => asistio.has(e.id));
      if (todosAnio && anioCerrado) {
        // año perfecto: solo la bonificación anual
        f.anual.pts = v.bonoAnual;
        f.total = r2(f.total + v.bonoAnual);
        f.detalle.push({ fecha: `${anio}-12-31`, evento: `Año ${anio}`, concepto: "Asistencia perfecta anual", puntos: v.bonoAnual });
      } else {
        f.anual.enCamino = todosAnio && !anioCerrado;
        for (let m = 1; m <= 12; m++) {
          if (inicioMesSiguiente(anio, m) > hoy) break;           // mes aún no terminado
          const delMes = eventos.filter(e => Number(e.fecha.slice(5, 7)) === m);
          if (!delMes.length || !delMes.every(e => asistio.has(e.id))) continue;
          f.mensual.n++; f.mensual.meses.push(m);
          f.mensual.pts = r2(f.mensual.pts + v.bonoMensual);
          f.total = r2(f.total + v.bonoMensual);
          const fin = new Date(Number(anio), m, 0).getDate();
          f.detalle.push({ fecha: `${anio}-${String(m).padStart(2, "0")}-${fin}`, evento: `${UI.MESES[m - 1]} ${anio}`,
            concepto: "Asistencia perfecta mensual", puntos: v.bonoMensual });
        }
      }
      f.detalle.sort((a, b) => a.fecha.localeCompare(b.fecha));
      return f;
    });

    // ranking: total; desempate por eventos asistidos, asambleas, km y nombre
    const cmp = (a, b) => b.total - a.total || b.eventosAsistidos - a.eventosAsistidos ||
      b.asambleas.n - a.asambleas.n || b.km.km - a.km.km;
    filas.sort((a, b) => cmp(a, b) || a.socio.nombre.localeCompare(b.socio.nombre));
    filas.forEach((f, i) => { f.pos = i > 0 && cmp(filas[i - 1], f) === 0 ? filas[i - 1].pos : i + 1; });

    return {
      anio, valores: v, anioCerrado,
      eventos: { asambleas: eventos.filter(e => e.clase === "asamblea").length, rodadas: eventos.filter(e => e.clase === "rodada").length, total: eventos.length },
      filas,
    };
  }

  return { TIPOS, CODIGOS, tipo, normalizarTipo, PARAMETROS, DEFECTO, limpiar, cargar, config, calcular, fmt };
})();
window.Puntos = Puntos;
