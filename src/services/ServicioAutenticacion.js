import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { transaccion } from '../config/db.js';
import { Usuario } from '../domain/Usuario.js';
import { Sesion } from '../domain/Sesion.js';
import { ROLES_REGISTRABLES, RolUsuario, TipoNotificacion, ROLES_CON_VERIFICACION } from '../domain/enums.js';
import { Ubicacion } from '../domain/Ubicacion.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import { aBooleano, aNumero, esCorreo, esTelefono, exigir, texto } from '../utils/validacion.js';

const COSTO_HASH = 10;
// Hash válido para comparar aunque el correo no exista (tiempo de respuesta uniforme).
const HASH_FICTICIO = '$2b$10$Di.sDngurZgZTp7O6wZiF.GopSrN9p6EseM47mIAR2JF0.JEPnll2';

export class ServicioAutenticacion {
  constructor({ repos, notificador, jwtSecreto, jwtExpiraHoras }) {
    this.repos = repos;
    this.notificador = notificador;
    this.jwtSecreto = jwtSecreto;
    this.jwtExpiraHoras = jwtExpiraHoras;
  }

  async correoDisponible(correo) {
    const existente = await this.repos.usuarios.buscarPorCorreo(texto(correo).toLowerCase());
    return existente === null;
  }

  /** CU 1: Registrarse en el sistema. */
  async registrar(datos) {
    const d = {
      nombre: texto(datos.nombre),
      correo: texto(datos.correo).toLowerCase(),
      contrasena: String(datos.contrasena ?? ''),
      confirmar: datos.confirmarContrasena === undefined ? undefined : String(datos.confirmarContrasena),
      telefono: texto(datos.telefono),
      rol: texto(datos.rol).toUpperCase(),
      direccion: texto(datos.direccion),
      latitud: aNumero(datos.latitud),
      longitud: aNumero(datos.longitud),
      aceptaTerminos: aBooleano(datos.aceptaTerminos),
    };

    exigir({
      rol: !ROLES_REGISTRABLES.includes(d.rol) && 'Selecciona un tipo de cuenta válido.',
      nombre: (!d.nombre || d.nombre.length > 150) && 'Escribe tu nombre o razón social.',
      correo: (!esCorreo(d.correo) || d.correo.length > 120) && 'Escribe un correo electrónico válido.',
      telefono: !esTelefono(d.telefono) && 'Escribe un teléfono de contacto válido.',
      contrasena: d.contrasena.length < 8 && 'La contraseña debe tener mínimo 8 caracteres.',
      confirmarContrasena: d.confirmar !== undefined && d.confirmar !== d.contrasena && 'Las contraseñas no coinciden.',
      direccion: (!d.direccion || d.direccion.length > 255) && 'Escribe tu dirección o colonia.',
      ubicacion:
        (d.latitud !== null || d.longitud !== null) &&
        !Ubicacion.coordenadasValidas(d.latitud, d.longitud) &&
        'Las coordenadas de ubicación no son válidas.',
      aceptaTerminos: !d.aceptaTerminos && 'Debes aceptar el aviso de privacidad y los términos de uso.',
    });

    if (!(await this.correoDisponible(d.correo))) {
      throw ErrorApp.conflicto('Ese correo ya está registrado. Inicia sesión o usa otro.');
    }

    const contrasenaHash = await bcrypt.hash(d.contrasena, COSTO_HASH);
    const idUsuario = await transaccion(async () => {
      const id = await this.repos.usuarios.guardar({
        nombre: d.nombre,
        correo: d.correo,
        contrasena_hash: contrasenaHash,
        telefono: d.telefono,
        rol: d.rol,
        direccion: d.direccion,
        latitud: d.latitud,
        longitud: d.longitud,
        acepta_terminos: 1,
      });
      if (d.rol === RolUsuario.RECEPTOR) {
        await this.repos.disponibilidad.guardar({ id_receptor: id });
      }
      return id;
    });

    if (ROLES_CON_VERIFICACION.includes(d.rol)) {
      await this.notificador.enviar(
        idUsuario,
        'Bienvenido a Rescate de Comida. Sube tus documentos en Verificación para publicar o recibir lotes.',
        { tipo: TipoNotificacion.CUENTA },
      );
    }

    return Usuario.desdeFila(await this.repos.usuarios.buscarConDisponibilidad(idUsuario));
  }

  /** CU 2: Iniciar sesión. */
  async iniciarSesion(correo, contrasena) {
    const fila = await this.repos.usuarios.buscarPorCorreo(texto(correo).toLowerCase());
    const coincide = await bcrypt.compare(String(contrasena ?? ''), fila?.contrasena_hash ?? HASH_FICTICIO);
    if (!fila || !coincide) {
      throw ErrorApp.noAutenticado('Correo o contraseña incorrectos. Inténtalo de nuevo.');
    }
    if (!fila.activo) throw ErrorApp.prohibido('Tu cuenta está desactivada. Contacta al administrador.');

    const token = jwt.sign({ rol: fila.rol }, this.jwtSecreto, {
      subject: String(fila.id_usuario),
      expiresIn: `${this.jwtExpiraHoras}h`,
    });
    const sesion = Sesion.desdePayload(token, jwt.decode(token));
    const usuario = Usuario.desdeFila(await this.repos.usuarios.buscarConDisponibilidad(fila.id_usuario));
    return { sesion, usuario };
  }

  verificarToken(token) {
    try {
      const payload = jwt.verify(token, this.jwtSecreto);
      const sesion = Sesion.desdePayload(token, payload);
      if (!sesion.estaActiva()) throw new Error('expirada');
      return sesion;
    } catch {
      throw ErrorApp.noAutenticado('Tu sesión expiró. Inicia sesión de nuevo.');
    }
  }

  async usuarioDeSesion(sesion) {
    const fila = await this.repos.usuarios.buscarConDisponibilidad(sesion.idUsuario);
    if (!fila) throw ErrorApp.noAutenticado('La cuenta ya no existe.');
    if (!fila.activo) throw ErrorApp.prohibido('Tu cuenta está desactivada. Contacta al administrador.');
    return Usuario.desdeFila(fila);
  }
}
