import { RepositorioSQL } from './RepositorioBaseSQL.js';
import { SQL_FOTO_PRINCIPAL, SQL_MOMENTO_CADUCIDAD } from './RepositorioLotes.js';

const SELECT_RUTA = `
  SELECT r.*,
         l.nombre AS lote_nombre, l.descripcion AS lote_descripcion, l.peso_kg, l.fecha_caducidad, l.hora_caducidad,
         l.direccion_recogida, l.latitud AS recogida_latitud, l.longitud AS recogida_longitud,
         l.estado AS lote_estado, l.id_donante, l.id_categoria, c.nombre AS categoria,
         d.nombre AS donante_nombre, d.telefono AS donante_telefono,
         rc.nombre AS receptor_nombre, rc.telefono AS receptor_telefono, rc.direccion AS receptor_direccion,
         rc.latitud AS receptor_latitud, rc.longitud AS receptor_longitud,
         v.nombre AS voluntario_nombre, v.telefono AS voluntario_telefono,
         ch.aprobado AS checklist_aprobado,
         ${SQL_FOTO_PRINCIPAL} AS foto_principal
  FROM rutas_recoleccion r
  JOIN lotes_alimentos l ON l.id_lote = r.id_lote
  JOIN categorias_alimento c ON c.id_categoria = l.id_categoria
  JOIN usuarios d ON d.id_usuario = l.id_donante
  JOIN usuarios rc ON rc.id_usuario = r.id_receptor
  LEFT JOIN usuarios v ON v.id_usuario = r.id_voluntario
  LEFT JOIN checklists_inocuidad ch ON ch.id_ruta = r.id_ruta`;

export class RepositorioRutas extends RepositorioSQL {
  constructor() {
    super('rutas_recoleccion', 'id_ruta', [
      'id_ruta', 'id_lote', 'id_receptor', 'id_voluntario', 'distancia_km', 'ventana_recoleccion_inicio',
      'ventana_recoleccion_fin', 'estado', 'fecha_aceptacion', 'fecha_cierre',
    ]);
  }

  async detalle(idRuta) {
    const filas = await this.consultar(`${SELECT_RUTA} WHERE r.id_ruta = ? LIMIT 1`, [idRuta]);
    return filas[0] ?? null;
  }

  listarDisponibles() {
    return this.consultar(
      `${SELECT_RUTA}
       WHERE r.estado = 'DISPONIBLE' AND l.estado = 'PUBLICADO' AND ${SQL_MOMENTO_CADUCIDAD} > NOW()
       ORDER BY ${SQL_MOMENTO_CADUCIDAD} ASC`,
    );
  }

  async activaDeVoluntario(idVoluntario) {
    const filas = await this.consultar(
      `${SELECT_RUTA} WHERE r.id_voluntario = ? AND r.estado IN ('EN_RECOLECCION','EN_CAMINO')
       ORDER BY r.fecha_aceptacion DESC LIMIT 1`,
      [idVoluntario],
    );
    return filas[0] ?? null;
  }

  listarPorReceptor(idReceptor) {
    return this.consultar(`${SELECT_RUTA} WHERE r.id_receptor = ? ORDER BY r.id_ruta DESC LIMIT 200`, [idReceptor]);
  }

  async asignarVoluntarioSiDisponible(idRuta, idVoluntario) {
    const resultado = await this.consultar(
      `UPDATE rutas_recoleccion
       SET id_voluntario = ?, estado = 'EN_RECOLECCION', fecha_aceptacion = NOW()
       WHERE id_ruta = ? AND estado = 'DISPONIBLE' AND id_voluntario IS NULL`,
      [idVoluntario, idRuta],
    );
    return resultado.affectedRows > 0;
  }

  async cambiarEstadoSi(idRuta, estadoActual, nuevoEstado, { cerrar = false } = {}) {
    const resultado = await this.consultar(
      `UPDATE rutas_recoleccion SET estado = ?${cerrar ? ', fecha_cierre = NOW()' : ''}
       WHERE id_ruta = ? AND estado = ?`,
      [nuevoEstado, idRuta, estadoActual],
    );
    return resultado.affectedRows > 0;
  }

  async indicadores({ dias, idCategoria = null }) {
    const filtroCategoria = idCategoria ? 'AND l.id_categoria = ?' : '';
    const parametros = idCategoria ? [dias, idCategoria] : [dias];
    const filas = await this.consultar(
      `SELECT COALESCE(SUM(l.peso_kg), 0) AS kg_rescatados,
              COALESCE(SUM(r.fecha_cierre <= ${SQL_MOMENTO_CADUCIDAD}), 0) AS vencidos_evitados,
              COALESCE(AVG(TIMESTAMPDIFF(MINUTE, r.fecha_aceptacion, r.fecha_cierre)), 0) AS traslado_medio_min
       FROM rutas_recoleccion r
       JOIN lotes_alimentos l ON l.id_lote = r.id_lote
       WHERE r.estado = 'ENTREGADA' AND r.fecha_cierre >= NOW() - INTERVAL ? DAY ${filtroCategoria}`,
      parametros,
    );
    return filas[0];
  }

  kgPorDia({ dias = 7, idCategoria = null }) {
    const filtroCategoria = idCategoria ? 'AND l.id_categoria = ?' : '';
    const parametros = idCategoria ? [dias - 1, idCategoria] : [dias - 1];
    return this.consultar(
      `SELECT DATE(r.fecha_cierre) AS dia, SUM(l.peso_kg) AS kg
       FROM rutas_recoleccion r
       JOIN lotes_alimentos l ON l.id_lote = r.id_lote
       WHERE r.estado = 'ENTREGADA' AND r.fecha_cierre >= CURDATE() - INTERVAL ? DAY ${filtroCategoria}
       GROUP BY DATE(r.fecha_cierre)
       ORDER BY dia ASC`,
      parametros,
    );
  }

  rutasActivas({ idCategoria = null } = {}) {
    const filtroCategoria = idCategoria ? 'AND l.id_categoria = ?' : '';
    return this.consultar(
      `${SELECT_RUTA} WHERE r.estado IN ('EN_RECOLECCION','EN_CAMINO') ${filtroCategoria}
       ORDER BY r.fecha_aceptacion DESC LIMIT 20`,
      idCategoria ? [idCategoria] : [],
    );
  }
}

export class RepositorioChecklists extends RepositorioSQL {
  constructor() {
    super('checklists_inocuidad', 'id_checklist', [
      'id_checklist', 'id_ruta', 'temperatura_c', 'aprobado', 'observaciones', 'fecha_validacion',
    ]);
  }

  buscarPorRuta(idRuta) {
    return this.buscarUno({ id_ruta: idRuta });
  }
}

export class RepositorioItemsChecklist extends RepositorioSQL {
  constructor() {
    super('items_checklist', 'id_item', ['id_item', 'id_checklist', 'criterio', 'cumple']);
  }

  porChecklist(idChecklist) {
    return this.buscar({ id_checklist: idChecklist }, { orden: 'id_item ASC' });
  }

  async reemplazar(idChecklist, items) {
    await this.consultar('DELETE FROM items_checklist WHERE id_checklist = ?', [idChecklist]);
    if (items.length === 0) return;
    await this.consultar('INSERT INTO items_checklist (id_checklist, criterio, cumple) VALUES ?', [
      items.map((i) => [idChecklist, i.criterio, i.cumple ? 1 : 0]),
    ]);
  }
}

export class RepositorioEvidencias extends RepositorioSQL {
  constructor() {
    super('evidencias_entrega', 'id_evidencia', [
      'id_evidencia', 'id_ruta', 'firma_digital', 'codigo_confirmacion', 'fecha_registro',
    ]);
  }

  buscarPorRuta(idRuta) {
    return this.buscarUno({ id_ruta: idRuta });
  }
}

export class RepositorioFotosEvidencia extends RepositorioSQL {
  constructor() {
    super('fotos_evidencia', 'id_foto_evidencia', ['id_foto_evidencia', 'id_evidencia', 'url_foto']);
  }

  porEvidencia(idEvidencia) {
    return this.buscar({ id_evidencia: idEvidencia }, { orden: 'id_foto_evidencia ASC' });
  }
}

export class RepositorioHistorial extends RepositorioSQL {
  constructor() {
    super('historial_actividad', 'id_historial', [
      'id_historial', 'id_usuario', 'id_lote', 'id_contraparte', 'estado', 'fecha_evento',
    ]);
  }

  async registrarParticipantes({ idLote, idDonante, idReceptor, idVoluntario, estado }) {
    const filas = [
      [idDonante, idLote, idReceptor, estado],
      [idReceptor, idLote, idDonante, estado],
    ];
    if (idVoluntario) filas.push([idVoluntario, idLote, idReceptor, estado]);
    await this.consultar('INSERT INTO historial_actividad (id_usuario, id_lote, id_contraparte, estado) VALUES ?', [filas]);
  }

  listarPorUsuario(idUsuario, dias) {
    return this.consultar(
      `SELECT h.*, l.nombre AS nombre_lote, l.peso_kg, c.nombre AS contraparte
       FROM historial_actividad h
       JOIN lotes_alimentos l ON l.id_lote = h.id_lote
       LEFT JOIN usuarios c ON c.id_usuario = h.id_contraparte
       WHERE h.id_usuario = ? AND h.fecha_evento >= NOW() - INTERVAL ? DAY
       ORDER BY h.fecha_evento DESC, h.id_historial DESC
       LIMIT 300`,
      [idUsuario, dias],
    );
  }
}

export class RepositorioCalificaciones extends RepositorioSQL {
  constructor() {
    super('calificaciones', 'id_calificacion', [
      'id_calificacion', 'id_ruta', 'id_evaluador', 'id_evaluado', 'puntuacion', 'comentario', 'fecha',
    ]);
  }

  hechasPor(idRuta, idEvaluador) {
    return this.buscar({ id_ruta: idRuta, id_evaluador: idEvaluador });
  }
}
