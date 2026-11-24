import { RepositorioSQL } from './RepositorioSQL.js';

export class RepositorioConfiguracion extends RepositorioSQL {
  constructor() {
    super('configuracion_sistema', 'clave', ['clave', 'valor', 'descripcion'], { autoIncremento: false });
  }

  async obtenerNumero(clave, porDefecto) {
    const fila = await this.buscarPorId(clave);
    const valor = Number(fila?.valor);
    return Number.isFinite(valor) ? valor : porDefecto;
  }

  todas() {
    return this.buscar({}, { orden: 'clave ASC' });
  }
}
