import { EstadoDocumento, EstadoSolicitud, RolUsuario, TipoDocumento } from './enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';

export const NOMBRES_DOCUMENTO = Object.freeze({
  [TipoDocumento.IDENTIFICACION_OFICIAL]: 'Identificación oficial',
  [TipoDocumento.IDENTIFICACION_FISCAL]: 'Identificación fiscal (RFC)',
  [TipoDocumento.PERMISO_SANITARIO]: 'Permiso sanitario',
  [TipoDocumento.CONSTANCIA_ORGANIZACION]: 'Constancia de organización (receptores)',
});

export class DocumentoVerificacion {
  constructor(datos) {
    this.idDocumento = datos.id_documento ?? null;
    this.tipo = datos.tipo_documento;
    this.urlArchivo = datos.url_archivo ?? null;
    this.estado = datos.estado ?? EstadoDocumento.PENDIENTE;
    this.fechaCarga = datos.fecha_carga ?? null;
  }

  estaCargado() {
    return this.estado === EstadoDocumento.CARGADO && Boolean(this.urlArchivo);
  }

  toJSON() {
    return {
      idDocumento: this.idDocumento,
      tipo: this.tipo,
      nombre: NOMBRES_DOCUMENTO[this.tipo],
      urlArchivo: this.urlArchivo,
      estado: this.estado,
      fechaCarga: this.fechaCarga,
    };
  }
}

export class SolicitudVerificacion {
  constructor(datos, documentos = []) {
    this.idSolicitud = datos.id_solicitud ?? null;
    this.idUsuario = datos.id_usuario;
    this.idAdministrador = datos.id_administrador ?? null;
    this.estado = datos.estado ?? EstadoSolicitud.BORRADOR;
    this.observaciones = datos.observaciones ?? null;
    this.fechaEnvio = datos.fecha_envio ?? null;
    this.fechaRevision = datos.fecha_revision ?? null;
    this.documentos = documentos.map((d) => (d instanceof DocumentoVerificacion ? d : new DocumentoVerificacion(d)));
  }

  static documentosRequeridos(rol) {
    const base = [TipoDocumento.IDENTIFICACION_OFICIAL, TipoDocumento.IDENTIFICACION_FISCAL, TipoDocumento.PERMISO_SANITARIO];
    return rol === RolUsuario.RECEPTOR ? [...base, TipoDocumento.CONSTANCIA_ORGANIZACION] : base;
  }

  esEditable() {
    return this.estado === EstadoSolicitud.BORRADOR;
  }

  documentosFaltantes(rol) {
    return SolicitudVerificacion.documentosRequeridos(rol).filter(
      (tipo) => !this.documentos.some((d) => d.tipo === tipo && d.estaCargado()),
    );
  }

  marcarParaRevision(rol) {
    if (!this.esEditable()) throw ErrorApp.conflicto('La solicitud ya fue enviada.');
    const faltantes = this.documentosFaltantes(rol);
    if (faltantes.length > 0) {
      throw ErrorApp.solicitudInvalida('Faltan documentos por subir.', {
        documentos: faltantes.map((t) => NOMBRES_DOCUMENTO[t]).join(', '),
      });
    }
    this.estado = EstadoSolicitud.EN_REVISION;
    return this;
  }

  resolver(aprobar, observaciones, idAdministrador) {
    if (this.estado !== EstadoSolicitud.EN_REVISION) {
      throw ErrorApp.conflicto('Solo se pueden resolver solicitudes en revisión.');
    }
    if (!aprobar && !observaciones) {
      throw ErrorApp.solicitudInvalida('Escribe el motivo del rechazo en observaciones.');
    }
    this.estado = aprobar ? EstadoSolicitud.APROBADA : EstadoSolicitud.RECHAZADA;
    this.observaciones = observaciones || null;
    this.idAdministrador = idAdministrador;
    return this;
  }

  toJSON() {
    return {
      idSolicitud: this.idSolicitud,
      idUsuario: this.idUsuario,
      idAdministrador: this.idAdministrador,
      estado: this.estado,
      observaciones: this.observaciones,
      fechaEnvio: this.fechaEnvio,
      fechaRevision: this.fechaRevision,
      documentos: this.documentos.map((d) => d.toJSON()),
    };
  }
}
