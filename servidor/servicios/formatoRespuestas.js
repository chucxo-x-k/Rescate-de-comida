import { LoteAlimentos } from '../modelos/LoteAlimentos.js';
import { Ubicacion } from '../modelos/Ubicacion.js';
import { EstadoRuta, RolUsuario } from '../modelos/enumeraciones.js';
import { RutaRecoleccion } from '../modelos/RutaRecoleccion.js';

const redondear1 = (n) => (n === null || n === undefined ? null : Math.round(Number(n) * 10) / 10);

export function vistaLote(fila, { usuario = null, umbralHoras = 6, horasNuevo = 2 } = {}) {
  const lote = LoteAlimentos.desdeFila(fila);
  const distanciaKm =
    usuario?.ubicacion && lote.ubicacion ? usuario.ubicacion.distanciaKm(lote.ubicacion) : null;
  return {
    ...lote.toJSON(),
    foto: fila.foto_principal ?? null,
    donante: {
      idUsuario: fila.id_donante,
      nombre: fila.donante_nombre ?? null,
      verificado: fila.donante_verificacion === 'VERIFICADO',
      confiabilidad: fila.donante_confiabilidad === undefined ? null : Number(fila.donante_confiabilidad),
    },
    ruta: fila.id_ruta
      ? {
          idRuta: fila.id_ruta,
          estado: fila.ruta_estado,
          idReceptor: fila.id_receptor,
          receptorNombre: fila.receptor_nombre ?? null,
          idVoluntario: fila.id_voluntario ?? null,
          voluntarioNombre: fila.voluntario_nombre ?? null,
        }
      : null,
    distanciaKm: redondear1(distanciaKm),
    urgente: lote.estaProximoAVencer(umbralHoras),
    nuevo: lote.esNuevo(horasNuevo),
  };
}

export function vistaRuta(fila, { usuario = null, secretoCodigo = null, umbralHoras = 6 } = {}) {
  const lote = LoteAlimentos.desdeFila({
    id_lote: fila.id_lote,
    id_donante: fila.id_donante,
    id_categoria: fila.id_categoria,
    nombre: fila.lote_nombre,
    descripcion: fila.lote_descripcion,
    peso_kg: fila.peso_kg,
    fecha_caducidad: fila.fecha_caducidad,
    hora_caducidad: fila.hora_caducidad,
    direccion_recogida: fila.direccion_recogida,
    latitud: fila.recogida_latitud,
    longitud: fila.recogida_longitud,
    estado: fila.lote_estado,
  });
  const ruta = RutaRecoleccion.desdeFila(fila);
  const esAdmin = usuario?.rol === RolUsuario.ADMINISTRADOR;
  const participa = esAdmin || (usuario && ruta.esParticipante(usuario.idUsuario, fila.id_donante));
  const conContactos = participa && ruta.estado !== EstadoRuta.DISPONIBLE;
  const recogida = lote.ubicacion;
  const entrega = Ubicacion.desde(fila.receptor_latitud, fila.receptor_longitud, fila.receptor_direccion);
  const distanciaVoluntarioKm =
    usuario?.ubicacion && recogida ? redondear1(usuario.ubicacion.distanciaKm(recogida)) : null;

  const mostrarCodigo =
    secretoCodigo &&
    usuario?.idUsuario === ruta.idReceptor &&
    [EstadoRuta.DISPONIBLE, EstadoRuta.EN_RECOLECCION, EstadoRuta.EN_CAMINO].includes(ruta.estado);

  let paso = 1;
  if (ruta.estado === EstadoRuta.EN_RECOLECCION) paso = 2;
  if (ruta.estado === EstadoRuta.EN_CAMINO) paso = 3;
  if (ruta.estado === EstadoRuta.ENTREGADA) paso = 4;

  return {
    ...ruta.toJSON(),
    paso,
    checklistAprobado: Boolean(fila.checklist_aprobado),
    distanciaVoluntarioKm,
    urgente: lote.estaProximoAVencer(umbralHoras),
    lote: {
      idLote: lote.idLote,
      nombre: lote.nombre,
      descripcion: lote.descripcion,
      pesoKg: lote.pesoKg,
      categoria: fila.categoria,
      fechaCaducidad: lote.fechaCaducidad,
      horaCaducidad: lote.horaCaducidad,
      horasRestantes: Math.round(lote.horasRestantes() * 10) / 10,
      estado: lote.estado,
      foto: fila.foto_principal ?? null,
    },
    recoleccion: {
      nombre: fila.donante_nombre,
      direccion: fila.direccion_recogida,
      latitud: recogida?.latitud ?? null,
      longitud: recogida?.longitud ?? null,
      telefono: conContactos ? fila.donante_telefono : null,
    },
    entrega: {
      nombre: fila.receptor_nombre,
      direccion: fila.receptor_direccion,
      latitud: entrega?.latitud ?? null,
      longitud: entrega?.longitud ?? null,
      telefono: conContactos ? fila.receptor_telefono : null,
    },
    voluntario: fila.id_voluntario
      ? { idUsuario: fila.id_voluntario, nombre: fila.voluntario_nombre, telefono: conContactos ? fila.voluntario_telefono : null }
      : null,
    codigoConfirmacion: mostrarCodigo ? RutaRecoleccion.codigoEsperado(ruta.idRuta, secretoCodigo) : null,
  };
}
