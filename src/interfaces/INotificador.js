/** «interface» INotificador */
export class INotificador {
  constructor() {
    if (new.target === INotificador) throw new TypeError('INotificador es una interfaz.');
  }

  /**
   * @param {number} _idDestino  usuario destinatario
   * @param {string} _mensaje
   * @param {{ tipo: string, idLote?: number|null }} _opciones
   * @returns {Promise<boolean>}
   */
  async enviar(_idDestino, _mensaje, _opciones) {
    throw new Error('enviar() no implementado');
  }
}
