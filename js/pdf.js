/**
 * pdf.js — Generación de documentos PDF con jsPDF + autotable.
 *  - actaAsamblea(data): acta con datos, orden del día, temas y listado de asistentes.
 *  - cuadroAnual(data):  cuadro de asistencias de socios durante el año.
 */
const PDF = (() => {
  const AZUL = [31, 95, 168];
  const GRIS = [107, 122, 141];
  const LOGO_SRC = "images/logo_lama_quito.png";
  let _logoDataUrl = null; // dataURL del logo, precargado
  let _logoRatio = 1;      // ancho / alto del logo

  // Precarga el logo y lo convierte a dataURL (para incrustarlo en el PDF)
  function precargarLogo() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        _logoDataUrl = canvas.toDataURL("image/png");
        _logoRatio = img.naturalWidth / img.naturalHeight;
      } catch (e) { _logoDataUrl = null; }
    };
    img.src = LOGO_SRC;
  }

  function nuevoDoc(orientation = "p") {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ orientation, unit: "mm", format: "a4" });
  }

  function encabezado(doc, titulo, subtitulo) {
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, w, 22, "F");
    // Logo a la derecha, si está disponible
    if (_logoDataUrl) {
      try { doc.addImage(_logoDataUrl, "PNG", w - 32, 3, 16, 16); } catch (e) { /* ignora */ }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(titulo, 14, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (subtitulo) doc.text(subtitulo, 14, 17);
    doc.setTextColor(34, 48, 60);
  }

  function pie(doc) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...GRIS);
      doc.text(`Generado el ${new Date().toLocaleString("es-EC")}`, 14, h - 8);
      doc.text(`Página ${i} de ${total}`, w - 14, h - 8, { align: "right" });
    }
  }

  // ====================== ACTA DE ASAMBLEA ======================
  function actaAsamblea(data) {
    if (!window.jspdf) return UI.toast("Cargando librería PDF, intenta de nuevo en un momento.");
    const { asamblea: a, presentes, ausentes, socios, asis } = data;
    const doc = nuevoDoc("p");

    encabezado(doc, "Acta de Asamblea", "L.A.M.A. Capítulo Quito · Documento oficial del grupo");
    let y = 30;

    // --- Datos de la asamblea ---
    doc.autoTable({
      startY: y,
      theme: "plain",
      body: [
        ["Fecha:", UI.fmtFecha(a.fecha), "Hora:", a.hora || "—"],
        ["Lugar:", a.lugar || "—", "Mes correspondencia:", a.mesCorrespondencia || "—"],
      ],
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 25 },
        2: { fontStyle: "bold", cellWidth: 40 },
      },
    });
    y = doc.lastAutoTable.finalY + 6;

    // --- Orden del día ---
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Orden del día", 14, y); y += 2;
    const puntos = (a.ordenDia && a.ordenDia.length)
      ? a.ordenDia.map((p, i) => [`${i + 1}.`, p])
      : [["—", "No se registraron puntos."]];
    doc.autoTable({
      startY: y + 2,
      theme: "striped",
      head: [["#", "Punto"]],
      body: puntos,
      headStyles: { fillColor: AZUL },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 12 } },
    });
    y = doc.lastAutoTable.finalY + 6;

    // --- Temas tratados ---
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Temas principales tratados", 14, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const texto = (a.temas && a.temas.trim()) ? a.temas.trim() : "No se registró un resumen de temas.";
    const lineas = doc.splitTextToSize(texto, doc.internal.pageSize.getWidth() - 28);
    doc.text(lineas, 14, y);
    y += lineas.length * 5 + 6;

    // --- Resumen de asistencia ---
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Resumen de asistencia", 14, y); y += 2;
    const total = socios.length;
    const pct = total ? Math.round((presentes.length / total) * 100) : 0;
    doc.autoTable({
      startY: y + 2,
      theme: "plain",
      body: [[
        `Presentes: ${presentes.length}`,
        `Ausentes: ${ausentes.length}`,
        `Total socios activos: ${total}`,
        `Asistencia: ${pct}%`,
      ]],
      styles: { fontSize: 10, cellPadding: 1.5, fontStyle: "bold" },
    });
    y = doc.lastAutoTable.finalY + 4;

    // --- Listado de asistentes (presentes) ---
    doc.autoTable({
      startY: y,
      head: [["#", "Socio presente", "Observación"]],
      body: presentes.length
        ? presentes.map((s, i) => [i + 1, s.nombre,
            (asis[s.id] && asis[s.id].observacion) || ""])
        : [["—", "Sin asistentes registrados", ""]],
      headStyles: { fillColor: AZUL },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 12 } },
    });
    y = doc.lastAutoTable.finalY + 4;

    // --- Ausentes ---
    if (ausentes.length) {
      doc.autoTable({
        startY: y,
        head: [["#", "Socio ausente", "Observación"]],
        body: ausentes.map((s, i) => [i + 1, s.nombre, (asis[s.id] && asis[s.id].observacion) || ""]),
        headStyles: { fillColor: GRIS },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 12 } },
      });
      y = doc.lastAutoTable.finalY + 10;
    } else {
      y += 6;
    }

    // --- Firmas ---
    const w = doc.internal.pageSize.getWidth();
    if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 30; }
    // Una sola firma, centrada
    doc.setDrawColor(...GRIS);
    doc.line(w / 2 - 40, y + 12, w / 2 + 40, y + 12);
    doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text("Directiva LAMA Quito", w / 2, y + 18, { align: "center" });

    pie(doc);
    const nombre = `acta-asamblea-${a.fecha || "sinfecha"}.pdf`;
    doc.save(nombre);
    UI.toast("PDF del acta generado.");
  }

  // ====================== CUADRO ANUAL ======================
  const VERDE = [46, 158, 107];
  const AMBAR = [224, 165, 38];
  const ROJO = [192, 57, 43];
  const colorPorcentaje = (pct) => (pct >= 80 ? VERDE : pct >= 50 ? AMBAR : ROJO);

  // PDF "Indicadores de Participación": resumen, ranking (con % por socio), más activos,
  // inasistencias recurrentes y el detalle por asamblea.
  function cuadroAnual({
    anio, socios, asambleas, matriz, porcentajes,
    consideradas = [], total = 0, totalAnio = 0, indicadores = null, umbral = 3,
  }) {
    if (!window.jspdf) return UI.toast("Cargando librería PDF, intenta de nuevo en un momento.");
    const doc = nuevoDoc("l");
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 14; // margen lateral
    const corto = (fecha) => UI.fmtFecha(fecha).slice(0, 5); // dd/mm
    const idsConsideradas = new Set(consideradas);

    encabezado(doc, `Indicadores de Participación ${anio}`, "L.A.M.A. Capítulo Quito · Asistencia de socios a asambleas");
    let y = 30;

    // Título de sección (salta de página si queda poco espacio)
    const seccion = (titulo, nota) => {
      if (y > H - 45) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...AZUL);
      doc.text(titulo, M, y);
      y += 5;
      if (nota) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
        doc.text(nota, M, y);
        y += 3;
      }
    };
    const despuesDeTabla = () => { y = doc.lastAutoTable.finalY + 9; };
    const parrafo = (txt) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(34, 48, 60);
      const lineas = doc.splitTextToSize(txt, W - 2 * M);
      doc.text(lineas, M, y + 3);
      y += 6 + lineas.length * 5;
    };
    const estilos = {
      headStyles: { fillColor: AZUL, fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      margin: { left: M, right: M },
    };

    if (indicadores) {
      const plural = total === 1 ? "" : "s";
      const nota = `Sobre ${total} asamblea${plural} realizada${plural} con asistencia registrada (de ${totalAnio} del año). Solo socios activos.`;

      // --- Tarjetas resumen ---
      const tarjetas = [
        [String(total), "Asambleas con asistencia"],
        [`${indicadores.promedio}%`, "Asistencia promedio"],
        [String(indicadores.perfectos), "Socios con 100% de asistencia"],
        [String(indicadores.recurrentes.length), `Con ${umbral} o más inasistencias`],
      ];
      const gap = 6;
      const ancho = (W - 2 * M - 3 * gap) / 4;
      const alto = 20;
      tarjetas.forEach(([valor, etiqueta], i) => {
        const x = M + i * (ancho + gap);
        doc.setFillColor(238, 243, 251); doc.setDrawColor(225, 231, 239);
        doc.roundedRect(x, y, ancho, alto, 2, 2, "FD");
        doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...AZUL);
        doc.text(valor, x + 5, y + 10);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
        doc.text(etiqueta, x + 5, y + 16);
      });
      y += alto + 10;

      // --- Ranking de participación y % de asistencia por socio ---
      seccion("Ranking de participación y % de asistencia por socio", nota);
      doc.autoTable({
        ...estilos,
        startY: y + 1,
        head: [["Pos.", "Socio", "Asistencias", "% de asistencia", "Participación"]],
        body: indicadores.ranking.map(f => [f.pos, f.socio.nombre, `${f.asist} de ${total}`, `${f.pct}%`, ""]),
        columnStyles: {
          0: { cellWidth: 16, halign: "center" },
          2: { cellWidth: 32, halign: "center" },
          3: { cellWidth: 34, halign: "center" },
          4: { cellWidth: 70 },
        },
        didParseCell: (d) => {
          if (d.section === "body" && indicadores.ranking[d.row.index].pos <= 3) d.cell.styles.fontStyle = "bold";
        },
        didDrawCell: (d) => {
          if (d.section !== "body" || d.column.index !== 4) return;
          const f = indicadores.ranking[d.row.index];
          const bx = d.cell.x + 2;
          const bw = d.cell.width - 4;
          const bh = 3;
          const by = d.cell.y + (d.cell.height - bh) / 2;
          doc.setFillColor(232, 237, 245); doc.rect(bx, by, bw, bh, "F");
          if (f.pct > 0) { doc.setFillColor(...colorPorcentaje(f.pct)); doc.rect(bx, by, (bw * f.pct) / 100, bh, "F"); }
        },
      });
      despuesDeTabla();

      // --- Miembros más activos ---
      seccion("Miembros más activos", `Los ${indicadores.activos.length} socios con más asistencias del año.`);
      if (indicadores.activos.length) {
        doc.autoTable({
          ...estilos,
          startY: y + 1,
          head: [["#", "Socio", "Asistencias", "% de asistencia"]],
          body: indicadores.activos.map((f, i) => [i + 1, f.socio.nombre, `${f.asist} de ${total}`, `${f.pct}%`]),
          columnStyles: {
            0: { cellWidth: 16, halign: "center" },
            2: { cellWidth: 32, halign: "center" },
            3: { cellWidth: 34, halign: "center" },
          },
        });
        const fin = doc.lastAutoTable.finalY;
        if (indicadores.empatados) {
          const n = indicadores.empatados;
          doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
          doc.text(`y ${n} socio${n === 1 ? "" : "s"} más con la misma asistencia.`, M, fin + 5);
          y = fin + 14;
        } else {
          y = fin + 9;
        }
      } else {
        parrafo("Aún no hay asistencias registradas.");
      }

      // --- Inasistencias recurrentes ---
      seccion("Inasistencias recurrentes", `Socios con ${umbral} o más inasistencias en el año.`);
      if (indicadores.recurrentes.length) {
        doc.autoTable({
          ...estilos,
          startY: y + 1,
          head: [["Socio", "Inasistencias", "Fechas en que faltó"]],
          body: indicadores.recurrentes.map(f => [f.socio.nombre, String(f.inasist), f.faltas.map(a => corto(a.fecha)).join(", ")]),
          headStyles: { fillColor: ROJO, fontSize: 8.5 },
          columnStyles: { 1: { cellWidth: 32, halign: "center" } },
        });
        despuesDeTabla();
      } else {
        parrafo(`Ningún socio activo tiene ${umbral} o más inasistencias.`);
      }
    } else {
      seccion("Indicadores de participación");
      parrafo(`Todavía no hay asambleas realizadas con asistencia registrada en ${anio}; los indicadores se calcularán cuando se registre la primera.`);
    }

    // --- Detalle por asamblea ---
    seccion("Detalle por asamblea", "X = asistió   |   · = no asistió   |   - = asamblea sin asistencia registrada");
    const head = [["Socio", ...asambleas.map(a => corto(a.fecha)), "%"]];
    const body = socios.map(s => [
      s.nombre,
      ...asambleas.map(a => (!idsConsideradas.has(a.id) ? "-" : (matriz[s.id] && matriz[s.id][a.id] ? "X" : "·"))),
      total ? porcentajes[s.id] + "%" : "-",
    ]);
    doc.autoTable({
      startY: y + 1,
      head,
      body,
      headStyles: { fillColor: AZUL, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.5, halign: "center" },
      columnStyles: { 0: { halign: "left", cellWidth: 55 } },
      margin: { left: M, right: M },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index > 0 && d.cell.raw === "-") d.cell.styles.textColor = [181, 188, 200];
      },
    });

    pie(doc);
    doc.save("Indicadores de Participación.pdf");
    UI.toast("PDF de indicadores generado.");
  }

  // Precargar el logo en cuanto cargue el documento
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", precargarLogo);
  } else {
    precargarLogo();
  }

  // ====================== CONVOCATORIA DE ASAMBLEA ======================
  const NAVY = [27, 42, 73];
  const ORO = [176, 141, 60];
  const TEXTO = [38, 44, 58];
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const FUENTE_TITULO = {
    archivo: "CinzelDecorative-Bold.ttf",
    nombre: "CinzelDecorative",
    url: "fonts/CinzelDecorative-Bold.ttf",
  };
  let _fuenteB64 = null; // la fuente se descarga una sola vez

  // Registra la fuente del título en el documento. Devuelve su nombre, o null si falla.
  async function cargarFuenteTitulo(doc) {
    try {
      if (!_fuenteB64) {
        const resp = await fetch(FUENTE_TITULO.url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const bytes = new Uint8Array(await resp.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        _fuenteB64 = btoa(bin);
      }
      doc.addFileToVFS(FUENTE_TITULO.archivo, _fuenteB64);
      doc.addFont(FUENTE_TITULO.archivo, FUENTE_TITULO.nombre, "bold");
      return FUENTE_TITULO.nombre;
    } catch (e) {
      console.warn("No se pudo cargar la fuente del título; se usa Times:", e);
      return null;
    }
  }

  // "Octubre de 2026". Si el mes de correspondencia cae en otro año (p. ej. asamblea de
  // enero que corresponde a diciembre) se ajusta el año.
  function mesYAnio(a) {
    const [y, m] = (a.fecha || "").split("-").map(Number);
    let mesIdx = UI.MESES.indexOf(a.mesCorrespondencia);
    let anio = y || 0;
    if (mesIdx < 0) {
      mesIdx = m ? m - 1 : 0;
    } else if (m) {
      if (mesIdx - (m - 1) > 6) anio = y - 1;
      else if ((m - 1) - mesIdx > 6) anio = y + 1;
    }
    return anio ? `${UI.MESES[mesIdx]} de ${anio}` : UI.MESES[mesIdx];
  }

  // "lunes 27 de octubre de 2026 a las 19:00 horas"
  function fechaHoraLarga(a) {
    if (!a.fecha) return "fecha por definir";
    const [y, m, d] = a.fecha.split("-").map(Number);
    const dia = DIAS[new Date(y, m - 1, d).getDay()];
    let txt = `${dia} ${d} de ${UI.MESES[m - 1].toLowerCase()} de ${y}`;
    if (a.hora) txt += ` a las ${a.hora} horas`;
    return txt;
  }

  function marco(doc) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.9); doc.rect(8, 8, w - 16, h - 16);
    doc.setDrawColor(...ORO); doc.setLineWidth(0.35); doc.rect(10.5, 10.5, w - 21, h - 21);
  }

  // Párrafo justificado con partes en negrita. Mantiene unida la puntuación a la palabra
  // anterior aunque cambie el estilo (p. ej. "<b>2026</b>.").
  function parrafoRico(doc, partes, x, y, ancho, lh, fuente, tam) {
    const unidades = [];
    let prevEsp = true;
    partes.forEach(p => {
      const empieza = /^\s/.test(p.t);
      const termina = /\s$/.test(p.t);
      const palabras = p.t.split(/\s+/).filter(Boolean);
      palabras.forEach((w, i) => {
        const unir = i === 0 && !empieza && !prevEsp && unidades.length > 0;
        if (unir) unidades[unidades.length - 1].push({ txt: w, b: !!p.b });
        else unidades.push([{ txt: w, b: !!p.b }]);
      });
      prevEsp = palabras.length ? termina : (prevEsp || p.t.length > 0);
    });

    doc.setFontSize(tam);
    doc.setFont(fuente, "normal");
    const espacio = doc.getTextWidth(" ");
    unidades.forEach(u => {
      u.ancho = 0;
      u.forEach(seg => {
        doc.setFont(fuente, seg.b ? "bold" : "normal");
        seg.w = doc.getTextWidth(seg.txt);
        u.ancho += seg.w;
      });
    });

    const lineas = [];
    let actual = [];
    let suma = 0;
    unidades.forEach(u => {
      if (actual.length && suma + u.ancho + actual.length * espacio > ancho) {
        lineas.push(actual); actual = []; suma = 0;
      }
      actual.push(u); suma += u.ancho;
    });
    if (actual.length) lineas.push(actual);

    lineas.forEach((ln, i) => {
      const ultima = i === lineas.length - 1;
      const huecos = ln.length - 1;
      const total = ln.reduce((s, u) => s + u.ancho, 0);
      const sp = (!ultima && huecos > 0) ? (ancho - total) / huecos : espacio;
      let cx = x;
      ln.forEach(u => {
        u.forEach(seg => {
          doc.setFont(fuente, seg.b ? "bold" : "normal");
          doc.text(seg.txt, cx, y);
          cx += seg.w;
        });
        cx += sp;
      });
      y += lh;
    });
    return y;
  }

  async function convocatoria(a) {
    if (!window.jspdf) return UI.toast("Cargando librería PDF, intenta de nuevo en un momento.");
    const doc = nuevoDoc("p");
    const fTitulo = await cargarFuenteTitulo(doc);
    const fuenteTitulo = (tam) => {
      doc.setFont(fTitulo || "times", "bold");
      doc.setFontSize(tam);
    };

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const MX = 26;
    const ANCHO = W - 2 * MX;
    const FS = "times", TAM = 12, LH = 7;
    const nuevaPagina = () => { doc.addPage(); marco(doc); };

    marco(doc);

    // --- Logo centrado ---
    let y = 20;
    if (_logoDataUrl) {
      const alto = 30;
      const ancho = alto * _logoRatio;
      try { doc.addImage(_logoDataUrl, "PNG", (W - ancho) / 2, y, ancho, alto); } catch (e) { /* sin logo */ }
      y += alto + 6;
    } else {
      y += 8;
    }

    // --- Ornamento dorado ---
    doc.setDrawColor(...ORO); doc.setLineWidth(0.5);
    doc.line(W / 2 - 45, y, W / 2 - 4, y);
    doc.line(W / 2 + 4, y, W / 2 + 45, y);
    doc.setFillColor(...ORO);
    doc.triangle(W / 2, y - 2, W / 2 + 2, y, W / 2, y + 2, "F");
    doc.triangle(W / 2, y - 2, W / 2 - 2, y, W / 2, y + 2, "F");
    y += 12;

    // --- Título ---
    fuenteTitulo(30);
    doc.setTextColor(...NAVY);
    doc.text("CONVOCATORIA", W / 2, y, { align: "center" });
    y += 9;
    doc.setFont("times", "italic"); doc.setFontSize(14); doc.setTextColor(...ORO);
    doc.text("Sesión Ordinaria de Asamblea", W / 2, y, { align: "center" });
    y += 14;

    // --- Texto de la convocatoria ---
    doc.setTextColor(...TEXTO);
    y = parrafoRico(doc, [
      { t: "Con un cordial saludo y por medio de la presente, la directiva actual se permite " },
      { t: "CONVOCAR", b: true },
      { t: " a los miembros del capítulo de LAMA Quito a la sesión ordinaria de Asamblea del mes de " },
      { t: mesYAnio(a), b: true },
      { t: ". La misma que tendrá lugar en " },
      { t: a.lugar || "lugar por definir", b: true },
      { t: ", el día " },
      { t: fechaHoraLarga(a), b: true },
      { t: "." },
    ], MX, y, ANCHO, LH, FS, TAM);

    y += 5;
    doc.setFont(FS, "normal"); doc.setFontSize(TAM);
    doc.text("El orden del día propuesto para esta sesión es el siguiente:", MX, y);
    y += LH + 1;

    // --- Orden del día ---
    const items = (a.ordenDia && a.ordenDia.length) ? a.ordenDia : ["Por definir"];
    const SANGRIA = 9;
    const LI = 6.2;
    items.forEach((it, i) => {
      doc.setFont(FS, "normal"); doc.setFontSize(TAM);
      const lineas = doc.splitTextToSize(String(it), ANCHO - SANGRIA - 4);
      if (y + lineas.length * LI > H - 24) { nuevaPagina(); y = 26; }
      doc.setFont(FS, "bold"); doc.setTextColor(...ORO);
      doc.text(`${i + 1}.`, MX + 2, y);
      doc.setFont(FS, "normal"); doc.setTextColor(...TEXTO);
      lineas.forEach((l, j) => doc.text(l, MX + SANGRIA, y + j * LI));
      y += lineas.length * LI + 1.5;
    });

    // --- Nota ---
    y += 6;
    if (y > H - 84) { nuevaPagina(); y = 26; }
    doc.setTextColor(...TEXTO);
    y = parrafoRico(doc, [
      { t: "NOTA:", b: true },
      { t: " El sargento de armas estará vigilando el correcto uso del uniforme (zapatos negro, jean azul, buzo negro y chaleco)." },
    ], MX, y, ANCHO, LH, FS, TAM);

    // --- Firma ---
    y += 10;
    if (y > H - 55) { nuevaPagina(); y = 30; }
    doc.setFont(FS, "normal"); doc.setFontSize(TAM); doc.setTextColor(...TEXTO);
    doc.text("Atentamente,", MX, y);
    y += 16;
    doc.setDrawColor(...ORO); doc.setLineWidth(0.4);
    doc.line(MX, y - 7, MX + 52, y - 7);
    fuenteTitulo(16);
    doc.setTextColor(...NAVY);
    doc.text("Directiva", MX, y);
    y += 7;
    doc.setFont(FS, "bold"); doc.setFontSize(12); doc.setTextColor(...ORO);
    doc.text("LAMA Quito", MX, y);

    doc.save(`convocatoria-asamblea-${a.fecha || "sinfecha"}.pdf`);
    UI.toast("Convocatoria generada.");
  }

  return { actaAsamblea, cuadroAnual, convocatoria };
})();
window.PDF = PDF;
