import { RepositorioSQL } from './RepositorioBaseSQL.js';

export const SQL_MOMENTO_CADUCIDAD = "TIMESTAMP(l.fecha_caducidad, COALESCE(l.hora_caducidad, '23:59:59'))";

export const SQL_FOTO_PRINCIPAL = `(SELECT f.url_foto FROM fotos_lote f WHERE f.id_lote = l.id_lote
                             ORDER BY f.es_principal DESC, f.id_foto ASC LIMIT 1)`;

const SELECT_LOTE = `
  SELECT l.*, c.nombre AS categoria,
         d.nombre AS donante_nombre, d.telefono AS donante_telefono,
         d.estado_verificacion AS donante_verificacion, d.indice_confiabilidad AS donante_confiabilidad,
         r.id_ruta, r.estado AS ruta_estado, r.id_receptor, r.id_voluntario,
         rc.nombre AS receptor_nombre, v.nombre AS voluntario_nombre,
         ${SQL_FOTO_PRINCIPAL} AS foto_principal
  FROM lotes_alimentos l
  JOIN categorias_alimento c ON c.id_categoria = l.id_categoria
  JOIN usuarios d ON d.id_usuario = l.id_donante
  LEFT JOIN rutas_recoleccion r ON r.id_lote = l.id_lote
  LEFT JOIN usuarios rc ON rc.id_usuario = r.id_receptor
  LEFT JOIN usuarios v ON v.id_usuario = r.id_voluntario`;

export class RepositorioLotes extends RepositorioSQL {
  constructor() {
    super('lotes_alimentos', 'id_lote', [
      'id_lote', 'id_donante', 'id_categoria', 'nombre', 'descripcion', 'peso_kg', 'fecha_caducidad', 'hora_caducidad',
      'direccion_recogida', 'latitud', 'longitud', 'declaracion_buena_fe', 'estado', 'fecha_publicacion',
    ]);
  }

  async detalle(idLote) {
    const filas = await this.consultar(`${SELECT_LOTE} WHERE l.id_lote = ? LIMIT 1`, [idLote]);
    return filas[0] ?? null;
  }

  listarPorDonante(idDonante) {
    return this.consultar(`${SELECT_LOTE} WHERE l.id_donante = ? ORDER BY l.fecha_publicacion DESC, l.id_lote DESC`, [idDonante]);
  }

  listarDisponiblesSinReclamar() {
    return this.consultar(
      `${SELECT_LOTE}
       WHERE l.estado = 'PUBLICADO' AND r.id_ruta IS NULL AND ${SQL_MOMENTO_CADUCIDAD} > NOW()
       ORDER BY ${SQL_MOMENTO_CADUCIDAD} ASC
       LIMIT 500`,
    );
  }

  listarActivos() {
    return this.consultar(
      `${SELECT_LOTE} WHERE l.estado IN ('PUBLICADO','EN_RECOLECCION') ORDER BY ${SQL_MOMENTO_CADUCIDAD} ASC LIMIT 500`,
    );
  }

  listarTodos({ estado = null } = {}) {
    const where = estado ? 'WHERE l.estado = ?' : '';
    return this.consultar(`${SELECT_LOTE} ${where} ORDER BY l.fecha_publicacion DESC LIMIT 300`, estado ? [estado] : []);
  }

  async contadoresDonante(idDonante, umbralHoras) {
    const filas = await this.consultar(
      `SELECT
         COALESCE(SUM(l.estado IN ('PUBLICADO','EN_RECOLECCION')), 0) AS activos,
         COALESCE(SUM(l.estado = 'ENTREGADO'), 0) AS entregados,
         COALESCE(SUM(l.estado = 'PUBLICADO'
                      AND ${SQL_MOMENTO_CADUCIDAD} BETWEEN NOW() AND NOW() + INTERVAL ? HOUR), 0) AS por_caducar
       FROM lotes_alimentos l
       WHERE l.id_donante = ?`,
      [umbralHoras, idDonante],
    );
    return filas[0];
  }

  porVencerSinReclamar(umbralHoras) {
    return this.consultar(
      `${SELECT_LOTE}
       WHERE l.estado = 'PUBLICADO'
         AND (r.id_ruta IS NULL OR r.estado = 'DISPONIBLE')
         AND ${SQL_MOMENTO_CADUCIDAD} BETWEEN NOW() AND NOW() + INTERVAL ? HOUR`,
      [umbralHoras],
    );
  }

  async marcarCaducados() {
    const vencidos = await this.consultar(
      `SELECT l.id_lote, l.id_donante, l.nombre
       FROM lotes_alimentos l
       LEFT JOIN rutas_recoleccion r ON r.id_lote = l.id_lote
       WHERE l.estado = 'PUBLICADO' AND ${SQL_MOMENTO_CADUCIDAD} <= NOW()
         AND (r.id_ruta IS NULL OR r.estado = 'DISPONIBLE')`,
    );
    if (vencidos.length === 0) return [];
    const ids = vencidos.map((v) => v.id_lote);
    await this.consultar(`UPDATE lotes_alimentos SET estado = 'CADUCADO' WHERE id_lote IN (?)`, [ids]);
    await this.consultar(
      `UPDATE rutas_recoleccion SET estado = 'CANCELADA', fecha_cierre = NOW()
       WHERE id_lote IN (?) AND estado = 'DISPONIBLE'`,
      [ids],
    );
    return vencidos;
  }

  async cambiarEstadoSi(idLote, estadoActual, nuevoEstado) {
    const resultado = await this.consultar(
      'UPDATE lotes_alimentos SET estado = ? WHERE id_lote = ? AND estado = ?',
      [nuevoEstado, idLote, estadoActual],
    );
    return resultado.affectedRows > 0;
  }
}

export class RepositorioFotosLote extends RepositorioSQL {
  constructor() {
    super('fotos_lote', 'id_foto', ['id_foto', 'id_lote', 'url_foto', 'es_principal']);
  }

  porLote(idLote) {
    return this.buscar({ id_lote: idLote }, { orden: 'es_principal DESC, id_foto ASC' });
  }
}

export class RepositorioCategorias extends RepositorioSQL {
  constructor() {
    super('categorias_alimento', 'id_categoria', ['id_categoria', 'nombre']);
  }

  listar() {
    return this.buscar({}, { orden: 'id_categoria ASC' });
  }
}

export class RepositorioEmparejamientos extends RepositorioSQL {
  constructor() {
    super('emparejamientos', 'id_emparejamiento', [
      'id_emparejamiento', 'id_lote', 'id_receptor', 'distancia_km', 'posicion', 'fecha_generacion',
    ]);
  }

  async guardarVarios(idLote, sugerencias) {
    if (sugerencias.length === 0) return 0;
    const valores = sugerencias.map((s, i) => [idLote, s.idReceptor, s.distanciaKm, i + 1]);
    const resultado = await this.consultar(
      'INSERT INTO emparejamientos (id_lote, id_receptor, distancia_km, posicion) VALUES ?',
      [valores],
    );
    return resultado.affectedRows;
  }
}
