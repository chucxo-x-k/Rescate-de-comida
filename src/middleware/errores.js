import multer from 'multer';
import { ErrorApp } from '../utils/ErrorApp.js';

const MENSAJES_MULTER = {
  LIMIT_FILE_SIZE: 'Cada archivo debe pesar máximo 8 MB.',
  LIMIT_FILE_COUNT: 'Demasiados archivos.',
  LIMIT_UNEXPECTED_FILE: 'Se recibió un archivo inesperado o demasiadas fotos.',
};

const ERRORES_CHECK = new Set([3819, 4025]);

export function rutaApiNoEncontrada(_req, res) {
  res.status(404).json({ error: 'Ruta de API no encontrada.' });
}

export function manejarErrores(error, _req, res, _next) {
  if (res.headersSent) return;

  if (error instanceof ErrorApp) {
    return res.status(error.estado).json({ error: error.message, detalles: error.detalles ?? undefined });
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: MENSAJES_MULTER[error.code] ?? 'Error al subir archivos.' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  }
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'El registro ya existe.' });
  }
  if (ERRORES_CHECK.has(error.errno)) {
    return res.status(400).json({ error: 'Los datos no cumplen las reglas de la base de datos.' });
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_BAD_DB_ERROR') {
    console.error('[BD]', error.message);
    return res.status(503).json({ error: 'La base de datos no está disponible.' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Ocurrió un error inesperado.' });
}

export function cabecerasSeguridad(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Frame-Options', 'DENY');
  next();
}
