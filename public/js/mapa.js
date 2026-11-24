// Mapas con Leaflet + OpenStreetMap. Si Leaflet no cargó (sin internet), se muestra un aviso.
const CENTRO_POR_DEFECTO = [19.4326, -99.1332]; // CDMX
const TESELAS = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '&copy; OpenStreetMap';

const disponible = () => typeof window.L !== 'undefined';

function sinMapa(elemento, texto = 'Mapa no disponible sin conexión a internet.') {
  elemento.innerHTML = `<div class="mapa-placeholder">${texto}</div>`;
  return { fijar() {}, destruir() {} };
}

function crearBase(elemento, centro, zoom) {
  const mapa = window.L.map(elemento, { zoomControl: true, attributionControl: true }).setView(centro, zoom);
  window.L.tileLayer(TESELAS, { maxZoom: 19, attribution: ATRIBUCION }).addTo(mapa);
  setTimeout(() => mapa.invalidateSize(), 50);
  return mapa;
}

/** Mapa para elegir un punto: clic o arrastrar el marcador. */
export function mapaSelector(elemento, { latitud, longitud, alCambiar }) {
  if (!disponible()) return sinMapa(elemento, 'Mapa no disponible. Usa "Usar mi ubicación".');
  const tienePunto = Number.isFinite(latitud) && Number.isFinite(longitud);
  const mapa = crearBase(elemento, tienePunto ? [latitud, longitud] : CENTRO_POR_DEFECTO, tienePunto ? 16 : 12);
  let marcador = null;

  const fijar = (lat, lng, centrar = true) => {
    if (!marcador) {
      marcador = window.L.marker([lat, lng], { draggable: true }).addTo(mapa);
      marcador.on('dragend', () => {
        const p = marcador.getLatLng();
        alCambiar?.(p.lat, p.lng);
      });
    } else {
      marcador.setLatLng([lat, lng]);
    }
    if (centrar) mapa.setView([lat, lng], Math.max(mapa.getZoom(), 15));
  };

  if (tienePunto) fijar(latitud, longitud);
  mapa.on('click', (e) => {
    fijar(e.latlng.lat, e.latlng.lng, false);
    alCambiar?.(e.latlng.lat, e.latlng.lng);
  });

  return { fijar, destruir: () => mapa.remove() };
}

/** Mapa de solo lectura con uno o varios puntos (y línea entre ellos). */
export function mapaPuntos(elemento, puntos, { linea = false } = {}) {
  const validos = puntos.filter((p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud));
  if (validos.length === 0) return sinMapa(elemento, 'Sin ubicación registrada.');
  if (!disponible()) return sinMapa(elemento);

  const mapa = crearBase(elemento, [validos[0].latitud, validos[0].longitud], 15);
  const coordenadas = validos.map((p) => [p.latitud, p.longitud]);
  validos.forEach((p) => {
    const m = window.L.marker([p.latitud, p.longitud]).addTo(mapa);
    if (p.etiqueta) m.bindTooltip(p.etiqueta, { permanent: validos.length > 1, direction: 'top' });
  });
  if (linea && coordenadas.length > 1) {
    window.L.polyline(coordenadas, { color: '#1d1c1a', weight: 3, dashArray: '6 6' }).addTo(mapa);
  }
  if (coordenadas.length > 1) mapa.fitBounds(coordenadas, { padding: [36, 36] });
  return { fijar() {}, destruir: () => mapa.remove() };
}

/** Ubicación GPS del dispositivo. */
export function obtenerUbicacion() {
  return new Promise((resolver, rechazar) => {
    if (!navigator.geolocation) {
      rechazar(new Error('Tu navegador no permite obtener la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolver({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
      () => rechazar(new Error('No se pudo obtener tu ubicación. Revisa los permisos o marca el punto en el mapa.')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
