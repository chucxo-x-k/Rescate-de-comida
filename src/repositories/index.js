import { RepositorioUsuarios, RepositorioDisponibilidad } from './RepositorioUsuarios.js';
import { RepositorioSolicitudes, RepositorioDocumentos } from './RepositorioVerificacion.js';
import {
  RepositorioLotes, RepositorioFotosLote, RepositorioCategorias, RepositorioEmparejamientos,
} from './RepositorioLotes.js';
import {
  RepositorioRutas, RepositorioChecklists, RepositorioItemsChecklist, RepositorioEvidencias,
  RepositorioFotosEvidencia, RepositorioHistorial, RepositorioCalificaciones,
} from './RepositorioRutas.js';
import { RepositorioNotificaciones } from './RepositorioNotificaciones.js';
import { RepositorioConfiguracion } from './RepositorioConfiguracion.js';

/** Un repositorio por tabla del diccionario de datos (17). */
export function crearRepositorios() {
  return {
    usuarios: new RepositorioUsuarios(),
    disponibilidad: new RepositorioDisponibilidad(),
    solicitudes: new RepositorioSolicitudes(),
    documentos: new RepositorioDocumentos(),
    categorias: new RepositorioCategorias(),
    lotes: new RepositorioLotes(),
    fotosLote: new RepositorioFotosLote(),
    emparejamientos: new RepositorioEmparejamientos(),
    rutas: new RepositorioRutas(),
    checklists: new RepositorioChecklists(),
    itemsChecklist: new RepositorioItemsChecklist(),
    evidencias: new RepositorioEvidencias(),
    fotosEvidencia: new RepositorioFotosEvidencia(),
    notificaciones: new RepositorioNotificaciones(),
    historial: new RepositorioHistorial(),
    calificaciones: new RepositorioCalificaciones(),
    configuracion: new RepositorioConfiguracion(),
  };
}
