import { Usuario } from '../domain/Usuario.js';
import { TipoNotificacion } from '../domain/enums.js';

export class ModuloEmparejamiento {
  constructor({ repos, notificador }) {
    this.repos = repos;
    this.notificador = notificador;
  }

  static filtrarPorRadio(candidatos) {
    return candidatos.filter((c) => c.distanciaKm <= c.receptor.radioCoberturaKm);
  }

  static filtrarPorCapacidad(candidatos, pesoKg) {
    return candidatos.filter((c) => c.receptor.tieneCapacidadPara(pesoKg));
  }

  static ordenarPorProximidad(candidatos) {
    return [...candidatos].sort((a, b) => a.distanciaKm - b.distanciaKm);
  }

  static calcularSugerencias(lote, receptores) {
    if (!lote.ubicacion) return [];
    const candidatos = receptores
      .filter((r) => r.estaDisponible())
      .map((receptor) => ({ receptor, distanciaKm: receptor.ubicacion.distanciaKm(lote.ubicacion) }));
    const enRadio = ModuloEmparejamiento.filtrarPorRadio(candidatos);
    const conCapacidad = ModuloEmparejamiento.filtrarPorCapacidad(enRadio, lote.pesoKg);
    return ModuloEmparejamiento.ordenarPorProximidad(conCapacidad);
  }

  async ejecutar(lote, donante) {
    const filas = await this.repos.usuarios.receptoresCandidatos();
    const receptores = filas.map((f) => Usuario.desdeFila(f));
    const sugerencias = ModuloEmparejamiento.calcularSugerencias(lote, receptores);

    await this.repos.emparejamientos.guardarVarios(
      lote.idLote,
      sugerencias.map((s) => ({ idReceptor: s.receptor.idUsuario, distanciaKm: s.distanciaKm })),
    );

    await Promise.all(
      sugerencias
        .filter((s) => s.receptor.avisarNuevosLotes)
        .map((s) =>
          this.notificador.enviar(
            s.receptor.idUsuario,
            `${donante.nombre} publicó ${lote.nombre} (${lote.pesoKg} kg) a ${s.distanciaKm.toFixed(1)} km`,
            { tipo: TipoNotificacion.NUEVO_LOTE, idLote: lote.idLote },
          ),
        ),
    );
    return sugerencias;
  }
}
