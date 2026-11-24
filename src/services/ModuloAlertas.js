import { LoteAlimentos } from '../domain/LoteAlimentos.js';
import { Usuario } from '../domain/Usuario.js';
import { TipoNotificacion } from '../domain/enums.js';

export class ModuloAlertas {
  constructor({ repos, notificador }) {
    this.repos = repos;
    this.notificador = notificador;
  }

  async verificarCaducidades() {
    const [umbralHoras, radioVoluntarios] = await Promise.all([
      this.repos.configuracion.obtenerNumero('umbral_caducidad_horas', 6),
      this.repos.configuracion.obtenerNumero('radio_voluntarios_km', 10),
    ]);

    const caducados = await this.repos.lotes.marcarCaducados();
    for (const lote of caducados) {
      await this.notificador.enviar(lote.id_donante, `Tu lote ${lote.nombre} caducó sin ser rescatado.`, {
        tipo: TipoNotificacion.CUENTA,
        idLote: lote.id_lote,
      });
    }

    const porVencer = await this.repos.lotes.porVencerSinReclamar(umbralHoras);
    if (porVencer.length === 0) return { caducados: caducados.length, alertasEnviadas: 0 };

    const receptores = (await this.repos.usuarios.receptoresCandidatos()).map((f) => Usuario.desdeFila(f));
    const voluntarios = (await this.repos.usuarios.voluntariosActivos()).map((f) => Usuario.desdeFila(f));
    const donantes = new Map();
    let alertasEnviadas = 0;

    for (const fila of porVencer) {
      const lote = LoteAlimentos.desdeFila(fila);
      const horas = Math.max(1, Math.ceil(lote.horasRestantes()));

      if (!donantes.has(fila.id_donante)) {
        const d = await this.repos.usuarios.buscarPorId(fila.id_donante);
        donantes.set(fila.id_donante, d ? Usuario.desdeFila(d) : null);
      }
      const donante = donantes.get(fila.id_donante);
      const destinos = [];
      if (donante?.avisarCaducidades) {
        destinos.push([donante.idUsuario, `${lote.nombre} vence en ${horas} h y sigue sin reclamar`]);
      }

      if (!fila.id_ruta) {
        for (const r of receptores) {
          if (!r.avisarCaducidades || !lote.ubicacion || !r.tieneCapacidadPara(lote.pesoKg)) continue;
          const km = r.ubicacion.distanciaKm(lote.ubicacion);
          if (km <= r.radioCoberturaKm) {
            destinos.push([r.idUsuario, `${lote.nombre} vence en ${horas} h y sigue sin reclamar (a ${km.toFixed(1)} km)`]);
          }
        }
      } else {
        for (const v of voluntarios) {
          if (!v.avisarCaducidades) continue;
          const cerca = !v.ubicacion || !lote.ubicacion || v.ubicacion.distanciaKm(lote.ubicacion) <= radioVoluntarios;
          if (cerca) destinos.push([v.idUsuario, `Ruta urgente: ${lote.nombre} vence en ${horas} h y nadie la ha tomado`]);
        }
      }

      for (const [idUsuario, mensaje] of destinos) {
        const yaAvisado = await this.repos.notificaciones.existe(idUsuario, lote.idLote, TipoNotificacion.CADUCIDAD_PROXIMA);
        if (yaAvisado) continue;
        await this.notificador.enviar(idUsuario, mensaje, { tipo: TipoNotificacion.CADUCIDAD_PROXIMA, idLote: lote.idLote });
        alertasEnviadas += 1;
      }
    }
    return { caducados: caducados.length, alertasEnviadas };
  }
}
