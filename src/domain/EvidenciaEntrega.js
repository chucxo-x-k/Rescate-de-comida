const REGEX_CODIGO = /^\d{6}$/;

export class EvidenciaEntrega {
  constructor({ idEvidencia = null, idRuta, fotosUrl = [], firmaDigital = null, codigoConfirmacion = null, fechaHora = null }) {
    this.idEvidencia = idEvidencia;
    this.idRuta = idRuta;
    this.fotosUrl = fotosUrl;
    this.firmaDigital = firmaDigital || null;
    this.codigoConfirmacion = codigoConfirmacion ? String(codigoConfirmacion).trim() : null;
    this.fechaHora = fechaHora;
  }

  /**
   * RF 4: evidencia fotográfica + firma o código de confirmación.
   * `cantidadFotos` permite validar antes de subir los archivos.
   */
  validar(cantidadFotos = this.fotosUrl.length) {
    const errores = {};
    if (cantidadFotos < 1) errores.fotos = 'Sube al menos una fotografía del estado de los alimentos.';
    if (!this.firmaDigital && !this.codigoConfirmacion) {
      errores.confirmacion = 'Recaba la firma digital del receptor o su código de confirmación.';
    }
    if (this.codigoConfirmacion && !REGEX_CODIGO.test(this.codigoConfirmacion)) {
      errores.codigo = 'El código de confirmación tiene 6 dígitos.';
    }
    return errores;
  }

  toJSON() {
    return {
      idEvidencia: this.idEvidencia,
      idRuta: this.idRuta,
      fotosUrl: this.fotosUrl,
      firmaDigital: this.firmaDigital,
      codigoConfirmacion: this.codigoConfirmacion,
      fechaHora: this.fechaHora,
    };
  }
}
