import bcrypt from 'bcryptjs';
import { Usuario } from '../domain/Usuario.js';
import { Ubicacion } from '../domain/Ubicacion.js';
import { RegistroHistorial } from '../domain/RegistroHistorial.js';
import { RolUsuario } from '../domain/enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import {
  aBooleano, aNumero, esCorreo, esHora, esTelefono, exigir, normalizarHora, texto,
} from '../utils/validacion.js';

const PERIODOS_VALIDOS = [7, 30, 90, 365];

export class ServicioPerfil {
  constructor({ repos }) {
    this.repos = repos;
  }

  /** CU 6: consultar perfil. */
  async obtenerPerfil(idUsuario) {
    const fila = await this.repos.usuarios.buscarConDisponibilidad(idUsuario);
    if (!fila) throw ErrorApp.noEncontrado('Usuario no encontrado.');
    return Usuario.desdeFila(fila);
  }

  /** CU 6: actualizar datos de contacto, contraseña o preferencias. */
  async guardarCambios(idUsuario, datos) {
    const actual = await this.repos.usuarios.buscarPorId(idUsuario);
    if (!actual) throw ErrorApp.noEncontrado('Usuario no encontrado.');

    const cambios = {};
    const errores = {};

    if (datos.nombre !== undefined) {
      cambios.nombre = texto(datos.nombre);
      if (!cambios.nombre || cambios.nombre.length > 150) errores.nombre = 'Escribe tu nombre o razón social.';
    }
    if (datos.correo !== undefined) {
      cambios.correo = texto(datos.correo).toLowerCase();
      if (!esCorreo(cambios.correo)) errores.correo = 'Escribe un correo electrónico válido.';
      else if (cambios.correo !== actual.correo && (await this.repos.usuarios.buscarPorCorreo(cambios.correo))) {
        errores.correo = 'Ese correo ya está registrado.';
      }
    }
    if (datos.telefono !== undefined) {
      cambios.telefono = texto(datos.telefono);
      if (!esTelefono(cambios.telefono)) errores.telefono = 'Escribe un teléfono válido.';
    }
    if (datos.direccion !== undefined) {
      cambios.direccion = texto(datos.direccion);
      if (!cambios.direccion) errores.direccion = 'Escribe tu dirección o colonia.';
    }
    if (datos.latitud !== undefined || datos.longitud !== undefined) {
      const lat = aNumero(datos.latitud);
      const lng = aNumero(datos.longitud);
      if (lat === null && lng === null) {
        cambios.latitud = null;
        cambios.longitud = null;
      } else if (Ubicacion.coordenadasValidas(lat, lng)) {
        cambios.latitud = lat;
        cambios.longitud = lng;
      } else {
        errores.ubicacion = 'Las coordenadas no son válidas.';
      }
    }
    if (datos.nuevaContrasena) {
      const nueva = String(datos.nuevaContrasena);
      if (nueva.length < 8) errores.nuevaContrasena = 'La contraseña debe tener mínimo 8 caracteres.';
      else cambios.contrasena_hash = await bcrypt.hash(nueva, 10);
    }
    if (datos.avisarNuevosLotes !== undefined) cambios.avisar_nuevos_lotes = aBooleano(datos.avisarNuevosLotes) ? 1 : 0;
    if (datos.avisarCaducidades !== undefined) cambios.avisar_caducidades = aBooleano(datos.avisarCaducidades) ? 1 : 0;

    exigir(errores);
    await this.repos.usuarios.actualizar(idUsuario, cambios);
    return this.obtenerPerfil(idUsuario);
  }

  /** CU 6: historial de donaciones, rescates o rutas con filtro por periodo. */
  async consultarHistorial(idUsuario, { dias = 30 } = {}) {
    const periodo = PERIODOS_VALIDOS.includes(Number(dias)) ? Number(dias) : 30;
    const filas = await this.repos.historial.listarPorUsuario(idUsuario, periodo);
    return filas.map((f) => new RegistroHistorial(f).toJSON());
  }

  /** "Estoy recibiendo lotes" + "Editar capacidad y horario" (wireframe Panel Receptor). */
  async actualizarDisponibilidad(usuario, datos) {
    if (usuario.rol !== RolUsuario.RECEPTOR) throw ErrorApp.prohibido('Solo los receptores tienen disponibilidad.');

    const cambios = {};
    const errores = {};
    if (datos.recibiendoLotes !== undefined) cambios.recibiendo_lotes = aBooleano(datos.recibiendoLotes) ? 1 : 0;
    if (datos.capacidadKg !== undefined) {
      const capacidad = aNumero(datos.capacidadKg);
      if (capacidad === null || capacidad < 0 || capacidad > 999999.99) errores.capacidadKg = 'Capacidad inválida.';
      else cambios.capacidad_kg = capacidad;
    }
    if (datos.radioCoberturaKm !== undefined) {
      const radio = aNumero(datos.radioCoberturaKm);
      if (radio === null || radio < 0.5 || radio > 100) errores.radioCoberturaKm = 'El radio debe estar entre 0.5 y 100 km.';
      else cambios.radio_cobertura_km = radio;
    }
    for (const [campo, columna] of [['horarioInicio', 'horario_inicio'], ['horarioFin', 'horario_fin']]) {
      if (datos[campo] === undefined) continue;
      if (datos[campo] === '' || datos[campo] === null) cambios[columna] = null;
      else if (esHora(datos[campo])) cambios[columna] = normalizarHora(datos[campo]);
      else errores[campo] = 'Hora inválida (HH:MM).';
    }
    if (cambios.recibiendo_lotes === 1 && !usuario.ubicacion) {
      errores.ubicacion = 'Registra tu ubicación en Perfil para recibir sugerencias de lotes cercanos.';
    }
    exigir(errores);

    await this.repos.disponibilidad.guardarOActualizar(usuario.idUsuario, cambios);
    return this.obtenerPerfil(usuario.idUsuario);
  }
}
