import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMiddlewareAuth } from './intermediarios/autenticacion.js';
import { bloquearComercializacion, bloquearRutasComerciales } from './intermediarios/bloqueoComercializacion.js';
import { cabecerasSeguridad, manejarErrores, rutaApiNoEncontrada } from './intermediarios/manejoErrores.js';
import { rutasAuth } from './rutas/rutasAutenticacion.js';
import { rutasPerfil } from './rutas/rutasPerfil.js';
import { rutasVerificacion } from './rutas/rutasVerificacion.js';
import { rutasLotes } from './rutas/rutasLotes.js';
import { rutasRecoleccion } from './rutas/rutasRecoleccion.js';
import { rutasNotificaciones } from './rutas/rutasNotificaciones.js';
import { rutasAdmin } from './rutas/rutasAdministrador.js';
import { rutasCatalogos } from './rutas/rutasCatalogos.js';

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
  app.use(express.static(path.join(raizProyecto, 'publico'), { index: 'index.html' }));

  app.use(manejarErrores);
  return app;
}
