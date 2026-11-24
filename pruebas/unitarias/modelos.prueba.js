import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Ubicacion } from '../../servidor/modelos/Ubicacion.js';
import { LoteAlimentos } from '../../servidor/modelos/LoteAlimentos.js';
import { Usuario, Receptor } from '../../servidor/modelos/Usuario.js';
import { RutaRecoleccion } from '../../servidor/modelos/RutaRecoleccion.js';
import { ChecklistInocuidad } from '../../servidor/modelos/ChecklistInocuidad.js';
import { EvidenciaEntrega } from '../../servidor/modelos/EvidenciaEntrega.js';
import { SolicitudVerificacion } from '../../servidor/modelos/SolicitudVerificacion.js';
import { IndicadoresKPI } from '../../servidor/modelos/IndicadoresKPI.js';
import { ModuloEmparejamiento } from '../../servidor/servicios/ModuloEmparejamiento.js';
import { CRITERIOS_INOCUIDAD, EstadoLote, EstadoRuta, TipoDocumento } from '../../servidor/modelos/enumeraciones.js';
import { fechaLocal, horaLocal } from '../../servidor/utilidades/fechas.js';

const loteBase = (extra = {}) => ({
  id_lote: 1,
  id_donante: 10,
  id_categoria: 1,
  nombre: 'Pan dulce',
  descripcion: 'Conchas del día',
  peso_kg: 12,
  fecha_caducidad: '2099-12-31',
  hora_caducidad: '12:00:00',
  direccion_recogida: 'Centro',
  latitud: 19.4326,
  longitud: -99.1332,
  declaracion_buena_fe: 1,
  ...extra,
});

describe('Ubicacion', () => {
  test('calcula distancias con Haversine', () => {
    const zocalo = new Ubicacion(19.4326, -99.1332);
    const bellasArtes = new Ubicacion(19.4352, -99.1412);
    const km = zocalo.distanciaKm(bellasArtes);
    assert.ok(km > 0.8 && km < 0.95, `distancia inesperada: ${km}`);
    assert.equal(zocalo.distanciaKm(zocalo), 0);
  });

  test('rechaza coordenadas fuera de rango', () => {
    assert.throws(() => new Ubicacion(120, 0), RangeError);
    assert.equal(Ubicacion.desde(null, null), null);
  });
});

describe('LoteAlimentos', () => {
  test('calcula horas restantes y proximidad de caducidad', () => {
    const ahora = new Date('2099-12-31T08:00:00');
    const lote = new LoteAlimentos(loteBase());
    assert.equal(lote.horasRestantes(ahora), 4);
    assert.ok(lote.estaProximoAVencer(6, ahora));
    assert.ok(!lote.estaProximoAVencer(2, ahora));
    assert.ok(!lote.estaCaducado(ahora));
  });

  test('sin hora de caducidad se toma el final del día', () => {
    const lote = new LoteAlimentos(loteBase({ hora_caducidad: null }));
    assert.equal(lote.momentoCaducidad.getHours(), 23);
  });

  test('exige declaración de buena fe y coordenadas', () => {
    const errores = LoteAlimentos.validarNuevo(loteBase({ declaracion_buena_fe: false, latitud: null }));
    assert.ok(errores.declaracion_buena_fe);
    assert.ok(errores.ubicacion);
  });

  test('rechaza lotes ya caducados', () => {
    const ayer = new Date(Date.now() - 86_400_000);
    const errores = LoteAlimentos.validarNuevo(loteBase({ fecha_caducidad: fechaLocal(ayer), hora_caducidad: horaLocal(ayer) }));
    assert.ok(errores.fecha_caducidad);
  });

  test('respeta las transiciones de estado', () => {
    const lote = new LoteAlimentos(loteBase());
    lote.cambiarEstado(EstadoLote.EN_RECOLECCION);
    lote.cambiarEstado(EstadoLote.ENTREGADO);
    assert.throws(() => lote.cambiarEstado(EstadoLote.PUBLICADO));
  });
});

describe('RutaRecoleccion', () => {
  test('asigna voluntario solo si está disponible', () => {
    const ruta = new RutaRecoleccion({ id_ruta: 5, id_lote: 1, id_receptor: 2 });
    ruta.asignarVoluntario(3);
    assert.equal(ruta.estado, EstadoRuta.EN_RECOLECCION);
    assert.throws(() => ruta.asignarVoluntario(4));
  });

  test('el código de confirmación es estable y de 6 dígitos', () => {
    const a = RutaRecoleccion.codigoEsperado(7, 'secreto');
    assert.match(a, /^\d{6}$/);
    assert.equal(a, RutaRecoleccion.codigoEsperado(7, 'secreto'));
    assert.notEqual(a, RutaRecoleccion.codigoEsperado(8, 'secreto'));
  });
});

describe('ChecklistInocuidad', () => {
  test('aprueba solo si todos los puntos críticos cumplen', () => {
    const todos = Object.fromEntries(CRITERIOS_INOCUIDAD.map((c) => [c, true]));
    assert.ok(ChecklistInocuidad.desdeRespuestas(1, todos, 4).todosCriticosAprobados());

    const incompleto = { ...todos, [CRITERIOS_INOCUIDAD[0]]: false };
    const checklist = ChecklistInocuidad.desdeRespuestas(1, incompleto, 4);
    assert.ok(!checklist.todosCriticosAprobados());
    assert.deepEqual(checklist.criteriosIncumplidos(), [CRITERIOS_INOCUIDAD[0]]);
  });
});

describe('EvidenciaEntrega', () => {
  test('requiere foto y firma o código', () => {
    assert.ok(new EvidenciaEntrega({ idRuta: 1 }).validar(0).fotos);
    assert.ok(new EvidenciaEntrega({ idRuta: 1 }).validar(1).confirmacion);
    assert.deepEqual(new EvidenciaEntrega({ idRuta: 1, codigoConfirmacion: '123456' }).validar(1), {});
    assert.ok(new EvidenciaEntrega({ idRuta: 1, codigoConfirmacion: '12' }).validar(1).codigo);
  });
});

describe('SolicitudVerificacion', () => {
  test('la constancia de organización aplica solo a receptores', () => {
    assert.equal(SolicitudVerificacion.documentosRequeridos('DONANTE').length, 3);
    assert.ok(SolicitudVerificacion.documentosRequeridos('RECEPTOR').includes(TipoDocumento.CONSTANCIA_ORGANIZACION));
  });

  test('no se envía a revisión con documentos faltantes y el rechazo exige motivo', () => {
    const solicitud = new SolicitudVerificacion({ id_solicitud: 1, id_usuario: 2 }, [
      { tipo_documento: TipoDocumento.IDENTIFICACION_OFICIAL, url_archivo: 'documentos/a.pdf', estado: 'CARGADO' },
    ]);
    assert.throws(() => solicitud.marcarParaRevision('DONANTE'));

    const completa = new SolicitudVerificacion(
      { id_solicitud: 1, id_usuario: 2 },
      SolicitudVerificacion.documentosRequeridos('DONANTE').map((t) => ({
        tipo_documento: t, url_archivo: 'documentos/x.pdf', estado: 'CARGADO',
      })),
    );
    completa.marcarParaRevision('DONANTE');
    assert.throws(() => completa.resolver(false, '', 1));
    completa.resolver(true, null, 1);
    assert.equal(completa.estado, 'APROBADA');
  });
});

describe('Emparejamiento geográfico', () => {
  const receptor = (id, lat, lng, extra = {}) =>
    Usuario.desdeFila({
      id_usuario: id, nombre: `R${id}`, rol: 'RECEPTOR', latitud: lat, longitud: lng,
      estado_verificacion: 'VERIFICADO', activo: 1, recibiendo_lotes: 1, capacidad_kg: 50, radio_cobertura_km: 5,
      ...extra,
    });

  test('filtra por radio, capacidad y disponibilidad, y ordena por proximidad', () => {
    const lote = new LoteAlimentos(loteBase());
    const lejos = receptor(1, 19.4500, -99.1332);
    const cerca = receptor(2, 19.4340, -99.1332);
    const fueraDeRadio = receptor(3, 19.6000, -99.1332);
    const sinCapacidad = receptor(4, 19.4330, -99.1332, { capacidad_kg: 5 });
    const noRecibe = receptor(5, 19.4330, -99.1332, { recibiendo_lotes: 0 });

    const sugerencias = ModuloEmparejamiento.calcularSugerencias(lote, [lejos, cerca, fueraDeRadio, sinCapacidad, noRecibe]);
    assert.deepEqual(sugerencias.map((s) => s.receptor.idUsuario), [2, 1]);
    assert.ok(sugerencias[0].receptor instanceof Receptor);
  });
});

describe('IndicadoresKPI', () => {
  test('convierte kg en raciones', () => {
    assert.equal(IndicadoresKPI.calcularRaciones(10, 0.4), 25);
    assert.equal(IndicadoresKPI.calcularRaciones(10, 0), 0);
  });
});
