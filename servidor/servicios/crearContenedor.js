import { env } from '../configuracion/variablesEntorno.js';
import { crearRepositorios } from '../repositorios/crearRepositorios.js';
import { AlmacenamientoLocal } from '../infraestructura/AlmacenamientoLocal.js';
import { AlmacenamientoNube } from '../infraestructura/AlmacenamientoNube.js';
import { CanalTiempoReal } from '../infraestructura/CanalTiempoReal.js';
import { ServicioNotificaciones } from './ServicioNotificaciones.js';
import { ServicioAutenticacion } from './ServicioAutenticacion.js';
import { ServicioPerfil } from './ServicioPerfil.js';
import { ServicioVerificacion } from './ServicioVerificacion.js';
import { ModuloEmparejamiento } from './ModuloEmparejamiento.js';
import { ServicioLotes } from './ServicioLotes.js';
import { ServicioRutas } from './ServicioRutas.js';
import { ModuloInocuidad } from './ModuloInocuidad.js';
import { ServicioEvidencia } from './ServicioEvidencia.js';
import { ServicioCalificaciones } from './ServicioCalificaciones.js';
import { SistemaKPIs } from './SistemaKPIs.js';
import { ModuloAlertas } from './ModuloAlertas.js';
import { SistemaDeTiempo } from './SistemaDeTiempo.js';
import { ServicioAdmin } from './ServicioAdministrador.js';

function crearAlmacenamiento(config) {
  if (config.driver === 's3') {
    return new AlmacenamientoNube({ bucket: config.s3Bucket, region: config.s3Region, urlPublica: config.s3UrlPublica });
  }
  return new AlmacenamientoLocal(config.directorioLocal);
}

export function crearContenedor(config = env) {
  const repos = crearRepositorios();
  const almacenamiento = crearAlmacenamiento(config.almacenamiento);
  const canal = new CanalTiempoReal();
  const notificador = new ServicioNotificaciones({ repos, canal });
  const secretoCodigo = `${config.jwtSecreto}:codigos`;

  const emparejamiento = new ModuloEmparejamiento({ repos, notificador });
  const moduloAlertas = new ModuloAlertas({ repos, notificador });

  return {
    config,
    repos,
    almacenamiento,
    canal,
    notificador,
    autenticacion: new ServicioAutenticacion({
      repos,
      notificador,
      jwtSecreto: config.jwtSecreto,
      jwtExpiraHoras: config.jwtExpiraHoras,
    }),
    perfil: new ServicioPerfil({ repos }),
    verificacion: new ServicioVerificacion({ repos, almacenamiento, notificador }),
    emparejamiento,
    lotes: new ServicioLotes({ repos, almacenamiento, emparejamiento, notificador }),
    rutas: new ServicioRutas({ repos, notificador, secretoCodigo }),
    inocuidad: new ModuloInocuidad({ repos, notificador }),
    evidencia: new ServicioEvidencia({ repos, almacenamiento, notificador, secretoCodigo }),
    calificaciones: new ServicioCalificaciones({ repos }),
    kpis: new SistemaKPIs({ repos }),
    alertas: moduloAlertas,
    tiempo: new SistemaDeTiempo({ repos, moduloAlertas }),
    admin: new ServicioAdmin({ repos, notificador }),
  };
}
