const RADIO_TIERRA_KM = 6371;
const aRadianes = (grados) => (grados * Math.PI) / 180;

export class Ubicacion {
  #latitud;
  #longitud;
  #direccion;

  constructor(latitud, longitud, direccion = '') {
    const lat = Number(latitud);
    const lng = Number(longitud);
    if (!Ubicacion.coordenadasValidas(lat, lng)) {
      throw new RangeError('Coordenadas fuera de rango.');
    }
    this.#latitud = lat;
    this.#longitud = lng;
    this.#direccion = direccion ?? '';
  }

  static coordenadasValidas(latitud, longitud) {
    if (latitud === null || latitud === undefined || latitud === '') return false;
    if (longitud === null || longitud === undefined || longitud === '') return false;
    const lat = Number(latitud);
    const lng = Number(longitud);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /** Devuelve una Ubicacion o null si las coordenadas no son válidas. */
  static desde(latitud, longitud, direccion = '') {
    return Ubicacion.coordenadasValidas(latitud, longitud) ? new Ubicacion(latitud, longitud, direccion) : null;
  }

  get latitud() { return this.#latitud; }
  get longitud() { return this.#longitud; }
  get direccion() { return this.#direccion; }

  /** Distancia en línea recta (fórmula de Haversine) en kilómetros. */
  distanciaKm(otra) {
    const dLat = aRadianes(otra.latitud - this.#latitud);
    const dLng = aRadianes(otra.longitud - this.#longitud);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(aRadianes(this.#latitud)) * Math.cos(aRadianes(otra.latitud)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(RADIO_TIERRA_KM * c * 100) / 100;
  }

  toJSON() {
    return { latitud: this.#latitud, longitud: this.#longitud, direccion: this.#direccion };
  }
}
