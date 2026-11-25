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

  // ====================== REGISTRO DE RODADA ======================
  // Mismo estilo que el acta: marco, logo, ornamento, título en Cinzel, tablas de asistencia.
  async function registroRodada(data) {
    if (!window.jspdf) return UI.toast("Cargando librería PDF, intenta de nuevo en un momento.");
    const { rodada: r, encargado, socios, asis, presentes, ausentes } = data;
    const doc = nuevoDoc("p");
    const fTitulo = await cargarFuenteTitulo(doc);
    const fuenteTitulo = (tam) => { doc.setFont(fTitulo || "times", "bold"); doc.setFontSize(tam); };

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const MX = 22, ANCHO = W - 2 * MX;
    const FS = "times", TAM = 11.5, LH = 6.4;
    const ARRIBA = 22, ABAJO = 24;
    const CREMA = [250, 246, 236];
    const t = Puntos.tipo(r.tipo);
    // la observación indica si el socio fue como acompañante
    const obs = (s) => {
      const x = asis[s.id] || {};
      return [x.presente && x.acompanante ? "Acompañante" : "", x.observacion || ""].filter(Boolean).join(" · ");
    };
    const km = r.distanciaKm === "" || r.distanciaKm == null ? null
      : `${Number(r.distanciaKm).toLocaleString("es-EC", { maximumFractionDigits: 1 })} km`;

    const nuevaPagina = () => { doc.addPage(); marco(doc); return ARRIBA + 4; };
    const asegurar = (y, alto) => (y + alto > H - ABAJO ? nuevaPagina() : y);
    const seccion = (y, texto) => {
      y = asegurar(y, 22);
      doc.setFont(FS, "bold"); doc.setFontSize(13.5); doc.setTextColor(...NAVY);
      doc.text(texto, MX, y);
      doc.setDrawColor(...ORO); doc.setLineWidth(0.45);
      doc.line(MX, y + 1.8, MX + ANCHO, y + 1.8);
      doc.setTextColor(...TEXTO);
      return y + 8;
    };
    const tabla = (y, cabecera, filas, colorCab, extra = {}) => {
      y = asegurar(y, 30);
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
        didDrawPage: (d) => { if (d.pageNumber > 1) marco(doc); },
        ...extra,
      });
      return doc.lastAutoTable.finalY + 8;
    };

    marco(doc);

    // --- Logo y ornamento ---
    let y = 18;
    if (_logoDataUrl) {
      const alto = 26, ancho = alto * _logoRatio;
      try { doc.addImage(_logoDataUrl, "PNG", (W - ancho) / 2, y, ancho, alto); } catch (e) { /* sin logo */ }
      y += alto + 5;
    } else {
      y += 6;
    }
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
    doc.text(t.titulo, W / 2, y, { align: "center" });
    y += 8;
    doc.setFont("times", "italic"); doc.setFontSize(14); doc.setTextColor(...ORO);
    doc.text(t.nombre, W / 2, y, { align: "center" });
    y += 5.5;
    doc.setFont("times", "normal"); doc.setFontSize(9.5); doc.setTextColor(...GRIS);
    doc.text("L.A.M.A. Capítulo Quito · Registro de asistencia", W / 2, y, { align: "center" });
    y += 11;

    // --- Párrafo de apertura ---
    const total = socios.length;
    const pct = total ? Math.round((presentes.length / total) * 100) : 0;
    const partes = [
      { t: "El día " },
      { t: fechaHoraLarga({ fecha: r.fecha }), b: true },
    ];
    if (r.horaEncuentro || r.lugarEncuentro) {
      partes.push({ t: ", con punto de encuentro" });
      if (r.lugarEncuentro) partes.push({ t: " en " }, { t: r.lugarEncuentro, b: true });
      if (r.horaEncuentro) partes.push({ t: " a las " }, { t: `${r.horaEncuentro} horas`, b: true });
    }
    if (r.horaSalida) partes.push({ t: " y salida a las " }, { t: `${r.horaSalida} horas`, b: true });
    partes.push({ t: `, los miembros del capítulo de LAMA Quito realizaron una ${t.frase}` });
    if (r.destino) partes.push({ t: " con destino a " }, { t: r.destino, b: true });
    if (km) partes.push({ t: ", con una distancia de " }, { t: km, b: true }, { t: " (solo ida)" });
    if (encargado) partes.push({ t: ", a cargo de " }, { t: encargado, b: true });
    partes.push({ t: ". Asistieron " }, { t: `${presentes.length} de ${total}`, b: true },
      { t: " socios activos (" }, { t: `${pct} %`, b: true }, { t: ")." });
    doc.setTextColor(...TEXTO);
    y = parrafoRico(doc, partes, MX, y, ANCHO, LH, FS, TAM);
    y += 4;

    // --- Datos de la salida ---
    // Con coordenadas, la tabla ocupa la columna izquierda y el mapa del encuentro la derecha,
    // con la misma altura que la tabla. Sin coordenadas, la tabla ocupa todo el ancho.
    const conCoord = Mapa.hay(r.encuentroLat, r.encuentroLng);
    const MAPA_W = 64, SEP = 4;
    y = seccion(y, "Datos de la salida");
    y = asegurar(y, conCoord ? 95 : 30);      // tabla y mapa juntos en la misma página
    const yTabla = y, pagTabla = doc.internal.getNumberOfPages();
    const colDatos = conCoord
      ? { 0: { cellWidth: 12, halign: "center", textColor: ORO, fontStyle: "bold" }, 1: { cellWidth: 42, fontStyle: "bold" } }
      : { 0: { cellWidth: 12, halign: "center", textColor: ORO, fontStyle: "bold" }, 1: { cellWidth: 55, fontStyle: "bold" } };
    y = tabla(y, ["", "Dato", "Detalle"], [
      ["1", "Fecha de salida", UI.fmtFecha(r.fecha)],
      ["2", "Tipo de evento", t.nombre],
      ["3", "Hora de encuentro", r.horaEncuentro || "—"],
      ["4", "Hora de salida", r.horaSalida || "—"],
      ["5", "Lugar de encuentro", r.lugarEncuentro || "—"],
      ["6", "Destino", r.destino || "—"],
      ["7", "Distancia (solo ida)", km || "—"],
      ["8", "Socio encargado", encargado || "—"],
      ...(conCoord ? [["9", "Coordenadas del encuentro", Mapa.texto(r.encuentroLat, r.encuentroLng)]] : []),
    ], NAVY, {
      columnStyles: colDatos,
      margin: { left: MX, right: conCoord ? MX + MAPA_W + SEP : MX, top: ARRIBA + 4, bottom: ABAJO },
    });

    // --- Mapa del punto de encuentro (imagen fija de OpenStreetMap), a la derecha de la tabla ---
    let mapaFallido = false;
    if (conCoord) {
      const misma = doc.internal.getNumberOfPages() === pagTabla;   // la tabla no saltó de página
      const fin = misma ? doc.lastAutoTable.finalY : H - ABAJO;
      const altoMapa = Math.max(40, fin - yTabla);
      const xMapa = W - MX - MAPA_W;
      UI.toast("Preparando el mapa del punto de encuentro...");
      const anchoPx = 512, altoPx = Math.round(anchoPx * altoMapa / MAPA_W);
      const url = await Mapa.imagen(r.encuentroLat, r.encuentroLng, { ancho: anchoPx, alto: altoPx });
      const paginaActual = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setPage(pagTabla);
      if (url) {
        try {
          doc.addImage(url, "PNG", xMapa, yTabla, MAPA_W, altoMapa);
          doc.setDrawColor(...ORO); doc.setLineWidth(0.4);
          doc.rect(xMapa, yTabla, MAPA_W, altoMapa);
          // toda la imagen abre la ubicación en Google Maps
          doc.link(xMapa, yTabla, MAPA_W, altoMapa, { url: Mapa.urlGoogle(r.encuentroLat, r.encuentroLng) });
          doc.setFont(FS, "italic"); doc.setFontSize(9); doc.setTextColor(...GRIS);
          doc.textWithLink("Punto de encuentro · abrir en Google Maps", xMapa + MAPA_W / 2, yTabla + altoMapa + 4.5,
            { align: "center", url: Mapa.urlGoogle(r.encuentroLat, r.encuentroLng) });
          doc.setTextColor(...TEXTO);
          if (misma) y = Math.max(y, yTabla + altoMapa + 12);
        } catch (e) {
          console.warn("No se pudo insertar el mapa en el PDF:", e);
          mapaFallido = true;
        }
      } else {
        // sin conexión: se deja el recuadro con las coordenadas para no dejar un hueco vacío
        mapaFallido = true;
        doc.setFillColor(250, 246, 236); doc.setDrawColor(...ORO); doc.setLineWidth(0.3);
        doc.roundedRect(xMapa, yTabla, MAPA_W, altoMapa, 1.5, 1.5, "FD");
        doc.setFont(FS, "italic"); doc.setFontSize(10); doc.setTextColor(...GRIS);
        doc.text(["Mapa no disponible", "(sin conexión al generar)", "", Mapa.texto(r.encuentroLat, r.encuentroLng)],
          xMapa + MAPA_W / 2, yTabla + altoMapa / 2 - 6, { align: "center" });
        doc.textWithLink("Abrir en Google Maps", xMapa + MAPA_W / 2, yTabla + altoMapa / 2 + 12,
          { align: "center", url: Mapa.urlGoogle(r.encuentroLat, r.encuentroLng) });
        doc.setTextColor(...TEXTO);
      }
      doc.setPage(paginaActual);
    }

    // --- Asistencia ---
    y = seccion(y, "Registro de asistencia");
    y = asegurar(y, 14);
    doc.setFillColor(...CREMA); doc.setDrawColor(...ORO); doc.setLineWidth(0.3);
    doc.roundedRect(MX, y - 5, ANCHO, 10, 1.5, 1.5, "FD");
    const resumen = [`Asistieron: ${presentes.length}`, `No asistieron: ${ausentes.length}`,
      `Socios activos: ${total}`, `Participación: ${pct} %`];
    doc.setFont(FS, "bold"); doc.setFontSize(10.5); doc.setTextColor(...NAVY);
    resumen.forEach((t, i) => doc.text(t, MX + ANCHO * (i + 0.5) / 4, y + 1.4, { align: "center" }));
    y += 11;

    y = tabla(y, ["#", "Socios que asistieron", "Observación"],
      presentes.length ? presentes.map((s, i) => [i + 1, s.nombre, obs(s)]) : [["—", "Sin asistentes registrados", ""]],
      NAVY);
    if (ausentes.length) {
      y = tabla(y, ["#", "Socios que no asistieron", "Observación"],
        ausentes.map((s, i) => [i + 1, s.nombre, obs(s)]), ORO);
    }

    // --- Firma ---
    y = asegurar(y + 6, 34);
    y += 14;
    doc.setDrawColor(...ORO); doc.setLineWidth(0.4);
    doc.line(W / 2 - 32, y - 7, W / 2 + 32, y - 7);
    fuenteTitulo(16); doc.setTextColor(...NAVY);
    doc.text(encargado ? (t.titulo === "ACTIVIDAD" ? "Encargado de la actividad" : "Encargado de la rodada") : "Directiva", W / 2, y, { align: "center" });
    y += 7;
    doc.setFont(FS, "bold"); doc.setFontSize(12); doc.setTextColor(...ORO);
    doc.text(encargado || "LAMA Quito", W / 2, y, { align: "center" });

    // --- Pie ---
    const paginas = doc.internal.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFont("times", "italic"); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
      doc.text(`Generado el ${new Date().toLocaleString("es-EC")}`, MX, H - 14);
      doc.text(`Página ${i} de ${paginas}`, W - MX, H - 14, { align: "right" });
    }

    const destino = (r.destino || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    doc.save(`rodada-${r.fecha || "sinfecha"}${destino ? "-" + destino : ""}.pdf`);
    UI.toast(mapaFallido
      ? "PDF descargado sin mapa: no se pudo obtener el mapa (revisa la conexión)."
      : "Registro de la rodada descargado.");
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
    consideradas = [], total = 0, totalAnio = 0, indicadores = null, umbral = 3, rodadas = null, puntos = null,
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
        const lineas = doc.splitTextToSize(nota, W - 2 * M);
        doc.text(lineas, M, y);
        y += 3 + (lineas.length - 1) * 3.8;
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

    // --- Ranking de puntos (asambleas + rodadas/eventos) ---
    if (puntos) {
      const p = puntos, v = p.valores, f2 = (n) => Puntos.fmt(n);
      const pl = (n, s) => `${n} ${s}${n === 1 ? "" : "s"}`;
      seccion("Ranking de puntos",
        `Sobre ${pl(p.eventos.total, "evento")} con asistencia registrada (${pl(p.eventos.asambleas, "asamblea")} y ${p.eventos.rodadas} rodada(s) o actividad(es)). ` +
        `Puntos: asamblea ${f2(v.asamblea)}, rodada interna ${f2(v.rodadaInterna)}, aniversario de otro capítulo ${f2(v.aniversarioCapitulo)}, ` +
        `nacional ${f2(v.aniversarioNacional)}, internacional ${f2(v.aniversarioInternacional)}, actividad social ${f2(v.social)}, ` +
        `organizador ${f2(v.organizador)}, ${f2(v.porKm)} por km (máx. ${f2(v.maxKmEvento)} km por evento), ` +
        `mes perfecto ${f2(v.bonoMensual)}, año perfecto ${f2(v.bonoAnual)} (reemplaza a las mensuales). Como acompañante no suma puntos.`);
      const c = (g) => (g.pts || g.n ? `${f2(g.pts)} (${g.n})` : "-");
      const aniv = (f) => ({ n: f.anivCapitulo.n + f.anivNacional.n + f.anivInternacional.n,
        pts: f.anivCapitulo.pts + f.anivNacional.pts + f.anivInternacional.pts });
      doc.autoTable({
        ...estilos,
        startY: y + 1,
        head: [["Pos.", "Socio", "Asambleas", "Internas", "Aniversarios", "Sociales", "Km", "Organizador", "Bonificación", "Total"]],
        body: p.filas.map(f => [
          f.pos, f.socio.nombre, c(f.asambleas), c(f.internas), c(aniv(f)), c(f.sociales),
          f.km.pts ? `${f2(f.km.pts)} (${f2(f.km.km)} km)` : "-",
          c(f.organizador),
          f.anual.pts ? `${f2(f.anual.pts)} (año)` : f.mensual.pts ? `${f2(f.mensual.pts)} (${pl(f.mensual.n, "mes")})` : "-",
          f2(f.total),
        ]),
        columnStyles: {
          0: { cellWidth: 13, halign: "center" },
          1: { cellWidth: 52 },
          2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
          6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" },
          9: { halign: "right", cellWidth: 20, fontStyle: "bold" },
        },
        didParseCell: (d) => {
          if (d.section === "head" && d.column.index >= 2) d.cell.styles.halign = "right";
          if (d.section === "body" && p.filas[d.row.index].pos <= 3 && p.filas[d.row.index].total > 0) d.cell.styles.fontStyle = "bold";
        },
      });
      despuesDeTabla();
    }

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
    if (asambleas.length) {
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
      despuesDeTabla();
    }

    // --- Participación en rodadas ---
    if (rodadas && rodadas.total) {
      const km = (n) => `${Number(n || 0).toLocaleString("es-EC", { maximumFractionDigits: 1 })} km`;
      const pl = rodadas.total === 1 ? "" : "s";
      if (y > H - 60) { doc.addPage(); y = 20; }
      seccion("Participación en rodadas",
        `Sobre ${rodadas.total} rodada${pl} realizada${pl} con asistencia registrada (de ${rodadas.totalAnio} del año): ` +
        `${rodadas.internas} interna${rodadas.internas === 1 ? "" : "s"}, ${rodadas.aniversario} de aniversario, ${rodadas.sociales || 0} social(es), ` +
        `${km(rodadas.kmTotal)} en total. Participación promedio: ${rodadas.promedio}%. Solo socios activos.`);
      doc.autoTable({
        ...estilos,
        startY: y + 1,
        head: [["Pos.", "Socio", "Eventos", "Internas", "Aniversarios", "Sociales", "Km recorridos", "%"]],
        body: rodadas.filas.map(f => [f.pos, f.socio.nombre, `${f.asist} de ${rodadas.total}`,
          String(f.internas), String(f.aniversario), String(f.sociales || 0), km(f.km), `${f.pct}%`]),
        columnStyles: {
          0: { cellWidth: 16, halign: "center" },
          2: { cellWidth: 30, halign: "center" },
          3: { cellWidth: 26, halign: "center" },
          4: { cellWidth: 28, halign: "center" },
          5: { cellWidth: 24, halign: "center" },
          6: { cellWidth: 34, halign: "right" },
          7: { cellWidth: 22, halign: "center" },
        },
        didParseCell: (d) => {
          if (d.section === "body" && rodadas.filas[d.row.index].pos <= 3 && rodadas.filas[d.row.index].asist > 0) d.cell.styles.fontStyle = "bold";
        },
      });
      despuesDeTabla();
    }

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

    // --- Mapa del lugar (si la asamblea tiene coordenadas), ajustado al espacio libre ---
    const NOTA = " El sargento de armas estará vigilando el correcto uso del uniforme (zapatos negro, jean azul, buzo negro y chaleco).";
    let mapaFallido = false;
    doc.setFont(FS, "normal"); doc.setFontSize(TAM);
    const altoNota = doc.splitTextToSize("NOTA:" + NOTA, ANCHO).length * LH;
    if (Mapa.hay(a.lugarLat, a.lugarLng)) {
      const libre = (H - 20) - (y + 6) - 12.5 - (6 + altoNota + 10 + 23);
      const alto = libre >= 35 ? Math.min(70, libre) : 70;
      UI.toast("Preparando el mapa del lugar...");
      const url = await Mapa.imagen(a.lugarLat, a.lugarLng, { ancho: 900, alto: Math.round(900 * alto / ANCHO) });
      const gmaps = Mapa.urlGoogle(a.lugarLat, a.lugarLng);
      y += 6;
      if (url) {
        if (libre < 35) { nuevaPagina(); y = 26; }
        try {
          doc.addImage(url, "PNG", MX, y, ANCHO, alto);
          doc.setDrawColor(...ORO); doc.setLineWidth(0.4);
          doc.rect(MX, y, ANCHO, alto);
          doc.link(MX, y, ANCHO, alto, { url: gmaps });
          y += alto + 4.5;
          doc.setFont(FS, "italic"); doc.setFontSize(9.5); doc.setTextColor(...GRIS);
          doc.textWithLink(`Lugar: ${Mapa.texto(a.lugarLat, a.lugarLng)} · abrir en Google Maps`, W / 2, y, { align: "center", url: gmaps });
          doc.setTextColor(...TEXTO);
          y += 2;
        } catch (e) {
          console.warn("No se pudo insertar el mapa:", e);
          mapaFallido = true;
        }
      } else {
        // sin conexión: al menos el enlace con las coordenadas
        mapaFallido = true;
        doc.setFont(FS, "italic"); doc.setFontSize(10.5); doc.setTextColor(...GRIS);
        doc.textWithLink(`Ubicación del lugar: ${Mapa.texto(a.lugarLat, a.lugarLng)} (abrir en Google Maps)`, MX, y, { url: gmaps });
        doc.setTextColor(...TEXTO);
        y += 2;
      }
    }

    // --- Nota (nota y firma juntas; si no caben, pasan a la página siguiente) ---
    y += 6;
    if (y + altoNota + 10 + 23 > H - 20) { nuevaPagina(); y = 26; }
    doc.setTextColor(...TEXTO);
    y = parrafoRico(doc, [
      { t: "NOTA:", b: true },
      { t: NOTA },
    ], MX, y, ANCHO, LH, FS, TAM);

    // --- Firma ---
    y += 10;
    if (y + 23 > H - 20) { nuevaPagina(); y = 30; }
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
    UI.toast(mapaFallido
      ? "Convocatoria generada sin mapa: no se pudo obtener el mapa (revisa la conexión)."
      : "Convocatoria generada.");
  }

  // ====================== CONVOCATORIA A RODADA ======================
  // Mismo estilo que la convocatoria de asamblea. Incluye el itinerario y, si la rodada
  // tiene coordenadas, el mapa del punto de encuentro (sin conexión se omite).
  async function convocatoriaRodada(r, { encargado = "" } = {}) {
    if (!window.jspdf) return UI.toast("Cargando librería PDF, intenta de nuevo en un momento.");
    const doc = nuevoDoc("p");
    const fTitulo = await cargarFuenteTitulo(doc);
    const fuenteTitulo = (tam) => { doc.setFont(fTitulo || "times", "bold"); doc.setFontSize(tam); };

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const MX = 26, ANCHO = W - 2 * MX;
    const FS = "times", TAM = 12, LH = 7;
    const t = Puntos.tipo(r.tipo);
    const conCoord = Mapa.hay(r.encuentroLat, r.encuentroLng);
    const km = r.distanciaKm === "" || r.distanciaKm == null ? null
      : `${Number(r.distanciaKm).toLocaleString("es-EC", { maximumFractionDigits: 1 })} km`;
    const nuevaPagina = () => { doc.addPage(); marco(doc); return 26; };

    marco(doc);

    // --- Logo y ornamento ---
    let y = 20;
    if (_logoDataUrl) {
      const alto = 30, ancho = alto * _logoRatio;
      try { doc.addImage(_logoDataUrl, "PNG", (W - ancho) / 2, y, ancho, alto); } catch (e) { /* sin logo */ }
      y += alto + 6;
    } else {
      y += 8;
    }
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
    doc.text(t.nombre, W / 2, y, { align: "center" });
    y += 14;

    // --- Texto ---
    doc.setTextColor(...TEXTO);
    y = parrafoRico(doc, [
      { t: "Con un cordial saludo y por medio de la presente, la directiva actual se permite " },
      { t: "CONVOCAR", b: true },
      { t: ` a los miembros del capítulo de LAMA Quito a la ${t.frase}` },
      ...(r.destino ? [{ t: " con destino a " }, { t: r.destino, b: true }] : []),
      { t: ", que se realizará el día " },
      { t: fechaHoraLarga({ fecha: r.fecha }), b: true },
      { t: ", de acuerdo con el siguiente itinerario:" },
    ], MX, y, ANCHO, LH, FS, TAM);
    y += 4;

    // --- Itinerario (etiquetas doradas, valores en negrita) ---
    const items = [
      ["Punto de encuentro", r.lugarEncuentro || "Por definir"],
      ["Hora de encuentro", r.horaEncuentro ? `${r.horaEncuentro} horas` : "Por definir"],
      ["Hora de salida", r.horaSalida ? `${r.horaSalida} horas` : "Por definir"],
      ["Destino", r.destino || "Por definir"],
      ...(km ? [["Distancia (solo ida)", km]] : []),
      ...(encargado ? [[t.titulo === "ACTIVIDAD" ? "Encargado de la actividad" : "Encargado de la rodada", encargado]] : []),
    ];
    const COL = 58, LI = 6.6;
    items.forEach(([etq, val]) => {
      doc.setFont(FS, "bold"); doc.setFontSize(TAM);
      const lineas = doc.splitTextToSize(String(val), ANCHO - COL - 4);
      if (y + lineas.length * LI > H - 24) y = nuevaPagina();
      doc.setTextColor(...ORO);
      doc.text("•", MX + 2, y);
      doc.text(`${etq}:`, MX + 7, y);
      doc.setTextColor(...TEXTO);
      lineas.forEach((l, j) => doc.text(l, MX + COL, y + j * LI));
      y += lineas.length * LI + 0.8;
    });
    y += 5;

    // --- Mapa del punto de encuentro (ajustado al espacio libre de la página) ---
    const NOTA = " Se solicita puntualidad, presentarse con el tanque de combustible lleno, la documentación de la motocicleta en regla y portar el chaleco del capítulo.";
    doc.setFont(FS, "normal"); doc.setFontSize(TAM);
    const altoNota = doc.splitTextToSize("NOTA:" + NOTA, ANCHO).length * LH;
    const FIRMA = 33;                           // "Atentamente", línea, Directiva y LAMA Quito
    const LIMITE = H - 20;                      // último renglón útil dentro del marco
    let mapaFallido = false;
    if (conCoord) {
      // espacio que queda para el mapa dejando sitio a su leyenda, la nota y la firma
      const libre = LIMITE - y - 12.5 - (2 + altoNota + FIRMA);
      const alto = libre >= 35 ? Math.min(72, libre) : 72;
      UI.toast("Preparando el mapa del punto de encuentro...");
      const url = await Mapa.imagen(r.encuentroLat, r.encuentroLng,
        { ancho: 900, alto: Math.round(900 * alto / ANCHO) });
      if (url) {
        if (libre < 35) y = nuevaPagina();
        try {
          doc.addImage(url, "PNG", MX, y, ANCHO, alto);
          doc.setDrawColor(...ORO); doc.setLineWidth(0.4);
          doc.rect(MX, y, ANCHO, alto);
          doc.link(MX, y, ANCHO, alto, { url: Mapa.urlGoogle(r.encuentroLat, r.encuentroLng) });
          y += alto + 4.5;
          doc.setFont(FS, "italic"); doc.setFontSize(9.5); doc.setTextColor(...GRIS);
          doc.textWithLink(`Punto de encuentro: ${Mapa.texto(r.encuentroLat, r.encuentroLng)} · abrir en Google Maps`,
            W / 2, y, { align: "center", url: Mapa.urlGoogle(r.encuentroLat, r.encuentroLng) });
          doc.setTextColor(...TEXTO);
          y += 8;
        } catch (e) {
          console.warn("No se pudo insertar el mapa:", e);
          mapaFallido = true;
        }
      } else {
        mapaFallido = true;
        // sin mapa: al menos el enlace con las coordenadas
        doc.setFont(FS, "italic"); doc.setFontSize(10.5); doc.setTextColor(...GRIS);
        doc.textWithLink(`Ubicación del encuentro: ${Mapa.texto(r.encuentroLat, r.encuentroLng)} (abrir en Google Maps)`,
          MX, y, { url: Mapa.urlGoogle(r.encuentroLat, r.encuentroLng) });
        doc.setTextColor(...TEXTO);
        y += 9;
      }
    }

    // --- Nota (nota y firma van juntas; si no caben, pasan a la página siguiente) ---
    y += 2;
    if (y + altoNota + FIRMA > LIMITE) y = nuevaPagina();
    doc.setTextColor(...TEXTO);
    y = parrafoRico(doc, [
      { t: "NOTA:", b: true },
      { t: NOTA },
    ], MX, y, ANCHO, LH, FS, TAM);

    // --- Firma ---
    y += 10;
    if (y + FIRMA - 10 > LIMITE) y = nuevaPagina() + 4;
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

    const destino = (r.destino || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    doc.save(`convocatoria-rodada-${r.fecha || "sinfecha"}${destino ? "-" + destino : ""}.pdf`);
    UI.toast(mapaFallido
      ? "Convocatoria generada sin mapa: no se pudo obtener el mapa (revisa la conexión)."
      : "Convocatoria a la rodada generada.");
  }

  return { actaAsamblea, registroRodada, cuadroAnual, convocatoria, convocatoriaRodada };
})();
window.PDF = PDF;
