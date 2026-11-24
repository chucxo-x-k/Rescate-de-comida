import multer from 'multer';
import { ErrorApp } from '../utilidades/ErrorAplicacion.js';

const MB = 1024 * 1024;
const IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENTOS = [...IMAGENES, 'application/pdf'];

const crearSubida = (tiposPermitidos, mensaje) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * MB, files: 8 },
    fileFilter: (_req, archivo, cb) => {
      if (tiposPermitidos.includes(archivo.mimetype)) cb(null, true);
      else cb(ErrorApp.solicitudInvalida(mensaje));
    },
  });

export const subidaImagenes = crearSubida(IMAGENES, 'Formato no permitido. Usa fotos JPG, PNG o WEBP.');
export const subidaDocumentos = crearSubida(DOCUMENTOS, 'Formato no permitido. Usa PDF, JPG, PNG o WEBP.');
