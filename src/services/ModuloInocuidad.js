import { AHORA, transaccion } from '../config/db.js';
import { ChecklistInocuidad, ItemChecklist } from '../domain/ChecklistInocuidad.js';
import {
  CRITERIOS_INOCUIDAD, EstadoHistorial, EstadoLote, EstadoRuta, TipoNotificacion,
} from '../domain/enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import { aNumero, texto } from '../utils/validacion.js';

/**
 * CU 10: Validar checklist de inocuidad.
 * Requerimiento ético-legal 2: el checklist se marca obligatoriamente antes
 * de confirmar la recolección; al aprobarse la ruta pasa a EN_CAMINO.
 */
export class ModuloInocuidad {
  constructor({ repos, notificador }) {
    this.repos = repos;
    this.notificador = notificador;
  }

  presentarChecklist() {
    return CRITERIOS_INOCUIDAD.map((criterio) => ({ criterio, esCritico: true }));
  }

  async #rutaDelVoluntario(voluntario, idRuta, estadosPermitidos) {
    const fila = await this.repos.rutas.detalle(idRuta);
    if (!fila) throw ErrorApp.noEncontrado('Ruta no encontrada.');
    if (fila.id_voluntario !== voluntario.idUsuario) throw ErrorApp.prohibido('Esta ruta no está asignada a ti.');
    if (!estadosPermitidos.includes(fila.estado)) {
      throw ErrorApp.conflicto('El checklist se valida al recoger el lote, con la ruta en recolección.');
    }
    return fila;
  }

  async #guardarChecklist(checklist, aprobado) {
    const existente = await this.repos.checklists.buscarPorRuta(checklist.idRuta);
    const datos = {
      temperatura_c: checklist.temperaturaC,
      aprobado: aprobado ? 1 : 0,
      observaciones: checklist.observaciones,
      fecha_validacion: AHORA,
    };
    let idChecklist;
    if (existente) {
      idChecklist = existente.id_checklist;
      await this.repos.checklists.actualizar(idChecklist, datos);
    } else {
      idChecklist = await this.repos.checklists.guardar({ id_ruta: checklist.idRuta, ...datos });
    }
    await this.repos.itemsChecklist.reemplazar(idChecklist, checklist.items);
    checklist.idChecklist = idChecklist;
  }

  #construir(idRuta, { respuestas, temperaturaC, observaciones }) {
    const checklist = ChecklistInocuidad.desdeRespuestas(
      idRuta,
      respuestas ?? {},
      aNumero(temperaturaC),
      texto(observaciones) || null,
    );
    if (!checklist.temperaturaValida()) throw ErrorApp.solicitudInvalida('Temperatura fuera de rango.');
    return checklist;
  }

  /** Pasos 1-4 del CU 10: evalúa respuestas y, si todo cumple, otorga el visto bueno. */
  async evaluar(voluntario, idRuta, datos) {
    const fila = await this.#rutaDelVoluntario(voluntario, idRuta, [EstadoRuta.EN_RECOLECCION]);
    const checklist = this.#construir(idRuta, datos);
    const aprobado = checklist.todosCriticosAprobados();

    await transaccion(async () => {
      await this.#guardarChecklist(checklist, aprobado);
      if (aprobado) await this.otorgarVistoBueno(idRuta);
    });

    if (aprobado) {
      await this.notificador.enviar(
        fila.id_receptor,
        `${fila.lote_nombre} pasó el checklist de inocuidad y va en camino. Ten listo tu código de confirmación.`,
        { tipo: TipoNotificacion.CUENTA, idLote: fila.id_lote },
      );
    }
    return { aprobado, incumplidos: checklist.criteriosIncumplidos(), checklist: checklist.toJSON() };
  }

  /** Visto bueno: confirma la recolección (EN_RECOLECCION → EN_CAMINO). */
  async otorgarVistoBueno(idRuta) {
    const ok = await this.repos.rutas.cambiarEstadoSi(idRuta, EstadoRuta.EN_RECOLECCION, EstadoRuta.EN_CAMINO);
    if (!ok) throw ErrorApp.conflicto('La ruta cambió de estado; recarga la pantalla.');
  }

  /** Alerta de rechazo del lote por incumplimiento normativo. */
  async reportarIncumplimiento(voluntario, idRuta, datos) {
    const observaciones = texto(datos.observaciones);
    if (!observaciones) throw ErrorApp.solicitudInvalida('Describe el incumplimiento en observaciones.');
    const fila = await this.#rutaDelVoluntario(voluntario, idRuta, [EstadoRuta.EN_RECOLECCION, EstadoRuta.EN_CAMINO]);
    const checklist = this.#construir(idRuta, { ...datos, observaciones });

    await transaccion(async () => {
      await this.#guardarChecklist(checklist, false);
      const rutaOk = await this.repos.rutas.cambiarEstadoSi(idRuta, fila.estado, EstadoRuta.CANCELADA, { cerrar: true });
      if (!rutaOk) throw ErrorApp.conflicto('La ruta cambió de estado; recarga la pantalla.');
      await this.repos.lotes.cambiarEstadoSi(fila.id_lote, EstadoLote.EN_RECOLECCION, EstadoLote.CANCELADO);
      await this.repos.historial.registrarParticipantes({
        idLote: fila.id_lote,
        idDonante: fila.id_donante,
        idReceptor: fila.id_receptor,
        idVoluntario: voluntario.idUsuario,
        estado: EstadoHistorial.CANCELADO,
      });
    });

    await this.notificador.enviarVarios(
      [fila.id_donante, fila.id_receptor],
      `El lote ${fila.lote_nombre} fue rechazado por incumplir el checklist de inocuidad: ${observaciones}`,
      { tipo: TipoNotificacion.CUENTA, idLote: fila.id_lote },
    );
    return { cancelada: true };
  }

  async obtenerPorRuta(idRuta) {
    const fila = await this.repos.checklists.buscarPorRuta(idRuta);
    if (!fila) return null;
    const items = await this.repos.itemsChecklist.porChecklist(fila.id_checklist);
    return new ChecklistInocuidad({
      idChecklist: fila.id_checklist,
      idRuta,
      temperaturaC: fila.temperatura_c,
      observaciones: fila.observaciones,
      items: items.map((i) => new ItemChecklist({ criterio: i.criterio, cumple: i.cumple })),
    }).toJSON();
  }
}
