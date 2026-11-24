import { transaccion } from '../config/db.js';
import { LoteAlimentos } from '../domain/LoteAlimentos.js';
import { Usuario } from '../domain/Usuario.js';
import { EstadoHistorial, EstadoLote, EstadoRuta, RolUsuario, TipoNotificacion } from '../domain/enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import { fechaLocal, horaLocal } from '../utils/fechas.js';
import { vistaRuta } from './vistas.js';

const RADIOS_KM = [5, 10, 20, 50];
const DISTANCIA_MAXIMA_KM = 9999.99;

export class ServicioRutas {
  constructor({ repos, notificador, secretoCodigo }) {
    this.repos = repos;
    this.notificador = notificador;
    this.secretoCodigo = secretoCodigo;
  }

  #umbral() {
    return this.repos.configuracion.obtenerNumero('umbral_caducidad_horas', 6);
  }

  async #vista(fila, usuario) {
    return vistaRuta(fila, { usuario, secretoCodigo: this.secretoCodigo, umbralHoras: await this.#umbral() });
  }

  async crearDesdeLote(receptor, idLote) {
    if (receptor.rol !== RolUsuario.RECEPTOR) throw ErrorApp.prohibido('Solo los receptores aceptan lotes.');
    if (!receptor.puedeOperar()) throw ErrorApp.prohibido('Necesitas una cuenta verificada para recibir lotes.');

    const fila = await this.repos.lotes.detalle(idLote);
    if (!fila) throw ErrorApp.noEncontrado('Lote no encontrado.');
    const lote = LoteAlimentos.desdeFila(fila);
    if (lote.estado !== EstadoLote.PUBLICADO || fila.id_ruta) {
      throw ErrorApp.conflicto('Este lote ya fue aceptado por otro receptor.');
    }
    if (lote.estaCaducado()) throw ErrorApp.conflicto('El lote ya caducó.');
    if (!receptor.tieneCapacidadPara(lote.pesoKg)) {
      throw ErrorApp.conflicto(
        `Tu capacidad disponible (${receptor.capacidadKg} kg) es menor al peso del lote (${lote.pesoKg} kg). ` +
          'Actualízala en "Editar capacidad y horario".',
      );
    }

    const distanciaKm = receptor.ubicacion && lote.ubicacion
      ? Math.min(receptor.ubicacion.distanciaKm(lote.ubicacion), DISTANCIA_MAXIMA_KM)
      : null;
    const caducaHoy = lote.fechaCaducidad === fechaLocal();
    const ventanaFin = caducaHoy && lote.horaCaducidad ? lote.horaCaducidad : receptor.horarioFin;

    let idRuta;
    try {
      idRuta = await this.repos.rutas.guardar({
        id_lote: idLote,
        id_receptor: receptor.idUsuario,
        distancia_km: distanciaKm,
        ventana_recoleccion_inicio: horaLocal(),
        ventana_recoleccion_fin: ventanaFin,
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw ErrorApp.conflicto('Este lote ya fue aceptado por otro receptor.');
      throw error;
    }

    await this.notificador.enviar(
      fila.id_donante,
      `${receptor.nombre} aceptó tu lote ${lote.nombre}. Un voluntario pasará a recogerlo.`,
      { tipo: TipoNotificacion.CUENTA, idLote },
    );
    await this.#avisarVoluntarios(lote, fila.donante_nombre, receptor.nombre);
    return this.detalleParaParticipante(receptor, idRuta);
  }

  async #avisarVoluntarios(lote, nombreDonante, nombreReceptor) {
    const radio = await this.repos.configuracion.obtenerNumero('radio_voluntarios_km', 10);
    const voluntarios = (await this.repos.usuarios.voluntariosActivos()).map((f) => Usuario.desdeFila(f));
    const destinatarios = voluntarios.filter(
      (v) => v.avisarNuevosLotes && (!v.ubicacion || !lote.ubicacion || v.ubicacion.distanciaKm(lote.ubicacion) <= radio),
    );
    await this.notificador.enviarVarios(
      destinatarios.map((v) => v.idUsuario),
      `Nueva ruta disponible: ${lote.nombre} (${lote.pesoKg} kg) · ${nombreDonante} → ${nombreReceptor}`,
      { tipo: TipoNotificacion.NUEVO_LOTE, idLote: lote.idLote },
    );
  }

  async listarDisponibles(voluntario, { radioKm = null, orden = 'caducidad' } = {}) {
    const radio = RADIOS_KM.includes(Number(radioKm)) ? Number(radioKm) : null;
    const filas = await this.repos.rutas.listarDisponibles();
    const rutas = [];
    for (const fila of filas) rutas.push(await this.#vista(fila, voluntario));

    const filtradas = radio && voluntario.ubicacion
      ? rutas.filter((r) => r.distanciaVoluntarioKm !== null && r.distanciaVoluntarioKm <= radio)
      : rutas;

    if (orden === 'distancia') {
      const clave = (r) => r.distanciaVoluntarioKm ?? r.distanciaKm ?? Number.MAX_VALUE;
      filtradas.sort((a, b) => clave(a) - clave(b));
    } else {
      filtradas.sort((a, b) => a.lote.horasRestantes - b.lote.horasRestantes);
    }
    return { radioKm: radio, orden, rutas: filtradas };
  }

  async aceptar(voluntario, idRuta) {
    if (voluntario.rol !== RolUsuario.VOLUNTARIO) throw ErrorApp.prohibido('Solo los voluntarios aceptan rutas.');
    if (await this.repos.rutas.activaDeVoluntario(voluntario.idUsuario)) {
      throw ErrorApp.conflicto('Ya tienes una ruta activa. Termínala antes de aceptar otra.');
    }
    const fila = await this.repos.rutas.detalle(idRuta);
    if (!fila) throw ErrorApp.noEncontrado('Ruta no encontrada.');

    const lote = LoteAlimentos.desdeFila({
      ...fila, nombre: fila.lote_nombre, estado: fila.lote_estado,
      latitud: fila.recogida_latitud, longitud: fila.recogida_longitud,
    });
    if (lote.estaCaducado()) throw ErrorApp.conflicto('El lote de esta ruta ya caducó.');

    await transaccion(async () => {
      const asignada = await this.repos.rutas.asignarVoluntarioSiDisponible(idRuta, voluntario.idUsuario);
      if (!asignada) throw ErrorApp.conflicto('La ruta ya fue tomada por otro voluntario.');
      const loteOk = await this.repos.lotes.cambiarEstadoSi(fila.id_lote, EstadoLote.PUBLICADO, EstadoLote.EN_RECOLECCION);
      if (!loteOk) throw ErrorApp.conflicto('El lote ya no está disponible.');
      await this.repos.historial.registrarParticipantes({
        idLote: fila.id_lote,
        idDonante: fila.id_donante,
        idReceptor: fila.id_receptor,
        idVoluntario: voluntario.idUsuario,
        estado: EstadoHistorial.EN_RECOLECCION,
      });
    });

    await this.notificador.enviarVarios(
      [fila.id_donante, fila.id_receptor],
      `${voluntario.nombre} aceptó la ruta de ${fila.lote_nombre} y va en camino a recogerlo.`,
      { tipo: TipoNotificacion.CUENTA, idLote: fila.id_lote },
    );
    return this.rutaActiva(voluntario);
  }

  async rutaActiva(voluntario) {
    const fila = await this.repos.rutas.activaDeVoluntario(voluntario.idUsuario);
    if (!fila) return null;
    return this.#vista(fila, voluntario);
  }

  async misRecepciones(receptor) {
    if (receptor.rol !== RolUsuario.RECEPTOR) throw ErrorApp.prohibido();
    const filas = await this.repos.rutas.listarPorReceptor(receptor.idUsuario);
    const vistas = [];
    for (const fila of filas) vistas.push(await this.#vista(fila, receptor));
    return vistas;
  }

  async detalleParaParticipante(usuario, idRuta) {
    const fila = await this.repos.rutas.detalle(idRuta);
    if (!fila) throw ErrorApp.noEncontrado('Ruta no encontrada.');
    const esAdmin = usuario.rol === RolUsuario.ADMINISTRADOR;
    const participa = [fila.id_donante, fila.id_receptor, fila.id_voluntario].includes(usuario.idUsuario);
    const esVoluntarioViendoDisponible = usuario.rol === RolUsuario.VOLUNTARIO && fila.estado === EstadoRuta.DISPONIBLE;
    if (!esAdmin && !participa && !esVoluntarioViendoDisponible) throw ErrorApp.prohibido();
    return this.#vista(fila, usuario);
  }
}
