import { RepositorioSQL } from './RepositorioSQL.js';

export class RepositorioNotificaciones extends RepositorioSQL {
  constructor() {
    super('notificaciones', 'id_notificacion', [
      'id_notificacion', 'id_usuario', 'id_lote', 'tipo', 'mensaje', 'leida', 'fecha_envio',
    ]);
  }

  listarPorUsuario(idUsuario, { tipo = null, limite = 100 } = {}) {
    const filtroTipo = tipo ? 'AND tipo = ?' : '';
    const parametros = tipo ? [idUsuario, tipo, limite] : [idUsuario, limite];
    return this.consultar(
      `SELECT * FROM notificaciones WHERE id_usuario = ? ${filtroTipo}
       ORDER BY fecha_envio DESC, id_notificacion DESC LIMIT ?`,
      parametros,
    );
  }

  async contarNoLeidas(idUsuario) {
    const filas = await this.consultar(
      'SELECT COUNT(*) AS total FROM notificaciones WHERE id_usuario = ? AND leida = 0',
      [idUsuario],
    );
    return Number(filas[0].total);
  }

  async marcarLeida(idNotificacion, idUsuario) {
    const resultado = await this.consultar(
      'UPDATE notificaciones SET leida = 1 WHERE id_notificacion = ? AND id_usuario = ?',
      [idNotificacion, idUsuario],
    );
    return resultado.affectedRows > 0;
  }

  async marcarTodasLeidas(idUsuario) {
    const resultado = await this.consultar('UPDATE notificaciones SET leida = 1 WHERE id_usuario = ? AND leida = 0', [idUsuario]);
    return resultado.affectedRows;
  }

  async existe(idUsuario, idLote, tipo) {
    const filas = await this.consultar(
      'SELECT 1 FROM notificaciones WHERE id_usuario = ? AND id_lote = ? AND tipo = ? LIMIT 1',
      [idUsuario, idLote, tipo],
    );
    return filas.length > 0;
  }
}
