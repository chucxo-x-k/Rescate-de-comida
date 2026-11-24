import { Usuario } from '../domain/Usuario.js';
import { RolUsuario, TipoNotificacion } from '../domain/enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import { aBooleano, texto } from '../utils/validacion.js';

export class ServicioAdmin {
  constructor({ repos, notificador }) {
    this.repos = repos;
    this.notificador = notificador;
  }

  async listarUsuarios({ rol = null, texto: busqueda = null } = {}) {
    const rolValido = Object.values(RolUsuario).includes(rol) ? rol : null;
    const filas = await this.repos.usuarios.listar({ rol: rolValido, texto: texto(busqueda) || null });
    return filas.map((f) => Usuario.desdeFila(f).toJSON());
  }

  async cambiarActivo(administrador, idUsuario, activo) {
    if (administrador.idUsuario === idUsuario) throw ErrorApp.conflicto('No puedes desactivar tu propia cuenta.');
    const fila = await this.repos.usuarios.buscarPorId(idUsuario);
    if (!fila) throw ErrorApp.noEncontrado('Usuario no encontrado.');
    const valor = aBooleano(activo) ? 1 : 0;
    await this.repos.usuarios.actualizar(idUsuario, { activo: valor });
    if (valor === 1) {
      await this.notificador.enviar(idUsuario, 'Tu cuenta fue reactivada por el administrador.', {
        tipo: TipoNotificacion.CUENTA,
      });
    }
    return Usuario.desdeFila(await this.repos.usuarios.buscarConDisponibilidad(idUsuario)).toJSON();
  }
}
