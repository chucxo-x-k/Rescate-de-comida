export class IAlmacenamientoArchivos {
  constructor() {
    if (new.target === IAlmacenamientoArchivos) throw new TypeError('IAlmacenamientoArchivos es una interfaz.');
  }

  async subir(_archivo, _carpeta) {
    throw new Error('subir() no implementado');
  }

  obtenerUrl(_clave) {
    throw new Error('obtenerUrl() no implementado');
  }
}
