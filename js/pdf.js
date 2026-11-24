/**
 * pdf.js — Generación de documentos PDF con jsPDF + autotable.
 *  - actaAsamblea(data): acta con el mismo estilo de la convocatoria (marco, logo, Cinzel).
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
  // Mismo estilo que la convocatoria: marco doble azul/dorado, logo centrado, ornamento,
  // título en Cinzel Decorative, textos en Times y acentos dorados.
  async function actaAsamblea(data) {
    if (!window.jspdf) return UI.toast("Cargando librería PDF, intenta de nuevo en un momento.");
    const { asamblea: a, presentes, ausentes, socios, asis } = data;
    const doc = nuevoDoc("p");
    const fTitulo = await cargarFuenteTitulo(doc);
    const fuenteTitulo = (tam) => { doc.setFont(fTitulo || "times", "bold"); doc.setFontSize(tam); };

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const MX = 22;                       // margen interior (dentro del marco)
    const ANCHO = W - 2 * MX;
    const FS = "times", TAM = 11.5, LH = 6.4;
    const ARRIBA = 22, ABAJO = 24;       // zona útil en páginas siguientes
    const CREMA = [250, 246, 236];
    const tipo = a.extraordinaria ? "Extraordinaria" : "Ordinaria";
    const obs = (s) => (asis[s.id] && asis[s.id].observacion) || "";

    const nuevaPagina = () => { doc.addPage(); marco(doc); return ARRIBA + 4; };
    const asegurar = (y, alto) => (y + alto > H - ABAJO ? nuevaPagina() : y);

    // Título de sección: azul, con línea dorada debajo
    const seccion = (y, texto) => {
      y = asegurar(y, 22);
      doc.setFont(FS, "bold"); doc.setFontSize(13.5); doc.setTextColor(...NAVY);
      doc.text(texto, MX, y);
      doc.setDrawColor(...ORO); doc.setLineWidth(0.45);
      doc.line(MX, y + 1.8, MX + ANCHO, y + 1.8);
      doc.setTextColor(...TEXTO);
      return y + 8;
    };

    // Estilo común de tablas (Times, cabecera de color, filas alternas color crema)
    const tabla = (y, cabecera, filas, colorCab) => {
      y = asegurar(y, 30);   // evita dejar la cabecera sola al pie de la página
      doc.autoTable({
        startY: y,
        head: [cabecera],
        body: filas,
        theme: "grid",
        margin: { left: MX, right: MX, top: ARRIBA + 4, bottom: ABAJO },
        styles: { font: FS, fontSize: 10.5, cellPadding: 2.2, textColor: TEXTO, lineColor: [226, 214, 182], lineWidth: 0.2 },
        headStyles: { fillColor: colorCab, textColor: [255, 255, 255], fontStyle: "bold", lineColor: colorCab },
        alternateRowStyles: { fillColor: CREMA },
        columnStyles: { 0: { cellWidth: 12, halign: "center", textColor: ORO, fontStyle: "bold" } },
        // las páginas que agrega la tabla también llevan el marco
        didDrawPage: (d) => { if (d.pageNumber > 1) marco(doc); },
      });
      return doc.lastAutoTable.finalY + 8;
    };

    marco(doc);

    // --- Logo centrado ---
    let y = 18;
    if (_logoDataUrl) {
      const alto = 26, ancho = alto * _logoRatio;
      try { doc.addImage(_logoDataUrl, "PNG", (W - ancho) / 2, y, ancho, alto); } catch (e) { /* sin logo */ }
      y += alto + 5;
    } else {
      y += 6;
    }

    // --- Ornamento dorado ---
    doc.setDrawColor(...ORO); doc.setLineWidth(0.5);
    doc.line(W / 2 - 45, y, W / 2 - 4, y);
    doc.line(W / 2 + 4, y, W / 2 + 45, y);
    doc.setFillColor(...ORO);
    doc.triangle(W / 2, y - 2, W / 2 + 2, y, W / 2, y + 2, "F");
    doc.triangle(W / 2, y - 2, W / 2 - 2, y, W / 2, y + 2, "F");
    y += 11;

    // --- Título ---
    fuenteTitulo(30);
    doc.setTextColor(...NAVY);
    doc.text("ACTA", W / 2, y, { align: "center" });
    y += 8;
    doc.setFont("times", "italic"); doc.setFontSize(14); doc.setTextColor(...ORO);
    doc.text(`Asamblea ${tipo}`, W / 2, y, { align: "center" });
    y += 5.5;
    doc.setFont("times", "normal"); doc.setFontSize(9.5); doc.setTextColor(...GRIS);
    doc.text("L.A.M.A. Capítulo Quito · Documento oficial del grupo", W / 2, y, { align: "center" });
    y += 11;

    // --- Párrafo de apertura ---
    const total = socios.length;
    const pct = total ? Math.round((presentes.length / total) * 100) : 0;
    doc.setTextColor(...TEXTO);
    y = parrafoRico(doc, [
      { t: "En la ciudad de Quito, el día " },
      { t: fechaHoraLarga(a), b: true },
      { t: ", en " },
      { t: a.lugar || "lugar no registrado", b: true },
      { t: `, se reunieron los miembros del capítulo de LAMA Quito en Asamblea ${tipo} correspondiente al mes de ` },
      { t: mesYAnio(a), b: true },
      { t: ", con la asistencia de " },
      { t: `${presentes.length} de ${total}`, b: true },
      { t: " socios activos (" },
      { t: `${pct} %`, b: true },
      { t: "). Se trataron los siguientes puntos:" },
    ], MX, y, ANCHO, LH, FS, TAM);
    y += 4;

    // --- Orden del día (números dorados, como en la convocatoria) ---
    y = seccion(y, "Orden del día");
    const items = (a.ordenDia && a.ordenDia.length) ? a.ordenDia : ["No se registraron puntos."];
    const SANGRIA = 9, LI = 6;
    items.forEach((it, i) => {
      doc.setFont(FS, "normal"); doc.setFontSize(TAM);
      const lineas = doc.splitTextToSize(String(it), ANCHO - SANGRIA - 2);
      y = asegurar(y, lineas.length * LI + 2);
      doc.setFont(FS, "bold"); doc.setTextColor(...ORO);
      doc.text(`${i + 1}.`, MX + 2, y);
      doc.setFont(FS, "normal"); doc.setTextColor(...TEXTO);
      lineas.forEach((l, j) => doc.text(l, MX + SANGRIA, y + j * LI));
      y += lineas.length * LI + 1.5;
    });
    y += 5;

    // --- Temas principales tratados ---
    y = seccion(y, "Temas principales tratados");
    doc.setFont(FS, "normal"); doc.setFontSize(TAM); doc.setTextColor(...TEXTO);
    const temas = (a.temas && a.temas.trim()) ? a.temas.trim() : "No se registró un resumen de temas.";
    // respeta cada salto de línea (Enter) tal como se escribió, incluidas las líneas en blanco
    temas.replace(/\r\n?/g, "\n").split("\n").forEach(linea => {
      if (!linea.trim()) { y += LI * 0.6; return; }
      doc.splitTextToSize(linea, ANCHO).forEach(l => {
        y = asegurar(y, LI);
        doc.text(l, MX, y);
        y += LI;
      });
    });
    y += 5;

    // --- Asistencia ---
    y = seccion(y, "Registro de asistencia");
    // resumen en una franja crema con bordes dorados
    y = asegurar(y, 14);
    doc.setFillColor(...CREMA); doc.setDrawColor(...ORO); doc.setLineWidth(0.3);
    doc.roundedRect(MX, y - 5, ANCHO, 10, 1.5, 1.5, "FD");
    const resumen = [`Presentes: ${presentes.length}`, `Ausentes: ${ausentes.length}`,
      `Socios activos: ${total}`, `Asistencia: ${pct} %`];
    doc.setFont(FS, "bold"); doc.setFontSize(10.5); doc.setTextColor(...NAVY);
    resumen.forEach((r, i) => doc.text(r, MX + ANCHO * (i + 0.5) / 4, y + 1.4, { align: "center" }));
    y += 11;

    y = tabla(y, ["#", "Socios presentes", "Observación"],
      presentes.length ? presentes.map((s, i) => [i + 1, s.nombre, obs(s)]) : [["—", "Sin asistentes registrados", ""]],
      NAVY);
    if (ausentes.length) {
      y = tabla(y, ["#", "Socios ausentes", "Observación"],
        ausentes.map((s, i) => [i + 1, s.nombre, obs(s)]), ORO);
    }

    // --- Firma (igual que la convocatoria, centrada) ---
    y = asegurar(y + 6, 34);
    y += 14;
    doc.setDrawColor(...ORO); doc.setLineWidth(0.4);
    doc.line(W / 2 - 32, y - 7, W / 2 + 32, y - 7);
    fuenteTitulo(16); doc.setTextColor(...NAVY);
    doc.text("Directiva", W / 2, y, { align: "center" });
    y += 7;
    doc.setFont(FS, "bold"); doc.setFontSize(12); doc.setTextColor(...ORO);
    doc.text("LAMA Quito", W / 2, y, { align: "center" });

    // --- Pie: fecha de generación y número de página, dentro del marco ---
    const paginas = doc.internal.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFont("times", "italic"); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
      doc.text(`Generado el ${new Date().toLocaleString("es-EC")}`, MX, H - 14);
      doc.text(`Página ${i} de ${paginas}`, W - MX, H - 14, { align: "right" });
    }

    doc.save(`acta-asamblea-${a.fecha || "sinfecha"}.pdf`);
    UI.toast("Acta de la asamblea descargada.");
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
    // tipo de asamblea según el check "Asamblea extraordinaria" (sin marcar = Ordinaria)
    const tipo = a.extraordinaria ? "Extraordinaria" : "Ordinaria";
    doc.setFont("times", "italic"); doc.setFontSize(14); doc.setTextColor(...ORO);
    doc.text(`Asamblea ${tipo}`, W / 2, y, { align: "center" });
    y += 14;

    // --- Texto de la convocatoria ---
    doc.setTextColor(...TEXTO);
    y = parrafoRico(doc, [
      { t: "Con un cordial saludo y por medio de la presente, la directiva actual se permite " },
      { t: "CONVOCAR", b: true },
      { t: ` a los miembros del capítulo de LAMA Quito a la Asamblea ${tipo} del mes de ` },
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
