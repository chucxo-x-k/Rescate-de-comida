import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearContenedor } from '../../src/services/index.js';
import { crearApp } from '../../src/app.js';
import { cerrarPool } from '../../src/config/db.js';
import { CRITERIOS_INOCUIDAD } from '../../src/domain/enums.js';
import { RutaRecoleccion } from '../../src/domain/RutaRecoleccion.js';
import { fechaLocal, horaLocal } from '../../src/utils/fechas.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const sufijo = Date.now();
let contenedor;
let servidor;
let base;
const tokens = {};
const ids = {};

const imagen = () => new Blob([PNG], { type: 'image/png' });

async function api(metodo, ruta, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${base}${ruta}`, { method: metodo, headers, body });
  const datos = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { estado: res.status, datos };
}

async function registrar(rol, nombre, latitud, longitud) {
  const correo = `${rol.toLowerCase()}.${sufijo}@prueba.mx`;
  const { estado, datos } = await api('POST', '/api/auth/registro', {
    json: {
      rol, nombre, correo, telefono: '5512345678', contrasena: 'Segura123', confirmarContrasena: 'Segura123',
      direccion: `${nombre} dirección`, latitud, longitud, aceptaTerminos: true,
    },
  });
  assert.equal(estado, 201, JSON.stringify(datos));
  tokens[rol] = datos.token;
  ids[rol] = datos.usuario.idUsuario;
  return correo;
}

async function subirDocumentos(rol, tipos) {
  for (const tipo of tipos) {
    const form = new FormData();
    form.append('archivo', imagen(), 'doc.png');
    const r = await api('POST', `/api/verificacion/documentos/${tipo}`, { token: tokens[rol], form });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
  }
  const envio = await api('POST', '/api/verificacion/enviar', { token: tokens[rol] });
  assert.equal(envio.estado, 200, JSON.stringify(envio.datos));
  assert.equal(envio.datos.estadoVerificacion, 'EN_REVISION');
}

function formLote({ nombre, descripcion, horasParaCaducar = 30, peso = 15 }) {
  const caducidad = new Date(Date.now() + horasParaCaducar * 3_600_000);
  const form = new FormData();
  form.append('nombre', nombre);
  form.append('descripcion', descripcion);
  form.append('idCategoria', '1');
  form.append('pesoKg', String(peso));
  form.append('fechaCaducidad', fechaLocal(caducidad));
  form.append('horaCaducidad', horaLocal(caducidad).slice(0, 5));
  form.append('direccionRecogida', 'Centro Histórico');
  form.append('latitud', '19.4326');
  form.append('longitud', '-99.1332');
  form.append('declaracionBuenaFe', 'true');
  form.append('fotos', imagen(), 'foto.png');
  return form;
}

async function esperarNotificacion(token, filtro, tiempoMaximoMs = 5000) {
  const controlador = new AbortController();
  const res = await fetch(`${base}/api/notificaciones/stream?token=${encodeURIComponent(token)}`, {
    signal: controlador.signal,
  });
  const lector = res.body.getReader();
  const decodificador = new TextDecoder();
  let bufer = '';
  const listo = (async () => {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) return null;
      bufer += decodificador.decode(value, { stream: true });
      const bloques = bufer.split('\n\n');
      bufer = bloques.pop();
      for (const bloque of bloques) {
        const evento = /event: (\w+)/.exec(bloque)?.[1];
        const datos = /data: (.*)/.exec(bloque)?.[1];
        if (evento === 'notificacion' && datos) {
          const carga = JSON.parse(datos);
          if (filtro(carga.notificacion)) return carga.notificacion;
        }
      }
    }
  })();
  const limite = new Promise((_, rechazar) =>
    setTimeout(() => rechazar(new Error('No llegó la notificación en el tiempo límite')), tiempoMaximoMs),
  );
  return {
    conectado: new Promise((r) => setTimeout(r, 150)),
    resultado: Promise.race([listo, limite]).finally(() => controlador.abort()),
  };
}

before(async () => {
  contenedor = crearContenedor();
  const app = crearApp(contenedor);
  await new Promise((resolver) => {
    servidor = app.listen(0, resolver);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
  const admin = await api('POST', '/api/auth/login', { json: { correo: 'admin@rescate.mx', contrasena: 'Admin123!' } });
  assert.equal(admin.estado, 200, 'El administrador inicial debe existir (npm run db:init).');
  tokens.ADMIN = admin.datos.token;
});

after(async () => {
  contenedor.canal.cerrar();
  await new Promise((r) => servidor.close(r));
  await cerrarPool();
});

test('CU 1 y 2: registro e inicio de sesión', async () => {
  const correo = await registrar('DONANTE', 'Tienda Prueba', 19.4326, -99.1332);
  await registrar('RECEPTOR', 'Comedor Prueba', 19.4400, -99.1400);
  await registrar('VOLUNTARIO', 'Voluntaria Prueba', 19.4380, -99.1380);

  const duplicado = await api('POST', '/api/auth/registro', {
    json: { rol: 'DONANTE', nombre: 'X', correo, telefono: '5512345678', contrasena: 'Segura123', direccion: 'X', aceptaTerminos: true },
  });
  assert.equal(duplicado.estado, 409);

  const sinTerminos = await api('POST', '/api/auth/registro', {
    json: { rol: 'DONANTE', nombre: 'X', correo: `x${sufijo}@p.mx`, telefono: '5512345678', contrasena: 'Segura123', direccion: 'X' },
  });
  assert.equal(sinTerminos.estado, 400);

  const login = await api('POST', '/api/auth/login', { json: { correo, contrasena: 'Segura123' } });
  assert.equal(login.estado, 200);
  assert.equal(login.datos.usuario.rol, 'DONANTE');
});

test('CU 3: verificación de identidad / organización', async () => {
  const sinVerificar = await api('POST', '/api/lotes', { token: tokens.DONANTE, form: formLote({ nombre: 'X', descripcion: 'X' }) });
  assert.equal(sinVerificar.estado, 403);

  const incompleta = await api('POST', '/api/verificacion/enviar', { token: tokens.DONANTE });
  assert.equal(incompleta.estado, 400);

  await subirDocumentos('DONANTE', ['IDENTIFICACION_OFICIAL', 'IDENTIFICACION_FISCAL', 'PERMISO_SANITARIO']);
  await subirDocumentos('RECEPTOR', ['IDENTIFICACION_OFICIAL', 'IDENTIFICACION_FISCAL', 'PERMISO_SANITARIO', 'CONSTANCIA_ORGANIZACION']);

  const pendientes = await api('GET', '/api/admin/verificaciones', { token: tokens.ADMIN });
  const solDonante = pendientes.datos.solicitudes.find((s) => s.usuario.idUsuario === ids.DONANTE);
  const solReceptor = pendientes.datos.solicitudes.find((s) => s.usuario.idUsuario === ids.RECEPTOR);
  assert.ok(solDonante && solReceptor);

  const idDoc = solDonante.documentos[0].idDocumento;
  const archivoAdmin = await fetch(`${base}/api/verificacion/documentos/${idDoc}/archivo`, {
    headers: { Authorization: `Bearer ${tokens.ADMIN}` },
  });
  assert.equal(archivoAdmin.status, 200);
  const archivoAjeno = await api('GET', `/api/verificacion/documentos/${idDoc}/archivo`, { token: tokens.VOLUNTARIO });
  assert.equal(archivoAjeno.estado, 403);

  const sinMotivo = await api('POST', `/api/admin/verificaciones/${solReceptor.idSolicitud}/resolver`, {
    token: tokens.ADMIN, json: { aprobar: false },
  });
  assert.equal(sinMotivo.estado, 400);

  await api('POST', `/api/admin/verificaciones/${solDonante.idSolicitud}/resolver`, { token: tokens.ADMIN, json: { aprobar: true } });
  await api('POST', `/api/admin/verificaciones/${solReceptor.idSolicitud}/resolver`, {
    token: tokens.ADMIN, json: { aprobar: false, observaciones: 'La constancia está ilegible' },
  });

  const rechazada = await api('GET', '/api/verificacion', { token: tokens.RECEPTOR });
  assert.equal(rechazada.datos.estadoVerificacion, 'RECHAZADO');
  assert.equal(rechazada.datos.solicitud.observaciones, 'La constancia está ilegible');

  await subirDocumentos('RECEPTOR', ['CONSTANCIA_ORGANIZACION']);
  const segunda = await api('GET', '/api/admin/verificaciones', { token: tokens.ADMIN });
  const solReceptor2 = segunda.datos.solicitudes.find((s) => s.usuario.idUsuario === ids.RECEPTOR);
  await api('POST', `/api/admin/verificaciones/${solReceptor2.idSolicitud}/resolver`, { token: tokens.ADMIN, json: { aprobar: true } });

  const yo = await api('GET', '/api/auth/yo', { token: tokens.RECEPTOR });
  assert.equal(yo.datos.usuario.estadoVerificacion, 'VERIFICADO');
});

test('CU 4 y 5: publicar lote y emparejamiento con aviso en menos de 5 s', async () => {
  const disp = await api('PUT', '/api/perfil/disponibilidad', {
    token: tokens.RECEPTOR,
    json: { recibiendoLotes: true, capacidadKg: 100, radioCoberturaKm: 10, horarioInicio: '08:00', horarioFin: '20:00' },
  });
  assert.equal(disp.estado, 200, JSON.stringify(disp.datos));

  const venta = formLote({ nombre: 'Pan', descripcion: 'Se vende a $20 el kilo' });
  const bloqueado = await api('POST', '/api/lotes', { token: tokens.DONANTE, form: venta });
  assert.equal(bloqueado.estado, 422);

  const sinFoto = formLote({ nombre: 'Pan', descripcion: 'Pan' });
  sinFoto.delete('fotos');
  assert.equal((await api('POST', '/api/lotes', { token: tokens.DONANTE, form: sinFoto })).estado, 400);

  const escucha = await esperarNotificacion(tokens.RECEPTOR, (n) => n.tipo === 'NUEVO_LOTE');
  await escucha.conectado;
  const inicio = Date.now();
  const publicado = await api('POST', '/api/lotes', {
    token: tokens.DONANTE,
    form: formLote({ nombre: `Verduras ${sufijo}`, descripcion: 'Jitomate y calabaza con golpes leves' }),
  });
  assert.equal(publicado.estado, 201, JSON.stringify(publicado.datos));
  ids.LOTE = publicado.datos.lote.idLote;
  assert.ok(publicado.datos.receptoresNotificados >= 1);

  const aviso = await escucha.resultado;
  assert.equal(aviso.idLote, ids.LOTE);
  assert.ok(Date.now() - inicio < 5000, 'La notificación debe llegar en menos de 5 s');
});

test('Receptor ve lotes cercanos y acepta el lote', async () => {
  const cercanos = await api('GET', '/api/lotes/cercanos?radio=5&orden=cercano', { token: tokens.RECEPTOR });
  assert.ok(cercanos.datos.lotes.some((l) => l.idLote === ids.LOTE));

  const detalle = await api('GET', `/api/lotes/${ids.LOTE}`, { token: tokens.RECEPTOR });
  assert.equal(detalle.datos.puedeAceptar, true);

  const aceptado = await api('POST', `/api/lotes/${ids.LOTE}/aceptar`, { token: tokens.RECEPTOR });
  assert.equal(aceptado.estado, 201, JSON.stringify(aceptado.datos));
  ids.RUTA = aceptado.datos.idRuta;
  assert.match(aceptado.datos.codigoConfirmacion, /^\d{6}$/);

  const repetido = await api('POST', `/api/lotes/${ids.LOTE}/aceptar`, { token: tokens.RECEPTOR });
  assert.equal(repetido.estado, 409);
});

test('CU 7 y 8: KPIs y aceptar ruta de recolección', async () => {
  const kpis = await api('GET', '/api/kpis?dias=30', { token: tokens.VOLUNTARIO });
  assert.equal(kpis.estado, 200);
  assert.equal(kpis.datos.indicadores.kgPorDia.length, 7);

  const disponibles = await api('GET', '/api/rutas/disponibles?orden=distancia', { token: tokens.VOLUNTARIO });
  const ruta = disponibles.datos.rutas.find((r) => r.idRuta === ids.RUTA);
  assert.ok(ruta);
  assert.equal(ruta.recoleccion.telefono, null, 'Sin aceptar no se exponen teléfonos');

  const aceptada = await api('POST', `/api/rutas/${ids.RUTA}/aceptar`, { token: tokens.VOLUNTARIO });
  assert.equal(aceptada.estado, 200, JSON.stringify(aceptada.datos));
  assert.equal(aceptada.datos.ruta.estado, 'EN_RECOLECCION');
  assert.ok(aceptada.datos.ruta.recoleccion.telefono, 'Al aceptar se muestran los contactos');

  const otra = await api('POST', `/api/rutas/${ids.RUTA}/aceptar`, { token: tokens.VOLUNTARIO });
  assert.equal(otra.estado, 409);

  const lote = await api('GET', `/api/lotes/${ids.LOTE}`, { token: tokens.DONANTE });
  assert.equal(lote.datos.estado, 'EN_RECOLECCION');
});

test('CU 10 y 9: checklist de inocuidad, evidencia y cierre', async () => {
  const prematura = new FormData();
  prematura.append('fotos', imagen(), 'f.png');
  prematura.append('codigo', '000000');
  assert.equal((await api('POST', `/api/rutas/${ids.RUTA}/evidencia`, { token: tokens.VOLUNTARIO, form: prematura })).estado, 409);

  const respuestas = Object.fromEntries(CRITERIOS_INOCUIDAD.map((c) => [c, true]));
  const fallido = await api('POST', `/api/rutas/${ids.RUTA}/checklist`, {
    token: tokens.VOLUNTARIO, json: { respuestas: { ...respuestas, [CRITERIOS_INOCUIDAD[1]]: false }, temperaturaC: 4 },
  });
  assert.equal(fallido.datos.aprobado, false);
  assert.deepEqual(fallido.datos.incumplidos, [CRITERIOS_INOCUIDAD[1]]);

  const aprobado = await api('POST', `/api/rutas/${ids.RUTA}/checklist`, {
    token: tokens.VOLUNTARIO, json: { respuestas, temperaturaC: 4 },
  });
  assert.equal(aprobado.datos.aprobado, true);

  const codigoMal = new FormData();
  codigoMal.append('fotos', imagen(), 'f.png');
  codigoMal.append('codigo', '000001');
  const malo = await api('POST', `/api/rutas/${ids.RUTA}/evidencia`, { token: tokens.VOLUNTARIO, form: codigoMal });
  const esperado = RutaRecoleccion.codigoEsperado(ids.RUTA, `${contenedor.config.jwtSecreto}:codigos`);
  if (esperado !== '000001') assert.equal(malo.estado, 400);

  const recepciones = await api('GET', '/api/rutas/recepciones', { token: tokens.RECEPTOR });
  const codigo = recepciones.datos.rutas.find((r) => r.idRuta === ids.RUTA).codigoConfirmacion;
  assert.equal(codigo, esperado);

  const evidencia = new FormData();
  evidencia.append('fotos', imagen(), 'f.png');
  evidencia.append('firma', imagen(), 'firma.png');
  evidencia.append('codigo', codigo);
  const entrega = await api('POST', `/api/rutas/${ids.RUTA}/evidencia`, { token: tokens.VOLUNTARIO, form: evidencia });
  assert.equal(entrega.estado, 201, JSON.stringify(entrega.datos));
  assert.equal(entrega.datos.evidencia.fotosUrl.length, 1);

  const lote = await api('GET', `/api/lotes/${ids.LOTE}`, { token: tokens.DONANTE });
  assert.equal(lote.datos.estado, 'ENTREGADO');
  assert.ok(lote.datos.evidencia.fotos.length === 1);

  const kpis = await api('GET', '/api/kpis?dias=7', { token: tokens.VOLUNTARIO });
  assert.ok(kpis.datos.indicadores.kgRescatados >= 15);
  assert.ok(kpis.datos.indicadores.racionesEstimadas >= 37);
});

test('CU 6: perfil, historial y calificaciones', async () => {
  for (const rol of ['DONANTE', 'RECEPTOR', 'VOLUNTARIO']) {
    const h = await api('GET', '/api/perfil/historial?dias=30', { token: tokens[rol] });
    const estados = h.datos.historial.filter((x) => x.idLote === ids.LOTE).map((x) => x.tipoActividad);
    assert.deepEqual(estados.sort(), ['ENTREGADO', 'EN_RECOLECCION'], rol);
  }

  const pendientes = await api('GET', `/api/rutas/${ids.RUTA}/calificaciones`, { token: tokens.RECEPTOR });
  assert.equal(pendientes.datos.pendientes.length, 2);
  await api('POST', `/api/rutas/${ids.RUTA}/calificaciones`, {
    token: tokens.RECEPTOR, json: { idEvaluado: ids.VOLUNTARIO, puntuacion: 5, comentario: 'Puntual' },
  });
  const perfil = await api('GET', '/api/perfil', { token: tokens.VOLUNTARIO });
  assert.equal(perfil.datos.usuario.indiceConfiabilidad, 5);

  const cambio = await api('PUT', '/api/perfil', { token: tokens.VOLUNTARIO, json: { telefono: '5599998888', avisarCaducidades: false } });
  assert.equal(cambio.datos.usuario.telefono, '5599998888');
  assert.equal(cambio.datos.usuario.avisarCaducidades, false);
  await api('PUT', '/api/perfil', { token: tokens.VOLUNTARIO, json: { avisarCaducidades: true } });
});

test('CU 11: alertas de caducidad próxima', async () => {
  const urgente = await api('POST', '/api/lotes', {
    token: tokens.DONANTE,
    form: formLote({ nombre: `Lácteos ${sufijo}`, descripcion: 'Yogur', horasParaCaducar: 1, peso: 5 }),
  });
  assert.equal(urgente.estado, 201);
  const idLote = urgente.datos.lote.idLote;
  assert.equal(urgente.datos.lote.urgente, true);

  const tarea = await api('POST', '/api/admin/tareas/caducidades', { token: tokens.ADMIN });
  assert.ok(tarea.datos.resultado.alertasEnviadas >= 2);

  const alertas = await api('GET', '/api/notificaciones?tipo=CADUCIDAD_PROXIMA', { token: tokens.RECEPTOR });
  assert.ok(alertas.datos.notificaciones.some((n) => n.idLote === idLote));

  const otra = await api('POST', '/api/admin/tareas/caducidades', { token: tokens.ADMIN });
  const repetidas = (await api('GET', '/api/notificaciones?tipo=CADUCIDAD_PROXIMA', { token: tokens.RECEPTOR }))
    .datos.notificaciones.filter((n) => n.idLote === idLote);
  assert.equal(repetidas.length, 1);
  assert.ok(otra.datos.resultado.alertasEnviadas >= 0);

  const leidas = await api('POST', '/api/notificaciones/leidas', { token: tokens.RECEPTOR });
  assert.equal(leidas.datos.noLeidas, 0);

  const cancelado = await api('POST', `/api/lotes/${idLote}/cancelar`, { token: tokens.DONANTE });
  assert.equal(cancelado.datos.estado, 'CANCELADO');
});

test('CU 10: reporte de incumplimiento cancela el lote', async () => {
  const publicado = await api('POST', '/api/lotes', {
    token: tokens.DONANTE,
    form: formLote({ nombre: `Carne ${sufijo}`, descripcion: 'Pollo refrigerado', peso: 8 }),
  });
  const idLote = publicado.datos.lote.idLote;
  const ruta = await api('POST', `/api/lotes/${idLote}/aceptar`, { token: tokens.RECEPTOR });
  await api('POST', `/api/rutas/${ruta.datos.idRuta}/aceptar`, { token: tokens.VOLUNTARIO });

  const sinMotivo = await api('POST', `/api/rutas/${ruta.datos.idRuta}/incumplimiento`, { token: tokens.VOLUNTARIO, json: {} });
  assert.equal(sinMotivo.estado, 400);

  const reporte = await api('POST', `/api/rutas/${ruta.datos.idRuta}/incumplimiento`, {
    token: tokens.VOLUNTARIO,
    json: { respuestas: { [CRITERIOS_INOCUIDAD[0]]: false }, temperaturaC: 15, observaciones: 'Cadena de frío rota (15 °C)' },
  });
  assert.equal(reporte.estado, 200, JSON.stringify(reporte.datos));

  const lote = await api('GET', `/api/lotes/${idLote}`, { token: tokens.DONANTE });
  assert.equal(lote.datos.estado, 'CANCELADO');
  const activa = await api('GET', '/api/rutas/activa', { token: tokens.VOLUNTARIO });
  assert.equal(activa.datos.ruta, null);
});

test('Seguridad: roles y rutas comerciales bloqueadas', async () => {
  assert.equal((await api('GET', '/api/admin/usuarios', { token: tokens.DONANTE })).estado, 403);
  assert.equal((await api('GET', '/api/kpis', { token: tokens.DONANTE })).estado, 403);
  assert.equal((await api('GET', '/api/perfil')).estado, 401);
  assert.equal((await api('POST', '/api/pagos', { token: tokens.DONANTE, json: {} })).estado, 403);
  const perfilAjeno = await api('PUT', '/api/perfil', { token: tokens.DONANTE, json: { precio: 10 } });
  assert.equal(perfilAjeno.estado, 422);
});
