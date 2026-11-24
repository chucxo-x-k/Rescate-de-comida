import mysql from 'mysql2/promise';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from './variablesEntorno.js';

const contextoTransaccion = new AsyncLocalStorage();

export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true,
  charset: 'utf8mb4',
});

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
