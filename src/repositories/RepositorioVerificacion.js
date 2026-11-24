import { RepositorioSQL } from './RepositorioSQL.js';

export class RepositorioSolicitudes extends RepositorioSQL {
  constructor() {
    super('solicitudes_verificacion', 'id_solicitud', [
      'id_solicitud', 'id_usuario', 'id_administrador', 'estado', 'observaciones', 'fecha_envio', 'fecha_revision',
    ]);
  }

  async ultimaDeUsuario(idUsuario) {
    const filas = await this.buscar({ id_usuario: idUsuario }, { orden: 'id_solicitud DESC', limite: 1 });
    return filas[0] ?? null;
  }

  pendientes() {
    return this.consultar(
      `SELECT s.*, u.nombre AS usuario_nombre, u.correo AS usuario_correo, u.rol AS usuario_rol,
              u.telefono AS usuario_telefono, u.direccion AS usuario_direccion
       FROM solicitudes_verificacion s
       JOIN usuarios u ON u.id_usuario = s.id_usuario
       WHERE s.estado = 'EN_REVISION'
       ORDER BY s.fecha_envio ASC`,
    );
  }

  async detalle(idSolicitud) {
    const filas = await this.consultar(
      `SELECT s.*, u.nombre AS usuario_nombre, u.correo AS usuario_correo, u.rol AS usuario_rol,
              u.telefono AS usuario_telefono, u.direccion AS usuario_direccion
       FROM solicitudes_verificacion s
       JOIN usuarios u ON u.id_usuario = s.id_usuario
       WHERE s.id_solicitud = ? LIMIT 1`,
      [idSolicitud],
    );
    return filas[0] ?? null;
  }
}

export class RepositorioDocumentos extends RepositorioSQL {
  constructor() {
    super('documentos_verificacion', 'id_documento', [
      'id_documento', 'id_solicitud', 'tipo_documento', 'url_archivo', 'estado', 'fecha_carga',
    ]);
  }

  porSolicitud(idSolicitud) {
    return this.buscar({ id_solicitud: idSolicitud }, { orden: 'id_documento ASC' });
  }

  porSolicitudes(idsSolicitud) {
    if (idsSolicitud.length === 0) return Promise.resolve([]);
    return this.consultar('SELECT * FROM documentos_verificacion WHERE id_solicitud IN (?) ORDER BY id_documento', [idsSolicitud]);
  }

  buscarPorTipo(idSolicitud, tipo) {
    return this.buscarUno({ id_solicitud: idSolicitud, tipo_documento: tipo });
  }
}
