import mysql from 'mysql2/promise';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from './env.js';

// La conexión de la transacción activa viaja en el contexto asíncrono,
// así los repositorios se suman a ella sin recibir parámetros extra.
const contextoTransaccion = new AsyncLocalStorage();

export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true,
  charset: 'utf8mb4',
});

/**
 * Valor crudo NOW() para usarse dentro de objetos de INSERT/UPDATE (`SET ?`).
 * Así todas las marcas de tiempo salen del reloj de la BD, igual que los DEFAULT.
 */
export const AHORA = Object.freeze({ toSqlString: () => 'NOW()' });

export async function consultar(sql, parametros = []) {
  const ejecutor = contextoTransaccion.getStore() ?? pool;
  const [resultado] = await ejecutor.query(sql, parametros);
  return resultado;
}

export async function transaccion(trabajo) {
  if (contextoTransaccion.getStore()) return trabajo();

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await contextoTransaccion.run(conexion, trabajo);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

export async function cerrarPool() {
  await pool.end();
}
