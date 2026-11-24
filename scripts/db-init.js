// Crea (o recrea) la base rescate_comida ejecutando database/rescate_comida.sql.
// ADVERTENCIA: el script hace DROP DATABASE; borra los datos existentes.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivoSql = path.join(raiz, 'database', 'rescate_comida.sql');

const sql = await readFile(archivoSql, 'utf8');
const conexion = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  multipleStatements: true,
});

try {
  await conexion.query(sql);
  const [tablas] = await conexion.query(
    'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?',
    ['rescate_comida'],
  );
  console.log(`Base rescate_comida creada con ${tablas[0].total} tablas.`);
  console.log('Administrador inicial: admin@rescate.mx / Admin123!');
  if (env.db.database !== 'rescate_comida') {
    console.warn(`Aviso: DB_NAME es "${env.db.database}" pero el script crea "rescate_comida".`);
  }
} finally {
  await conexion.end();
}
