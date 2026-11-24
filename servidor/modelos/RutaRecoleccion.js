import { createHmac } from 'node:crypto';
import { EstadoRuta } from './enumeraciones.js';
import { ErrorApp } from '../utilidades/ErrorAplicacion.js';

const TRANSICIONES = Object.freeze({
  [EstadoRuta.DISPONIBLE]: [EstadoRuta.EN_RECOLECCION, EstadoRuta.CANCELADA],
  [EstadoRuta.EN_RECOLECCION]: [EstadoRuta.EN_CAMINO, EstadoRuta.CANCELADA],
  [EstadoRuta.EN_CAMINO]: [EstadoRuta.ENTREGADA, EstadoRuta.CANCELADA],
  [EstadoRuta.ENTREGADA]: [],
  [EstadoRuta.CANCELADA]: [],
});

export class RutaRecoleccion {
  constructor(datos) {
    this.idRuta = datos.id_ruta ?? null;
    this.idLote = datos.id_lote;
    this.idReceptor = datos.id_receptor;
    this.idVoluntario = datos.id_voluntario ?? null;
    this.distanciaKm = datos.distancia_km === null || datos.distancia_km === undefined ? null : Number(datos.distancia_km);
    this.ventanaInicio = datos.ventana_recoleccion_inicio ?? null;
    this.ventanaFin = datos.ventana_recoleccion_fin ?? null;
    this.estado = datos.estado ?? EstadoRuta.DISPONIBLE;
    this.fechaAceptacion = datos.fecha_aceptacion ?? null;
    this.fechaCierre = datos.fecha_cierre ?? null;
  }

  static desdeFila(fila) {
    return new RutaRecoleccion(fila);
  }

  static codigoEsperado(idRuta, secreto) {
    const hmac = createHmac('sha256', secreto).update(`ruta:${idRuta}`).digest();
    return String(hmac.readUInt32BE(0) % 1_000_000).padStart(6, '0');
  }

  estaDisponible() {
    return this.estado === EstadoRuta.DISPONIBLE && this.idVoluntario === null;
  }

  estaActiva() {
    return this.estado === EstadoRuta.EN_RECOLECCION || this.estado === EstadoRuta.EN_CAMINO;
  }

  esParticipante(idUsuario, idDonante) {
    return [this.idReceptor, this.idVoluntario, idDonante].includes(idUsuario);
  }

  cambiarEstado(nuevoEstado) {
    if (!TRANSICIONES[this.estado]?.includes(nuevoEstado)) {
      throw ErrorApp.conflicto(`La ruta no puede pasar de ${this.estado} a ${nuevoEstado}.`);
    }
    this.estado = nuevoEstado;
    return this;
  }

  asignarVoluntario(idVoluntario) {
    if (!this.estaDisponible()) throw ErrorApp.conflicto('La ruta ya fue tomada por otro voluntario.');
    this.cambiarEstado(EstadoRuta.EN_RECOLECCION);
    this.idVoluntario = idVoluntario;
    return this;
  }

  toJSON() {
    return {
      idRuta: this.idRuta,
      idLote: this.idLote,
      idReceptor: this.idReceptor,
      idVoluntario: this.idVoluntario,
      distanciaKm: this.distanciaKm,
      ventanaInicio: this.ventanaInicio,
      ventanaFin: this.ventanaFin,
      estado: this.estado,
      fechaAceptacion: this.fechaAceptacion,
      fechaCierre: this.fechaCierre,
    };
  }
}
