import { AHORA, transaccion } from '../config/db.js';
import { SolicitudVerificacion, NOMBRES_DOCUMENTO } from '../domain/SolicitudVerificacion.js';
import {
  EstadoDocumento, EstadoSolicitud, EstadoVerificacion, RolUsuario, TipoNotificacion,
} from '../domain/enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import { texto } from '../utils/validacion.js';

export class ServicioVerificacion {
  constructor({ repos, almacenamiento, notificador }) {
    this.repos = repos;
    this.almacenamiento = almacenamiento;
    this.notificador = notificador;
  }

  async #cargar(filaSolicitud) {
    const documentos = await this.repos.documentos.porSolicitud(filaSolicitud.id_solicitud);
    return new SolicitudVerificacion(filaSolicitud, documentos);
  }

  async #solicitudEditable(usuario) {
    const ultima = await this.repos.solicitudes.ultimaDeUsuario(usuario.idUsuario);
    if (ultima?.estado === EstadoSolicitud.BORRADOR) return ultima.id_solicitud;
    if (ultima && ultima.estado !== EstadoSolicitud.RECHAZADA) {
      throw ErrorApp.conflicto('Tu solicitud ya está en revisión o fue aprobada.');
    }

    const idNueva = await this.repos.solicitudes.guardar({ id_usuario: usuario.idUsuario, estado: EstadoSolicitud.BORRADOR });
    if (ultima) {
      const anteriores = await this.repos.documentos.porSolicitud(ultima.id_solicitud);
      for (const doc of anteriores.filter((d) => d.estado === EstadoDocumento.CARGADO)) {
        await this.repos.documentos.guardar({
          id_solicitud: idNueva,
          tipo_documento: doc.tipo_documento,
          url_archivo: doc.url_archivo,
          estado: EstadoDocumento.CARGADO,
          fecha_carga: doc.fecha_carga,
        });
      }
    }
    return idNueva;
  }

  #exigirRolConVerificacion(usuario) {
    if (!usuario.requiereVerificacion()) {
      throw ErrorApp.solicitudInvalida('La verificación aplica solo a donantes y receptores.');
    }
  }

  async obtenerSolicitudActual(usuario) {
    this.#exigirRolConVerificacion(usuario);
    const perfil = await this.repos.usuarios.buscarPorId(usuario.idUsuario);
    const fila = await this.repos.solicitudes.ultimaDeUsuario(usuario.idUsuario);
    const solicitud = fila ? await this.#cargar(fila) : null;

    const documentos = SolicitudVerificacion.documentosRequeridos(usuario.rol).map((tipo) => {
      const doc = solicitud?.documentos.find((d) => d.tipo === tipo);
      return {
        tipo,
        nombre: NOMBRES_DOCUMENTO[tipo],
        estado: doc?.estaCargado() ? EstadoDocumento.CARGADO : EstadoDocumento.PENDIENTE,
        idDocumento: doc?.idDocumento ?? null,
        fechaCarga: doc?.fechaCarga ?? null,
      };
    });

    return {
      estadoVerificacion: perfil.estado_verificacion,
      solicitud: solicitud
        ? {
            idSolicitud: solicitud.idSolicitud,
            estado: solicitud.estado,
            observaciones: solicitud.observaciones,
            fechaEnvio: solicitud.fechaEnvio,
            fechaRevision: solicitud.fechaRevision,
          }
        : null,
      documentos,
      editable: !solicitud || [EstadoSolicitud.BORRADOR, EstadoSolicitud.RECHAZADA].includes(solicitud.estado),
    };
  }

  async subirDocumento(usuario, tipo, archivo) {
    this.#exigirRolConVerificacion(usuario);
    if (!SolicitudVerificacion.documentosRequeridos(usuario.rol).includes(tipo)) {
      throw ErrorApp.solicitudInvalida('Ese tipo de documento no aplica a tu cuenta.');
    }
    if (!archivo) throw ErrorApp.solicitudInvalida('Adjunta un archivo PDF o imagen.');

    const ultima = await this.repos.solicitudes.ultimaDeUsuario(usuario.idUsuario);
    if (ultima && ![EstadoSolicitud.BORRADOR, EstadoSolicitud.RECHAZADA].includes(ultima.estado)) {
      throw ErrorApp.conflicto('Tu solicitud ya está en revisión o fue aprobada.');
    }

    const clave = await this.almacenamiento.subir(archivo, 'documentos');
    await transaccion(async () => {
      const idSolicitud = await this.#solicitudEditable(usuario);
      const existente = await this.repos.documentos.buscarPorTipo(idSolicitud, tipo);
      const datos = { url_archivo: clave, estado: EstadoDocumento.CARGADO, fecha_carga: AHORA };
      if (existente) await this.repos.documentos.actualizar(existente.id_documento, datos);
      else await this.repos.documentos.guardar({ id_solicitud: idSolicitud, tipo_documento: tipo, ...datos });
      if (usuario.estadoVerificacion === EstadoVerificacion.RECHAZADO) {
        await this.repos.usuarios.actualizar(usuario.idUsuario, { estado_verificacion: EstadoVerificacion.NO_VERIFICADO });
      }
    });
    return this.obtenerSolicitudActual(usuario);
  }

  async guardarBorrador(usuario) {
    this.#exigirRolConVerificacion(usuario);
    await transaccion(() => this.#solicitudEditable(usuario));
    return this.obtenerSolicitudActual(usuario);
  }

  async solicitar(usuario) {
    this.#exigirRolConVerificacion(usuario);
    await transaccion(async () => {
      const idSolicitud = await this.#solicitudEditable(usuario);
      const solicitud = await this.#cargar(await this.repos.solicitudes.buscarPorId(idSolicitud));
      solicitud.marcarParaRevision(usuario.rol);
      await this.repos.solicitudes.actualizar(solicitud.idSolicitud, {
        estado: solicitud.estado,
        fecha_envio: AHORA,
        observaciones: null,
      });
      await this.repos.usuarios.actualizar(usuario.idUsuario, { estado_verificacion: EstadoVerificacion.EN_REVISION });
    });

    const admins = await this.repos.usuarios.administradores();
    await this.notificador.enviarVarios(
      admins.map((a) => a.id_usuario),
      `${usuario.nombre} envió documentos para verificación.`,
      { tipo: TipoNotificacion.CUENTA },
    );
    return this.obtenerSolicitudActual(usuario);
  }

  async listarPendientes() {
    const filas = await this.repos.solicitudes.pendientes();
    const documentos = await this.repos.documentos.porSolicitudes(filas.map((f) => f.id_solicitud));
    return filas.map((f) => this.#vistaAdmin(f, documentos.filter((d) => d.id_solicitud === f.id_solicitud)));
  }

  async detalle(idSolicitud) {
    const fila = await this.repos.solicitudes.detalle(idSolicitud);
    if (!fila) throw ErrorApp.noEncontrado('Solicitud no encontrada.');
    const documentos = await this.repos.documentos.porSolicitud(idSolicitud);
    return this.#vistaAdmin(fila, documentos);
  }

  #vistaAdmin(fila, documentos) {
    const solicitud = new SolicitudVerificacion(fila, documentos);
    return {
      ...solicitud.toJSON(),
      documentos: solicitud.documentos.map((d) => ({ ...d.toJSON(), urlArchivo: undefined })),
      usuario: {
        idUsuario: fila.id_usuario,
        nombre: fila.usuario_nombre,
        correo: fila.usuario_correo,
        rol: fila.usuario_rol,
        telefono: fila.usuario_telefono,
        direccion: fila.usuario_direccion,
      },
    };
  }

  async actualizarEstatus(administrador, idSolicitud, aprobar, observaciones) {
    if (administrador.rol !== RolUsuario.ADMINISTRADOR) throw ErrorApp.prohibido();
    const obs = texto(observaciones) || null;

    const solicitud = await transaccion(async () => {
      const fila = await this.repos.solicitudes.buscarPorId(idSolicitud);
      if (!fila) throw ErrorApp.noEncontrado('Solicitud no encontrada.');
      const s = administrador.revisarSolicitud(await this.#cargar(fila), Boolean(aprobar), obs);
      await this.repos.solicitudes.actualizar(s.idSolicitud, {
        estado: s.estado,
        observaciones: s.observaciones,
        id_administrador: s.idAdministrador,
        fecha_revision: AHORA,
      });
      await this.repos.usuarios.actualizar(s.idUsuario, {
        estado_verificacion: aprobar ? EstadoVerificacion.VERIFICADO : EstadoVerificacion.RECHAZADO,
      });
      return s;
    });

    const mensaje = aprobar
      ? 'Tu organización fue verificada. Ya puedes publicar o recibir lotes.'
      : `Tu solicitud de verificación fue rechazada: ${obs}`;
    await this.notificador.enviar(solicitud.idUsuario, mensaje, { tipo: TipoNotificacion.CUENTA });
    return this.detalle(idSolicitud);
  }

  async archivoDocumento(usuario, idDocumento) {
    const doc = await this.repos.documentos.buscarPorId(idDocumento);
    if (!doc?.url_archivo) throw ErrorApp.noEncontrado('Documento no encontrado.');
    const solicitud = await this.repos.solicitudes.buscarPorId(doc.id_solicitud);
    const autorizado = usuario.rol === RolUsuario.ADMINISTRADOR || solicitud?.id_usuario === usuario.idUsuario;
    if (!autorizado) throw ErrorApp.prohibido();
    return this.almacenamiento.leer(doc.url_archivo);
  }
}
