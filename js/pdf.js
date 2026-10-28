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

    encabezado(doc, "Acta de Asamblea", "Secretario LAMA · Documento oficial del grupo");
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
      head: [["#", "Socio presente", "Identificación", "Observación"]],
      body: presentes.length
        ? presentes.map((s, i) => [i + 1, s.nombre, s.identificacion || "—",
            (asis[s.id] && asis[s.id].observacion) || ""])
        : [["—", "Sin asistentes registrados", "", ""]],
      headStyles: { fillColor: AZUL },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 12 } },
    });
    y = doc.lastAutoTable.finalY + 4;

    // --- Ausentes ---
    if (ausentes.length) {
      doc.autoTable({
        startY: y,
        head: [["#", "Socio ausente", "Identificación"]],
        body: ausentes.map((s, i) => [i + 1, s.nombre, s.identificacion || "—"]),
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
    doc.setDrawColor(...GRIS);
    doc.line(20, y + 12, 85, y + 12);
    doc.line(w - 85, y + 12, w - 20, y + 12);
    doc.setFontSize(9); doc.setTextColor(...GRIS);
    doc.text("Presidente", 52, y + 17, { align: "center" });
    doc.text("Secretario", w - 52, y + 17, { align: "center" });

    pie(doc);
    const nombre = `acta-asamblea-${a.fecha || "sinfecha"}.pdf`;
    doc.save(nombre);
    UI.toast("PDF del acta generado.");
  }

  // ====================== CUADRO ANUAL ======================
  function cuadroAnual({ anio, socios, asambleas, matriz, porcentajes }) {
    if (!window.jspdf) return UI.toast("Cargando librería PDF, intenta de nuevo en un momento.");
    const doc = nuevoDoc("l");
    encabezado(doc, `Cuadro de asistencias ${anio}`, "Secretario LAMA · Asistencia de socios a asambleas");

    const head = [["Socio", ...asambleas.map(a => UI.fmtFecha(a.fecha).slice(0, 5)), "%"]];
    const body = socios.map((s, i) => {
      const fila = [s.nombre];
      asambleas.forEach(a => fila.push(matriz[s.id] && matriz[s.id][a.id] ? "X" : "·"));
      fila.push(porcentajes[s.id] + "%");
      return fila;
    });

    doc.autoTable({
      startY: 28,
      head,
      body,
      headStyles: { fillColor: AZUL, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.5, halign: "center" },
      columnStyles: { 0: { halign: "left", cellWidth: 55 } },
    });

    pie(doc);
    doc.save(`cuadro-asistencias-${anio}.pdf`);
    UI.toast("PDF del cuadro anual generado.");
  }

  // Precargar el logo en cuanto cargue el documento
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", precargarLogo);
  } else {
    precargarLogo();
  }

  return { actaAsamblea, cuadroAnual };
})();
window.PDF = PDF;
