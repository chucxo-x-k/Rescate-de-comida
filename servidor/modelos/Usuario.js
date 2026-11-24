import { Ubicacion } from './Ubicacion.js';
import { EstadoRuta, EstadoVerificacion, ROLES_CON_VERIFICACION, RolUsuario } from './enumeraciones.js';

export class Usuario {
  constructor(datos) {
    if (new.target === Usuario) {
      throw new TypeError('Usuario es abstracta; usa Usuario.desdeFila().');
    }
    this.idUsuario = datos.id_usuario;
    this.nombre = datos.nombre;
    this.correo = datos.correo;
    this.telefono = datos.telefono;
    this.rol = datos.rol;
    this.direccion = datos.direccion;
    this.ubicacion = Ubicacion.desde(datos.latitud, datos.longitud, datos.direccion);
    this.estadoVerificacion = datos.estado_verificacion ?? EstadoVerificacion.NO_VERIFICADO;
    this.indiceConfiabilidad = Number(datos.indice_confiabilidad ?? 0);
    this.avisarNuevosLotes = Boolean(datos.avisar_nuevos_lotes ?? 1);
    this.avisarCaducidades = Boolean(datos.avisar_caducidades ?? 1);
    this.activo = Boolean(datos.activo ?? 1);
    this.fechaRegistro = datos.fecha_registro ?? null;
  }

  static desdeFila(fila) {
    switch (fila.rol) {
      case RolUsuario.DONANTE: return new Donante(fila);
      case RolUsuario.RECEPTOR: return new Receptor(fila);
      case RolUsuario.VOLUNTARIO: return new VoluntarioLogistico(fila);
      case RolUsuario.ADMINISTRADOR: return new Administrador(fila);
      default: throw new TypeError(`Rol desconocido: ${fila.rol}`);
    }
  }

  requiereVerificacion() {
    return ROLES_CON_VERIFICACION.includes(this.rol);
  }

  estaVerificado() {
    return this.estadoVerificacion === EstadoVerificacion.VERIFICADO;
  }

  puedeOperar() {
    return this.activo && (!this.requiereVerificacion() || this.estaVerificado());
  }

  toJSON() {
    return {
      idUsuario: this.idUsuario,
      nombre: this.nombre,
      correo: this.correo,
      telefono: this.telefono,
      rol: this.rol,
      direccion: this.direccion,
      latitud: this.ubicacion?.latitud ?? null,
      longitud: this.ubicacion?.longitud ?? null,
      estadoVerificacion: this.estadoVerificacion,
      requiereVerificacion: this.requiereVerificacion(),
      indiceConfiabilidad: this.indiceConfiabilidad,
      avisarNuevosLotes: this.avisarNuevosLotes,
      avisarCaducidades: this.avisarCaducidades,
      activo: this.activo,
      fechaRegistro: this.fechaRegistro,
    };
  }
}

export class Donante extends Usuario {
  esDuenoDe(lote) {
    return lote.idDonante === this.idUsuario;
  }
}

export class Receptor extends Usuario {
  constructor(datos) {
    super(datos);
    this.recibiendoLotes = Boolean(datos.recibiendo_lotes ?? 0);
    this.capacidadKg = Number(datos.capacidad_kg ?? 0);
    this.radioCoberturaKm = Number(datos.radio_cobertura_km ?? 5);
    this.horarioInicio = datos.horario_inicio ?? null;
    this.horarioFin = datos.horario_fin ?? null;
  }

  estaDisponible() {
    return this.puedeOperar() && this.recibiendoLotes && this.ubicacion !== null;
  }

  tieneCapacidadPara(pesoKg) {
    return this.capacidadKg >= Number(pesoKg);
  }

  confirmarRecepcion(ruta) {
    return ruta.idReceptor === this.idUsuario && ruta.estado === EstadoRuta.EN_CAMINO;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      recibiendoLotes: this.recibiendoLotes,
      capacidadKg: this.capacidadKg,
      radioCoberturaKm: this.radioCoberturaKm,
      horarioInicio: this.horarioInicio,
      horarioFin: this.horarioFin,
    };
  }
}

export class VoluntarioLogistico extends Usuario {
  aceptarRuta(ruta) {
    return this.puedeOperar() && ruta.estaDisponible();
  }
}

export class Administrador extends Usuario {
  revisarSolicitud(solicitud, aprobar, observaciones) {
    solicitud.resolver(aprobar, observaciones, this.idUsuario);
    return solicitud;
  }
}
