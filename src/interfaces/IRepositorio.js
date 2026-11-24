export class IRepositorio {
  constructor() {
    if (new.target === IRepositorio) throw new TypeError('IRepositorio es una interfaz.');
  }

  async guardar(_entidad) {
    throw new Error('guardar() no implementado');
  }

  async buscarPorId(_id) {
    throw new Error('buscarPorId() no implementado');
  }

  async actualizar(_id, _datos) {
    throw new Error('actualizar() no implementado');
  }

  async eliminar(_id) {
    throw new Error('eliminar() no implementado');
  }
}
