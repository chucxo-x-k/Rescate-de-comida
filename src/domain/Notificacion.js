import { TipoNotificacion, esValorDe } from './enums.js';

const LONGITUD_MAXIMA = 255;

export class Notificacion {
  constructor(datos) {
    if (!esValorDe(TipoNotificacion, datos.tipo)) throw new TypeError(`Tipo de notificación inválido: ${datos.tipo}`);
    this.idNotificacion = datos.id_notificacion ?? null;
    this.idUsuario = datos.id_usuario;
    this.idLote = datos.id_lote ?? null;
    this.tipo = datos.tipo;
    this.mensaje = String(datos.mensaje).slice(0, LONGITUD_MAXIMA);
    this.leida = Boolean(datos.leida ?? 0);
    this.fechaEnvio = datos.fecha_envio ?? null;
  }

  static desdeFila(fila) {
    return new Notificacion(fila);
  }

  aFila() {
    return { id_usuario: this.idUsuario, id_lote: this.idLote, tipo: this.tipo, mensaje: this.mensaje };
  }

  toJSON() {
    return {
      idNotificacion: this.idNotificacion,
      idUsuario: this.idUsuario,
      idLote: this.idLote,
      tipo: this.tipo,
      mensaje: this.mensaje,
      leida: this.leida,
      fechaEnvio: this.fechaEnvio,
    };
  }
}
