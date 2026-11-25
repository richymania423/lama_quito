/**
 * mapa.js — Mapas del punto de encuentro de las rodadas (OpenStreetMap).
 *  - parsear(texto): acepta "lat, lng" o un enlace de Google Maps y devuelve { lat, lng } | null.
 *  - mostrar(div, lat, lng): mapa interactivo con Leaflet (se carga solo cuando hace falta).
 *  - imagen(lat, lng): imagen fija (dataURL PNG) armada con teselas de OSM, para el PDF.
 * Los datos del mapa son © colaboradores de OpenStreetMap (licencia ODbL); se muestra la atribución.
 */
const Mapa = (() => {
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  const TESELAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const ATRIBUCION = "© OpenStreetMap";

  const valido = (lat, lng) =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const redondear = (n) => Math.round(n * 1e6) / 1e6; // 6 decimales ≈ 11 cm

  // ---------- Lectura de coordenadas ----------
  // Formatos: "-0.1807, -78.4678" · "-0.1807 -78.4678" · enlaces con "@lat,lng", "q=lat,lng",
  // "ll=lat,lng", "query=lat,lng" o "!3dlat!4dlng". Los enlaces cortos (maps.app.goo.gl)
  // no traen las coordenadas en el texto y no se pueden leer.
  function parsear(texto) {
    let t = String(texto || "").trim();
    try { t = decodeURIComponent(t); } catch (e) { /* texto con "%" suelto: se usa tal cual */ }
    if (!t) return null;
    const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
    const patrones = [
      new RegExp(`!3d${num}!4d${num}`),                       // lugar marcado en Google Maps
      new RegExp(`[?&](?:q|ll|query|center|destination)=${num}\\s*,\\s*${num}`),
      new RegExp(`@${num},${num}`),                           // centro de la vista
      new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`),            // texto plano
    ];
    for (const re of patrones) {
      const m = t.match(re);
      if (m) {
        const lat = Number(m[1]), lng = Number(m[2]);
        if (valido(lat, lng)) return { lat: redondear(lat), lng: redondear(lng) };
      }
    }
    return null;
  }

  const hay = (lat, lng) => lat != null && lng != null && valido(Number(lat), Number(lng));
  const texto = (lat, lng) => `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  const urlGoogle = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // ---------- Mapa interactivo (Leaflet) ----------
  let _cargaLeaflet = null;
  function cargarLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (_cargaLeaflet) return _cargaLeaflet;
    _cargaLeaflet = new Promise((ok, falla) => {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = LEAFLET_CSS;
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.onload = () => ok(window.L);
      s.onerror = () => { _cargaLeaflet = null; falla(new Error("No se pudo cargar el mapa (sin conexión).")); };
      document.head.appendChild(s);
    });
    return _cargaLeaflet;
  }

  let _mapa = null;
  async function mostrar(div, lat, lng, etiqueta = "") {
    quitar();
    const L = await cargarLeaflet();
    quitar(); // por si otra llamada creó un mapa mientras se cargaba Leaflet
    _mapa = L.map(div, { scrollWheelZoom: false }).setView([lat, lng], 16);
    L.tileLayer(TESELAS, { maxZoom: 19, attribution: ATRIBUCION }).addTo(_mapa);
    // pin dibujado en SVG (no depende de las imágenes del icono por defecto de Leaflet)
    const pin = L.divIcon({
      className: "mapa-pin",
      html: `<svg width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">
        <path d="M15 41C15 41 1 24 1 15a14 14 0 0 1 28 0c0 9-14 26-14 26z" fill="#c0392b" stroke="#fff" stroke-width="2"/>
        <circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`,
      iconSize: [30, 42], iconAnchor: [15, 41], popupAnchor: [0, -36],
    });
    const m = L.marker([lat, lng], { icon: pin, title: etiqueta || "Punto de encuentro" }).addTo(_mapa);
    if (etiqueta) m.bindPopup(UI.esc(etiqueta));
    // si el contenedor acaba de hacerse visible, recalcula su tamaño
    setTimeout(() => _mapa && _mapa.invalidateSize(), 150);
  }
  function quitar() {
    if (_mapa) { _mapa.remove(); _mapa = null; }
  }

  // ---------- Imagen fija para el PDF ----------
  // Proyección Web Mercator: posición en píxeles del mundo para un zoom dado.
  function aPixel(lat, lng, z) {
    const n = 256 * 2 ** z;
    const s = Math.sin((lat * Math.PI) / 180);
    return {
      x: ((lng + 180) / 360) * n,
      y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n,
    };
  }

  function cargarTesela(url, ms) {
    return new Promise((ok) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const t = setTimeout(() => { img.src = ""; ok(null); }, ms);
      img.onload = () => { clearTimeout(t); ok(img); };
      img.onerror = () => { clearTimeout(t); ok(null); };
      img.src = url;
    });
  }

  // Devuelve un dataURL PNG (ancho × alto px) centrado en el punto, o null si no hay conexión.
  async function imagen(lat, lng, { ancho = 900, alto = 420, zoom = 16, ms = 8000 } = {}) {
    const c = aPixel(lat, lng, zoom);
    const x0 = c.x - ancho / 2, y0 = c.y - alto / 2;
    const tx0 = Math.floor(x0 / 256), ty0 = Math.floor(y0 / 256);
    const tx1 = Math.floor((x0 + ancho) / 256), ty1 = Math.floor((y0 + alto) / 256);
    const max = 2 ** zoom;
    const tareas = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        if (ty < 0 || ty >= max) continue;
        const x = ((tx % max) + max) % max;
        const url = TESELAS.replace("{z}", zoom).replace("{x}", x).replace("{y}", ty);
        tareas.push(cargarTesela(url, ms).then(img => ({ img, tx, ty })));
      }
    }
    const teselas = await Promise.all(tareas);
    if (!teselas.length || teselas.some(t => !t.img)) return null; // mapa incompleto: mejor no ponerlo

    const cv = document.createElement("canvas");
    cv.width = ancho; cv.height = alto;
    const g = cv.getContext("2d");
    g.fillStyle = "#e8e4da"; g.fillRect(0, 0, ancho, alto);
    teselas.forEach(({ img, tx, ty }) => g.drawImage(img, Math.round(tx * 256 - x0), Math.round(ty * 256 - y0)));

    // marcador tipo "pin" con la punta exactamente en la coordenada
    const px = ancho / 2, py = alto / 2;
    g.save();
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 6; g.shadowOffsetY = 2;
    g.fillStyle = "#c0392b";
    g.beginPath();
    g.moveTo(px, py);
    g.bezierCurveTo(px - 6, py - 14, px - 17, py - 22, px - 17, py - 33);
    g.arc(px, py - 33, 17, Math.PI, 0);
    g.bezierCurveTo(px + 17, py - 22, px + 6, py - 14, px, py);
    g.fill();
    g.restore();
    g.fillStyle = "#ffffff";
    g.beginPath(); g.arc(px, py - 33, 6.5, 0, 2 * Math.PI); g.fill();

    // atribución obligatoria de OpenStreetMap
    g.font = "15px Arial, sans-serif";
    const w = g.measureText(ATRIBUCION + " contributors").width + 14;
    g.fillStyle = "rgba(255,255,255,.85)";
    g.fillRect(ancho - w, alto - 24, w, 24);
    g.fillStyle = "#333";
    g.fillText(ATRIBUCION + " contributors", ancho - w + 7, alto - 7);

    try { return cv.toDataURL("image/png"); } catch (e) { return null; } // lienzo bloqueado por CORS
  }

  return { parsear, hay, texto, urlGoogle, mostrar, quitar, imagen };
})();
window.Mapa = Mapa;
