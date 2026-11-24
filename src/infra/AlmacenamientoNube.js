import { randomUUID } from 'node:crypto';
import { IAlmacenamientoArchivos } from '../interfaces/IAlmacenamientoArchivos.js';
import { CARPETAS_PRIVADAS, EXTENSIONES } from './AlmacenamientoLocal.js';
import { ErrorApp } from '../utils/ErrorApp.js';

export class AlmacenamientoNube extends IAlmacenamientoArchivos {
  constructor({ bucket, region, urlPublica }) {
    super();
    if (!bucket) throw new Error('Configura S3_BUCKET para usar STORAGE_DRIVER=s3.');
    this.bucket = bucket;
    this.region = region;
    this.urlPublica = (urlPublica || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/$/, '');
    this.sdk = null;
    this.cliente = null;
  }

  async #cargarSdk() {
    if (this.cliente) return;
    try {
      this.sdk = await import('@aws-sdk/client-s3');
    } catch {
      throw new Error('Falta el paquete @aws-sdk/client-s3. Ejecuta: npm install @aws-sdk/client-s3');
    }
    this.cliente = new this.sdk.S3Client({ region: this.region });
  }

  async subir(archivo, carpeta) {
    const extension = EXTENSIONES[archivo.mimetype];
    if (!extension) throw ErrorApp.solicitudInvalida('Formato de archivo no permitido.');
    await this.#cargarSdk();

    const clave = `${carpeta}/${randomUUID()}.${extension}`;
    await this.cliente.send(
      new this.sdk.PutObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        Body: archivo.buffer,
        ContentType: archivo.mimetype,
      }),
    );
    return CARPETAS_PRIVADAS.includes(carpeta) ? clave : this.obtenerUrl(clave);
  }

  obtenerUrl(clave) {
    return `${this.urlPublica}/${clave}`;
  }

  async leer(clave) {
    await this.#cargarSdk();
    try {
      const respuesta = await this.cliente.send(new this.sdk.GetObjectCommand({ Bucket: this.bucket, Key: clave }));
      return { flujo: respuesta.Body, tipo: respuesta.ContentType ?? 'application/octet-stream' };
    } catch {
      throw ErrorApp.noEncontrado('Archivo no encontrado.');
    }
  }
}
