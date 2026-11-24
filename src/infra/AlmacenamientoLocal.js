import { mkdir, writeFile, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { IAlmacenamientoArchivos } from '../interfaces/IAlmacenamientoArchivos.js';
import { ErrorApp } from '../utils/ErrorApp.js';

export const EXTENSIONES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
});

/** Carpetas cuyo contenido no se publica: se sirve solo por la API con permisos. */
export const CARPETAS_PRIVADAS = Object.freeze(['documentos']);

/**
 * Guarda archivos en disco. Lo público queda en <raiz>/publico (servido en /uploads)
 * y lo privado en <raiz>/privado (solo accesible con leer()).
 */
export class AlmacenamientoLocal extends IAlmacenamientoArchivos {
  constructor(directorioRaiz) {
    super();
    this.raiz = path.resolve(directorioRaiz);
    this.dirPublico = path.join(this.raiz, 'publico');
    this.dirPrivado = path.join(this.raiz, 'privado');
  }

  esPrivada(carpeta) {
    return CARPETAS_PRIVADAS.includes(carpeta);
  }

  async subir(archivo, carpeta) {
    const extension = EXTENSIONES[archivo.mimetype];
    if (!extension) throw ErrorApp.solicitudInvalida('Formato de archivo no permitido.');
    if (!/^[a-z]+$/.test(carpeta)) throw new Error('Carpeta inválida.');

    const nombre = `${randomUUID()}.${extension}`;
    const base = this.esPrivada(carpeta) ? this.dirPrivado : this.dirPublico;
    await mkdir(path.join(base, carpeta), { recursive: true });
    await writeFile(path.join(base, carpeta, nombre), archivo.buffer);

    const clave = `${carpeta}/${nombre}`;
    return this.esPrivada(carpeta) ? clave : this.obtenerUrl(clave);
  }

  obtenerUrl(clave) {
    return `/uploads/${clave}`;
  }

  async leer(clave) {
    const [carpeta, nombre] = String(clave).split('/');
    if (!carpeta || !nombre || nombre.includes('..') || !/^[\w-]+\.\w+$/.test(nombre)) {
      throw ErrorApp.noEncontrado('Archivo no encontrado.');
    }
    const base = this.esPrivada(carpeta) ? this.dirPrivado : this.dirPublico;
    const ruta = path.join(base, carpeta, nombre);
    try {
      await access(ruta);
    } catch {
      throw ErrorApp.noEncontrado('Archivo no encontrado.');
    }
    const extension = path.extname(nombre).slice(1);
    const tipo = Object.entries(EXTENSIONES).find(([, ext]) => ext === extension)?.[0] ?? 'application/octet-stream';
    return { flujo: createReadStream(ruta), tipo };
  }
}
