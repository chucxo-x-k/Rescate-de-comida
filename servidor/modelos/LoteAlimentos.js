import { Ubicacion } from './Ubicacion.js';
import { EstadoLote } from './enumeraciones.js';
import { ErrorApp } from '../utilidades/ErrorAplicacion.js';

const TRANSICIONES = Object.freeze({
  [EstadoLote.PUBLICADO]: [EstadoLote.EN_RECOLECCION, EstadoLote.CANCELADO, EstadoLote.CADUCADO],
  [EstadoLote.EN_RECOLECCION]: [EstadoLote.ENTREGADO, EstadoLote.CANCELADO],
  [EstadoLote.ENTREGADO]: [],
  [EstadoLote.CANCELADO]: [],
  [EstadoLote.CADUCADO]: [],
});

const MS_POR_HORA = 3_600_000;

export class LoteAlimentos {
  constructor(datos) {
    this.idLote = datos.id_lote ?? null;
    this.idDonante = datos.id_donante;
    this.idCategoria = datos.id_categoria;
    this.categoria = datos.categoria ?? null;
    this.nombre = datos.nombre;
    this.descripcion = datos.descripcion;
    this.pesoKg = Number(datos.peso_kg);
    this.fechaCaducidad = datos.fecha_caducidad;
    this.horaCaducidad = datos.hora_caducidad ?? null;
    this.direccionRecogida = datos.direccion_recogida;
    this.ubicacion = Ubicacion.desde(datos.latitud, datos.longitud, datos.direccion_recogida);
    this.declaracionBuenaFe = Boolean(datos.declaracion_buena_fe);
    this.estado = datos.estado ?? EstadoLote.PUBLICADO;
    this.fechaPublicacion = datos.fecha_publicacion ?? null;
  }

  static desdeFila(fila) {
    return new LoteAlimentos(fila);
  }

  get momentoCaducidad() {
    const hora = this.horaCaducidad ? this.horaCaducidad.slice(0, 8).padEnd(8, ':00') : '23:59:59';
    return new Date(`${this.fechaCaducidad}T${hora}`);
  }

  horasRestantes(ahora = new Date()) {
    return (this.momentoCaducidad.getTime() - ahora.getTime()) / MS_POR_HORA;
  }

  estaCaducado(ahora = new Date()) {
    return this.horasRestantes(ahora) <= 0;
  }

  estaProximoAVencer(umbralHoras, ahora = new Date()) {
    const restantes = this.horasRestantes(ahora);
    return restantes > 0 && restantes <= umbralHoras;
  }

  esNuevo(horasNuevo, ahora = new Date()) {
    if (!this.fechaPublicacion) return false;
    const publicado = new Date(this.fechaPublicacion.replace(' ', 'T'));
    return (ahora.getTime() - publicado.getTime()) / MS_POR_HORA <= horasNuevo;
  }

  puedeCambiarA(nuevoEstado) {
    return TRANSICIONES[this.estado]?.includes(nuevoEstado) ?? false;
  }

  cambiarEstado(nuevoEstado) {
    if (!this.puedeCambiarA(nuevoEstado)) {
      throw ErrorApp.conflicto(`El lote no puede pasar de ${this.estado} a ${nuevoEstado}.`);
    }
    this.estado = nuevoEstado;
    return this;
  }

  static validarNuevo(datos, ahora = new Date()) {
    const errores = {};
    if (!datos.nombre || datos.nombre.length > 100) errores.nombre = 'Escribe un nombre corto (máximo 100 caracteres).';
    if (!datos.descripcion) errores.descripcion = 'Describe qué es, su estado y empaque.';
    if (!datos.id_categoria) errores.id_categoria = 'Selecciona una categoría.';
    if (!(Number(datos.peso_kg) > 0) || Number(datos.peso_kg) > 999999.99) errores.peso_kg = 'El peso debe ser mayor a 0 kg.';
    if (!datos.fecha_caducidad) errores.fecha_caducidad = 'Indica la fecha de caducidad.';
    if (!datos.direccion_recogida) errores.direccion_recogida = 'Indica la dirección de recogida.';
    if (!Ubicacion.coordenadasValidas(datos.latitud, datos.longitud)) {
      errores.ubicacion = 'Marca el punto de recogida en el mapa o usa tu ubicación.';
    }
    if (!datos.declaracion_buena_fe) {
      errores.declaracion_buena_fe = 'Debes declarar de buena fe que los alimentos son aptos y aceptar el deslinde.';
    }
    if (!errores.fecha_caducidad) {
      const lote = new LoteAlimentos({ ...datos, estado: EstadoLote.PUBLICADO });
      if (Number.isNaN(lote.momentoCaducidad.getTime())) errores.fecha_caducidad = 'Fecha u hora de caducidad inválida.';
      else if (lote.estaCaducado(ahora)) errores.fecha_caducidad = 'La fecha y hora de caducidad ya pasaron.';
    }
    return errores;
  }

  toJSON() {
    return {
      idLote: this.idLote,
      idDonante: this.idDonante,
      idCategoria: this.idCategoria,
      categoria: this.categoria,
      nombre: this.nombre,
      descripcion: this.descripcion,
      pesoKg: this.pesoKg,
      fechaCaducidad: this.fechaCaducidad,
      horaCaducidad: this.horaCaducidad,
      direccionRecogida: this.direccionRecogida,
      latitud: this.ubicacion?.latitud ?? null,
      longitud: this.ubicacion?.longitud ?? null,
      declaracionBuenaFe: this.declaracionBuenaFe,
      estado: this.estado,
      fechaPublicacion: this.fechaPublicacion,
      horasRestantes: Math.round(this.horasRestantes() * 10) / 10,
    };
  }
}
