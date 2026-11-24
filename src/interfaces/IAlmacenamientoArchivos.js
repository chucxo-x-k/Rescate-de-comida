/**
 * «interface» IAlmacenamientoArchivos
 * Fotos, firmas y documentos se guardan fuera de la BD; en la BD solo va su ruta.
 */
export class IAlmacenamientoArchivos {
  constructor() {
    if (new.target === IAlmacenamientoArchivos) throw new TypeError('IAlmacenamientoArchivos es una interfaz.');
  }

  /**
   * @param {{ buffer: Buffer, mimetype: string, originalname?: string }} _archivo
   * @param {string} _carpeta  p. ej. "lotes", "evidencias", "documentos"
   * @returns {Promise<string>} clave o URL pública del archivo
   */
  async subir(_archivo, _carpeta) {
    throw new Error('subir() no implementado');
  }

  /** @returns {string} URL con la que el cliente puede abrir el archivo */
  obtenerUrl(_clave) {
    throw new Error('obtenerUrl() no implementado');
  }
}
