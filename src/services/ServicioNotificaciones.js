import { INotificador } from '../interfaces/INotificador.js';
import { Notificacion } from '../domain/Notificacion.js';
import { TipoNotificacion, esValorDe } from '../domain/enums.js';
import { fechaHoraLocal } from '../utils/fechas.js';

export class ServicioNotificaciones extends INotificador {
  constructor({ repos, canal }) {
    super();
    this.repos = repos;
    this.canal = canal;
  }

  async enviar(idDestino, mensaje, { tipo = TipoNotificacion.CUENTA, idLote = null } = {}) {
    const notificacion = new Notificacion({ id_usuario: idDestino, id_lote: idLote, tipo, mensaje });
    notificacion.idNotificacion = await this.repos.notificaciones.guardar(notificacion.aFila());
    notificacion.fechaEnvio = fechaHoraLocal();
    const noLeidas = await this.repos.notificaciones.contarNoLeidas(idDestino);
    this.canal.emitir(idDestino, 'notificacion', { notificacion: notificacion.toJSON(), noLeidas });
    return true;
  }

  enviarPush(usuario, mensaje, opciones) {
    const id = typeof usuario === 'object' ? usuario.idUsuario : usuario;
    return this.enviar(id, mensaje, opciones);
  }

  async enviarVarios(idsDestino, mensaje, opciones) {
    const unicos = [...new Set(idsDestino.filter(Boolean))];
    await Promise.all(unicos.map((id) => this.enviar(id, mensaje, opciones)));
    return unicos.length;
  }

  async listar(idUsuario, tipo = null) {
    const filtro = esValorDe(TipoNotificacion, tipo) ? tipo : null;
    const filas = await this.repos.notificaciones.listarPorUsuario(idUsuario, { tipo: filtro });
    return filas.map((f) => Notificacion.desdeFila(f).toJSON());
  }

  contarNoLeidas(idUsuario) {
    return this.repos.notificaciones.contarNoLeidas(idUsuario);
  }

  marcarLeida(idNotificacion, idUsuario) {
    return this.repos.notificaciones.marcarLeida(idNotificacion, idUsuario);
  }

  marcarTodasLeidas(idUsuario) {
    return this.repos.notificaciones.marcarTodasLeidas(idUsuario);
  }
}
