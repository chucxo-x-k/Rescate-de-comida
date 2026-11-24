import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMiddlewareAuth } from './middleware/auth.js';
import { bloquearComercializacion, bloquearRutasComerciales } from './middleware/comercializacion.js';
import { cabecerasSeguridad, manejarErrores, rutaApiNoEncontrada } from './middleware/errores.js';
import { rutasAuth } from './routes/auth.routes.js';
import { rutasPerfil } from './routes/perfil.routes.js';
import { rutasVerificacion } from './routes/verificacion.routes.js';
import { rutasLotes } from './routes/lotes.routes.js';
import { rutasRecoleccion } from './routes/rutas.routes.js';
import { rutasNotificaciones } from './routes/notificaciones.routes.js';
import { rutasAdmin } from './routes/admin.routes.js';
import { rutasCatalogos } from './routes/catalogos.routes.js';

const raizProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function crearApp(contenedor) {
  const app = express();
  const auth = crearMiddlewareAuth(contenedor.autenticacion);

  app.disable('x-powered-by');
  app.use(cabecerasSeguridad);
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', bloquearRutasComerciales, bloquearComercializacion);
  app.get('/api/salud', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', rutasAuth(contenedor, auth));
  app.use('/api/perfil', rutasPerfil(contenedor, auth));
  app.use('/api/verificacion', rutasVerificacion(contenedor, auth));
  app.use('/api/lotes', rutasLotes(contenedor, auth));
  app.use('/api/rutas', rutasRecoleccion(contenedor, auth));
  app.use('/api/notificaciones', rutasNotificaciones(contenedor, auth));
  app.use('/api/admin', rutasAdmin(contenedor, auth));
  app.use('/api', rutasCatalogos(contenedor, auth));
  app.use('/api', rutaApiNoEncontrada);

  if (contenedor.config.almacenamiento.driver !== 's3') {
    const dirPublico = path.resolve(raizProyecto, contenedor.config.almacenamiento.directorioLocal, 'publico');
    app.use('/uploads', express.static(dirPublico, { maxAge: '7d', index: false }));
  }
  app.use('/vendor/leaflet', express.static(path.join(raizProyecto, 'node_modules', 'leaflet', 'dist'), { maxAge: '30d' }));
  app.use(express.static(path.join(raizProyecto, 'public'), { index: 'index.html' }));

  app.use(manejarErrores);
  return app;
}
