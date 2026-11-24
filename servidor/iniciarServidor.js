import { env } from './configuracion/variablesEntorno.js';
import { pool, cerrarPool } from './configuracion/baseDeDatos.js';
import { crearContenedor } from './servicios/crearContenedor.js';
import { crearApp } from './aplicacion.js';

async function verificarBaseDeDatos() {
  try {
    await pool.query('SELECT 1 FROM configuracion_sistema LIMIT 1');
  } catch (error) {
    console.error('\nNo se pudo conectar a la base de datos MySQL/MariaDB.');
    console.error(`Detalle: ${error.message}`);
    console.error('Revisa tu archivo .env y ejecuta "npm run db:init" para crear la base rescate_comida.\n');
    process.exit(1);
  }
}

await verificarBaseDeDatos();

const contenedor = crearContenedor();
const app = crearApp(contenedor);

const servidor = app.listen(env.puerto, () => {
  console.log(`Rescate de Comida escuchando en http://localhost:${env.puerto}`);
});

if (env.tareasProgramadas) {
  await contenedor.tiempo.activarTareaProgramada();
}

async function apagar(senal) {
  console.log(`\n${senal} recibido. Cerrando servidor...`);
  contenedor.tiempo.detener();
  contenedor.canal.cerrar();
  servidor.close(async () => {
    await cerrarPool();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
