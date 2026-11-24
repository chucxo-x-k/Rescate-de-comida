/**
 * «interface» IRepositorio<T>
 * Todos los servicios acceden a la BD SQL solo a través de esta interfaz.
 */
export class IRepositorio {
  constructor() {
    if (new.target === IRepositorio) throw new TypeError('IRepositorio es una interfaz.');
  }

  /** @returns {Promise<number|string>} id del registro guardado */
  async guardar(_entidad) {
    throw new Error('guardar() no implementado');
  }

  /** @returns {Promise<object|null>} */
  async buscarPorId(_id) {
    throw new Error('buscarPorId() no implementado');
  }

  /** @returns {Promise<boolean>} */
  async actualizar(_id, _datos) {
    throw new Error('actualizar() no implementado');
  }

  /** @returns {Promise<boolean>} */
  async eliminar(_id) {
    throw new Error('eliminar() no implementado');
  }
}
