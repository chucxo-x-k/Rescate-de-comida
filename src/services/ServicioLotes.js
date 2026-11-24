import { transaccion } from '../config/db.js';
import { LoteAlimentos } from '../domain/LoteAlimentos.js';
import { EstadoLote, EstadoRuta, RolUsuario, TipoNotificacion } from '../domain/enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import { aBooleano, aNumero, entero, exigir, normalizarHora, texto } from '../utils/validacion.js';
import { vistaLote } from './vistas.js';

const MAX_FOTOS = 6;
const RADIOS_KM = [2, 5, 10, 20, 50];

export class ServicioLotes {
  constructor({ repos, almacenamiento, emparejamiento, notificador }) {
    this.repos = repos;
    this.almacenamiento = almacenamiento;
    this.emparejamiento = emparejamiento;
    this.notificador = notificador;
  }

  async #parametros() {
    const [umbralHoras, horasNuevo] = await Promise.all([
      this.repos.configuracion.obtenerNumero('umbral_caducidad_horas', 6),
      this.repos.configuracion.obtenerNumero('horas_lote_nuevo', 2),
    ]);
    return { umbralHoras, horasNuevo };
  }

  async publicar(donante, datos, fotos = []) {
    if (donante.rol !== RolUsuario.DONANTE) throw ErrorApp.prohibido('Solo los donantes publican lotes.');
    if (!donante.puedeOperar()) {
      throw ErrorApp.prohibido('Necesitas una cuenta verificada para publicar lotes.');
    }

    const fila = {
      id_donante: donante.idUsuario,
      id_categoria: entero(datos.idCategoria),
      nombre: texto(datos.nombre),
      descripcion: texto(datos.descripcion),
      peso_kg: aNumero(datos.pesoKg),
      fecha_caducidad: texto(datos.fechaCaducidad),
      hora_caducidad: normalizarHora(datos.horaCaducidad),
      direccion_recogida: texto(datos.direccionRecogida),
      latitud: aNumero(datos.latitud),
      longitud: aNumero(datos.longitud),
      declaracion_buena_fe: aBooleano(datos.declaracionBuenaFe),
    };

    const errores = LoteAlimentos.validarNuevo(fila);
    if (fotos.length < 1) errores.fotos = 'Adjunta al menos una fotografía del alimento.';
    if (fotos.length > MAX_FOTOS) errores.fotos = `Máximo ${MAX_FOTOS} fotografías.`;
    if (fila.id_categoria && !(await this.repos.categorias.buscarPorId(fila.id_categoria))) {
      errores.id_categoria = 'Categoría inexistente.';
    }
    exigir(errores);

    const urls = [];
    for (const foto of fotos) urls.push(await this.almacenamiento.subir(foto, 'lotes'));

    const idLote = await transaccion(async () => {
      const id = await this.repos.lotes.guardar({ ...fila, declaracion_buena_fe: 1, estado: EstadoLote.PUBLICADO });
      for (const [i, url] of urls.entries()) {
        await this.repos.fotosLote.guardar({ id_lote: id, url_foto: url, es_principal: i === 0 ? 1 : 0 });
      }
      return id;
    });

    const lote = LoteAlimentos.desdeFila(await this.repos.lotes.buscarPorId(idLote));
    const sugerencias = await this.emparejamiento.ejecutar(lote, donante);
    return { lote: await this.detalle(idLote, donante), receptoresNotificados: sugerencias.length };
  }

  async listarActivos(usuario = null) {
    const params = await this.#parametros();
    const filas = await this.repos.lotes.listarActivos();
    return filas.map((f) => vistaLote(f, { usuario, ...params }));
  }

  async misLotes(donante) {
    const params = await this.#parametros();
    const [filas, contadores] = await Promise.all([
      this.repos.lotes.listarPorDonante(donante.idUsuario),
      this.repos.lotes.contadoresDonante(donante.idUsuario, params.umbralHoras),
    ]);
    return {
      contadores: {
        activos: Number(contadores.activos),
        entregados: Number(contadores.entregados),
        porCaducar: Number(contadores.por_caducar),
      },
      lotes: filas.map((f) => vistaLote(f, { usuario: donante, ...params })),
    };
  }

  async cercanos(receptor, { radioKm = 5, orden = 'cercano' } = {}) {
    if (receptor.rol !== RolUsuario.RECEPTOR) throw ErrorApp.prohibido();
    if (!receptor.ubicacion) {
      throw ErrorApp.solicitudInvalida('Registra tu ubicación en Perfil para ver lotes cercanos.');
    }
    const radio = RADIOS_KM.includes(Number(radioKm)) ? Number(radioKm) : 5;
    const params = await this.#parametros();
    const filas = await this.repos.lotes.listarDisponiblesSinReclamar();
    const lotes = filas
      .map((f) => vistaLote(f, { usuario: receptor, ...params }))
      .filter((l) => l.distanciaKm !== null && l.distanciaKm <= radio);

    if (orden === 'caducidad') lotes.sort((a, b) => a.horasRestantes - b.horasRestantes);
    else lotes.sort((a, b) => a.distanciaKm - b.distanciaKm);
    return { radioKm: radio, orden, lotes };
  }

  async detalle(idLote, usuario) {
    const fila = await this.repos.lotes.detalle(idLote);
    if (!fila) throw ErrorApp.noEncontrado('Lote no encontrado.');
    const params = await this.#parametros();
    const vista = vistaLote(fila, { usuario, ...params });
    const fotos = await this.repos.fotosLote.porLote(idLote);

    const esAdmin = usuario.rol === RolUsuario.ADMINISTRADOR;
    const esDueno = fila.id_donante === usuario.idUsuario;
    const participa = esAdmin || esDueno || [fila.id_receptor, fila.id_voluntario].includes(usuario.idUsuario);

    if (!participa && fila.estado !== EstadoLote.PUBLICADO) {
      throw ErrorApp.prohibido('Este lote ya no está disponible.');
    }

    let evidencia = null;
    if (participa && fila.ruta_estado === EstadoRuta.ENTREGADA) {
      const ev = await this.repos.evidencias.buscarPorRuta(fila.id_ruta);
      if (ev) {
        const fotosEv = await this.repos.fotosEvidencia.porEvidencia(ev.id_evidencia);
        evidencia = {
          fechaRegistro: ev.fecha_registro,
          firmaDigital: ev.firma_digital,
          conCodigo: Boolean(ev.codigo_confirmacion),
          fotos: fotosEv.map((f) => f.url_foto),
        };
      }
    }

    const sinReclamar = !fila.id_ruta;
    return {
      ...vista,
      fotos: fotos.map((f) => f.url_foto),
      donante: { ...vista.donante, telefono: participa && !sinReclamar ? fila.donante_telefono : null },
      evidencia,
      esDueno,
      participa,
      puedeAceptar:
        usuario.rol === RolUsuario.RECEPTOR &&
        fila.estado === EstadoLote.PUBLICADO &&
        sinReclamar &&
        vista.horasRestantes > 0,
      puedeCancelar: (esDueno || esAdmin) && fila.estado === EstadoLote.PUBLICADO,
    };
  }

  async cancelar(usuario, idLote) {
    const fila = await this.repos.lotes.detalle(idLote);
    if (!fila) throw ErrorApp.noEncontrado('Lote no encontrado.');
    const esDueno = fila.id_donante === usuario.idUsuario;
    if (!esDueno && usuario.rol !== RolUsuario.ADMINISTRADOR) throw ErrorApp.prohibido();

    await transaccion(async () => {
      const ok = await this.repos.lotes.cambiarEstadoSi(idLote, EstadoLote.PUBLICADO, EstadoLote.CANCELADO);
      if (!ok) throw ErrorApp.conflicto('Solo se pueden cancelar lotes que aún no se recolectan.');
      if (fila.id_ruta) {
        await this.repos.rutas.cambiarEstadoSi(fila.id_ruta, EstadoRuta.DISPONIBLE, EstadoRuta.CANCELADA, { cerrar: true });
      }
    });

    if (fila.id_receptor) {
      await this.notificador.enviar(fila.id_receptor, `El lote ${fila.nombre} fue cancelado por el donante.`, {
        tipo: TipoNotificacion.CUENTA,
        idLote,
      });
    }
    return this.detalle(idLote, usuario);
  }

  async listarParaAdmin(administrador, { estado = null } = {}) {
    const valido = Object.values(EstadoLote).includes(estado) ? estado : null;
    const params = await this.#parametros();
    const filas = await this.repos.lotes.listarTodos({ estado: valido });
    return filas.map((f) => vistaLote(f, { usuario: administrador, ...params }));
  }
}
