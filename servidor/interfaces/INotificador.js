export class INotificador {
  constructor() {
    if (new.target === INotificador) throw new TypeError('INotificador es una interfaz.');
  }

  async enviar(_idDestino, _mensaje, _opciones) {
    throw new Error('enviar() no implementado');
  }
}
