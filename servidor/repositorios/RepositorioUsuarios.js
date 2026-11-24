import { RepositorioSQL } from './RepositorioBaseSQL.js';

const SELECT_CON_DISPONIBILIDAD = `
  SELECT u.*, d.recibiendo_lotes, d.capacidad_kg, d.horario_inicio, d.horario_fin, d.radio_cobertura_km
  FROM usuarios u
  LEFT JOIN disponibilidad_receptor d ON d.id_receptor = u.id_usuario`;

export class RepositorioUsuarios extends RepositorioSQL {
  constructor() {
    super('usuarios', 'id_usuario', [
      'id_usuario', 'nombre', 'correo', 'contrasena_hash', 'telefono', 'rol', 'direccion', 'latitud', 'longitud',
      'estado_verificacion', 'indice_confiabilidad', 'acepta_terminos', 'avisar_nuevos_lotes', 'avisar_caducidades',
      'activo', 'fecha_registro',
    ]);
  }

  buscarPorCorreo(correo) {
    return this.buscarUno({ correo });
  }

  async buscarConDisponibilidad(idUsuario) {
    const filas = await this.consultar(`${SELECT_CON_DISPONIBILIDAD} WHERE u.id_usuario = ? LIMIT 1`, [idUsuario]);
    return filas[0] ?? null;
  }

  receptoresCandidatos() {
    return this.consultar(
      `${SELECT_CON_DISPONIBILIDAD}
       WHERE u.rol = 'RECEPTOR' AND u.activo = 1 AND u.estado_verificacion = 'VERIFICADO'
         AND d.recibiendo_lotes = 1 AND u.latitud IS NOT NULL AND u.longitud IS NOT NULL`,
    );
  }

  voluntariosActivos() {
    return this.consultar(`SELECT * FROM usuarios WHERE rol = 'VOLUNTARIO' AND activo = 1`);
  }

  administradores() {
    return this.consultar(`SELECT * FROM usuarios WHERE rol = 'ADMINISTRADOR' AND activo = 1`);
  }

  listar({ rol = null, texto = null } = {}) {
    const condiciones = [];
    const parametros = [];
    if (rol) {
      condiciones.push('u.rol = ?');
      parametros.push(rol);
    }
    if (texto) {
      condiciones.push('(u.nombre LIKE ? OR u.correo LIKE ?)');
      parametros.push(`%${texto}%`, `%${texto}%`);
    }
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    return this.consultar(`${SELECT_CON_DISPONIBILIDAD} ${where} ORDER BY u.fecha_registro DESC LIMIT 300`, parametros);
  }

  async recalcularConfiabilidad(idUsuario) {
    await this.consultar(
      `UPDATE usuarios
       SET indice_confiabilidad = COALESCE((SELECT ROUND(AVG(puntuacion), 1) FROM calificaciones WHERE id_evaluado = ?), 0.0)
       WHERE id_usuario = ?`,
      [idUsuario, idUsuario],
    );
  }
}

export class RepositorioDisponibilidad extends RepositorioSQL {
  constructor() {
    super(
      'disponibilidad_receptor',
      'id_receptor',
      ['id_receptor', 'recibiendo_lotes', 'capacidad_kg', 'horario_inicio', 'horario_fin', 'radio_cobertura_km'],
      { autoIncremento: false },
    );
  }

  async guardarOActualizar(idReceptor, datos) {
    const existente = await this.buscarPorId(idReceptor);
    if (existente) {
      await this.actualizar(idReceptor, datos);
    } else {
      await this.guardar({ ...datos, id_receptor: idReceptor });
    }
    return this.buscarPorId(idReceptor);
  }
}
