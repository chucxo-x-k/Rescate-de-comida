import { EstadoRuta, RolUsuario } from '../domain/enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import { entero, exigir, texto } from '../utils/validacion.js';

export class ServicioCalificaciones {
  constructor({ repos }) {
    this.repos = repos;
  }

  async #participantes(idRuta) {
    const fila = await this.repos.rutas.detalle(idRuta);
    if (!fila) throw ErrorApp.noEncontrado('Ruta no encontrada.');
    const lista = [
      { idUsuario: fila.id_donante, nombre: fila.donante_nombre, rol: RolUsuario.DONANTE },
      { idUsuario: fila.id_receptor, nombre: fila.receptor_nombre, rol: RolUsuario.RECEPTOR },
    ];
    if (fila.id_voluntario) {
      lista.push({ idUsuario: fila.id_voluntario, nombre: fila.voluntario_nombre, rol: RolUsuario.VOLUNTARIO });
    }
    return { fila, lista };
  }

  async pendientes(usuario, idRuta) {
    const { fila, lista } = await this.#participantes(idRuta);
    if (!lista.some((p) => p.idUsuario === usuario.idUsuario)) throw ErrorApp.prohibido();
    if (fila.estado !== EstadoRuta.ENTREGADA) return [];
    const hechas = await this.repos.calificaciones.hechasPor(idRuta, usuario.idUsuario);
    const calificados = new Set(hechas.map((c) => c.id_evaluado));
    return lista.filter((p) => p.idUsuario !== usuario.idUsuario && !calificados.has(p.idUsuario));
  }

  async calificar(usuario, idRuta, { idEvaluado, puntuacion, comentario }) {
    const evaluado = entero(idEvaluado);
    const puntos = entero(puntuacion, { min: 1, max: 5 });
    const nota = texto(comentario) || null;
    exigir({
      idEvaluado: !evaluado && 'Selecciona a quién calificas.',
      puntuacion: !puntos && 'La puntuación va de 1 a 5.',
      comentario: nota && nota.length > 255 && 'El comentario admite máximo 255 caracteres.',
    });

    const pendientes = await this.pendientes(usuario, idRuta);
    if (!pendientes.some((p) => p.idUsuario === evaluado)) {
      throw ErrorApp.conflicto('No puedes calificar a esa persona en esta ruta o ya la calificaste.');
    }

    await this.repos.calificaciones.guardar({
      id_ruta: idRuta,
      id_evaluador: usuario.idUsuario,
      id_evaluado: evaluado,
      puntuacion: puntos,
      comentario: nota,
    });
    await this.repos.usuarios.recalcularConfiabilidad(evaluado);
    return this.pendientes(usuario, idRuta);
  }
}
