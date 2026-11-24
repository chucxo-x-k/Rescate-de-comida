import { transaccion } from '../config/db.js';
import { EvidenciaEntrega } from '../domain/EvidenciaEntrega.js';
import { RutaRecoleccion } from '../domain/RutaRecoleccion.js';
import { EstadoHistorial, EstadoLote, EstadoRuta, RolUsuario, TipoNotificacion } from '../domain/enums.js';
import { ErrorApp } from '../utils/ErrorApp.js';
import { exigir, texto } from '../utils/validacion.js';

const MAX_FOTOS = 6;

/** CU 9: Registrar evidencia y confirmación digital (incluye el CU 10). */
export class ServicioEvidencia {
  constructor({ repos, almacenamiento, notificador, secretoCodigo }) {
    this.repos = repos;
    this.almacenamiento = almacenamiento;
    this.notificador = notificador;
    this.secretoCodigo = secretoCodigo;
  }

  async registrar(voluntario, idRuta, { fotos = [], firma = null, codigo = null }) {
    const fila = await this.repos.rutas.detalle(idRuta);
    if (!fila) throw ErrorApp.noEncontrado('Ruta no encontrada.');
    if (fila.id_voluntario !== voluntario.idUsuario) throw ErrorApp.prohibido('Esta ruta no está asignada a ti.');
    if (fila.estado === EstadoRuta.EN_RECOLECCION) {
      throw ErrorApp.conflicto('Primero valida el checklist de inocuidad.');
    }
    if (fila.estado !== EstadoRuta.EN_CAMINO) throw ErrorApp.conflicto('La ruta ya fue cerrada.');

    const checklist = await this.repos.checklists.buscarPorRuta(idRuta);
    if (!checklist?.aprobado) throw ErrorApp.conflicto('El checklist de inocuidad no está aprobado.');

    const codigoLimpio = texto(codigo) || null;
    const evidencia = new EvidenciaEntrega({
      idRuta,
      firmaDigital: firma ? 'pendiente' : null,
      codigoConfirmacion: codigoLimpio,
    });
    const errores = evidencia.validar(fotos.length);
    if (fotos.length > MAX_FOTOS) errores.fotos = `Máximo ${MAX_FOTOS} fotografías.`;
    if (!errores.codigo && codigoLimpio && codigoLimpio !== RutaRecoleccion.codigoEsperado(idRuta, this.secretoCodigo)) {
      errores.codigo = 'El código no coincide con el del receptor.';
    }
    exigir(errores);

    const urlsFotos = [];
    for (const foto of fotos) urlsFotos.push(await this.almacenamiento.subir(foto, 'evidencias'));
    const urlFirma = firma ? await this.almacenamiento.subir(firma, 'firmas') : null;

    await transaccion(async () => {
      const idEvidencia = await this.repos.evidencias.guardar({
        id_ruta: idRuta,
        firma_digital: urlFirma,
        codigo_confirmacion: codigoLimpio,
      });
      for (const url of urlsFotos) {
        await this.repos.fotosEvidencia.guardar({ id_evidencia: idEvidencia, url_foto: url });
      }
      await this.cerrarCicloLote(fila);
    });

    await this.notificador.enviarVarios(
      [fila.id_donante, fila.id_receptor],
      `${fila.lote_nombre} fue entregado. ¡Gracias por rescatar ${fila.peso_kg} kg de alimento!`,
      { tipo: TipoNotificacion.CUENTA, idLote: fila.id_lote },
    );
    return this.obtener(voluntario, idRuta);
  }

  /** Marca la ruta ENTREGADA y el lote ENTREGADO: el lote concluye su ciclo de vida. */
  async cerrarCicloLote(fila) {
    const rutaOk = await this.repos.rutas.cambiarEstadoSi(fila.id_ruta, EstadoRuta.EN_CAMINO, EstadoRuta.ENTREGADA, {
      cerrar: true,
    });
    if (!rutaOk) throw ErrorApp.conflicto('La ruta cambió de estado; recarga la pantalla.');
    await this.repos.lotes.cambiarEstadoSi(fila.id_lote, EstadoLote.EN_RECOLECCION, EstadoLote.ENTREGADO);
    await this.repos.historial.registrarParticipantes({
      idLote: fila.id_lote,
      idDonante: fila.id_donante,
      idReceptor: fila.id_receptor,
      idVoluntario: fila.id_voluntario,
      estado: EstadoHistorial.ENTREGADO,
    });
  }

  async obtener(usuario, idRuta) {
    const ruta = await this.repos.rutas.detalle(idRuta);
    if (!ruta) throw ErrorApp.noEncontrado('Ruta no encontrada.');
    const participa = [ruta.id_donante, ruta.id_receptor, ruta.id_voluntario].includes(usuario.idUsuario);
    if (!participa && usuario.rol !== RolUsuario.ADMINISTRADOR) throw ErrorApp.prohibido();

    const fila = await this.repos.evidencias.buscarPorRuta(idRuta);
    if (!fila) return null;
    const fotos = await this.repos.fotosEvidencia.porEvidencia(fila.id_evidencia);
    return new EvidenciaEntrega({
      idEvidencia: fila.id_evidencia,
      idRuta,
      fotosUrl: fotos.map((f) => f.url_foto),
      firmaDigital: fila.firma_digital,
      codigoConfirmacion: fila.codigo_confirmacion ? '••••••' : null,
      fechaHora: fila.fecha_registro,
    }).toJSON();
  }
}
