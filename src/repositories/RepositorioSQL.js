import { IRepositorio } from '../interfaces/IRepositorio.js';
import { consultar } from '../config/db.js';

/**
 * RepositorioSQL<T>: implementación genérica de IRepositorio sobre MySQL/MariaDB.
 * Los repositorios específicos heredan de aquí y agregan sus consultas.
 */
export class RepositorioSQL extends IRepositorio {
  constructor(tabla, llavePrimaria, columnas, { autoIncremento = true } = {}) {
    super();
    this.tabla = tabla;
    this.llavePrimaria = llavePrimaria;
    this.columnas = new Set(columnas);
    this.autoIncremento = autoIncremento;
  }

  /** Conserva solo columnas conocidas para evitar inyección de campos. */
  filtrar(datos) {
    return Object.fromEntries(
      Object.entries(datos).filter(([columna, valor]) => this.columnas.has(columna) && valor !== undefined),
    );
  }

  async guardar(entidad) {
    const fila = this.filtrar(entidad);
    const resultado = await consultar('INSERT INTO ?? SET ?', [this.tabla, fila]);
    return this.autoIncremento ? resultado.insertId : fila[this.llavePrimaria];
  }

  async buscarPorId(id) {
    const filas = await consultar('SELECT * FROM ?? WHERE ?? = ? LIMIT 1', [this.tabla, this.llavePrimaria, id]);
    return filas[0] ?? null;
  }

  async actualizar(id, datos) {
    const { [this.llavePrimaria]: _pk, ...cambios } = this.filtrar(datos);
    if (Object.keys(cambios).length === 0) return false;
    const resultado = await consultar('UPDATE ?? SET ? WHERE ?? = ?', [this.tabla, cambios, this.llavePrimaria, id]);
    return resultado.affectedRows > 0;
  }

  async eliminar(id) {
    const resultado = await consultar('DELETE FROM ?? WHERE ?? = ?', [this.tabla, this.llavePrimaria, id]);
    return resultado.affectedRows > 0;
  }

  /**
   * Búsqueda por igualdad de columnas.
   * `orden` debe venir del código (no del usuario), p. ej. "fecha DESC".
   */
  async buscar(condiciones = {}, { orden = null, limite = null } = {}) {
    const filtro = this.filtrar(condiciones);
    const columnas = Object.keys(filtro);
    const parametros = [this.tabla];
    let sql = 'SELECT * FROM ??';
    if (columnas.length > 0) {
      sql += ` WHERE ${columnas.map(() => '?? = ?').join(' AND ')}`;
      for (const columna of columnas) parametros.push(columna, filtro[columna]);
    }
    if (orden) sql += ` ORDER BY ${orden}`;
    if (Number.isInteger(limite)) {
      sql += ' LIMIT ?';
      parametros.push(limite);
    }
    return consultar(sql, parametros);
  }

  async buscarUno(condiciones) {
    const filas = await this.buscar(condiciones, { limite: 1 });
    return filas[0] ?? null;
  }

  consultar(sql, parametros = []) {
    return consultar(sql, parametros);
  }
}
