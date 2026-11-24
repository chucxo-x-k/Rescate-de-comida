import { api } from '../clienteApi.js';
import { escuchar } from '../notificacionesTiempoReal.js';
import {
  $, $$, avisar, avisarError, chip, chipLote, chipVerificacion, confirmar, conBoton, ETIQUETA_ROL, hace, html, kg,
  montar, textoCaducidad, vacio,
} from '../utilidadesInterfaz.js';
import { verDocumento } from './verificacion.js';

export async function vistaVerificacionesPendientes({ contenedor, encabezado, alLimpiar, sigueActiva }) {
  encabezado();
  let abierta = null;

  const pintar = async () => {
    const { solicitudes } = await api.get('/admin/verificaciones');
    if (!sigueActiva()) return;
    if (!solicitudes.some((s) => s.idSolicitud === abierta)) abierta = solicitudes[0]?.idSolicitud ?? null;
    const s = solicitudes.find((x) => x.idSolicitud === abierta);

    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Verificaciones pendientes</h2></div>
      <p class="subtitulo">${solicitudes.length} solicitud${solicitudes.length === 1 ? '' : 'es'} en revisión.</p>
      ${s ? html`
        <div class="maestro-detalle">
          <div class="lista-seleccion">
            ${solicitudes.map((x) => html`
              <article class="tarjeta seleccionable ${x.idSolicitud === abierta ? 'seleccionada' : ''}" data-abrir="${x.idSolicitud}">
                <div class="fila-entre"><h3>${x.usuario.nombre}</h3>${chip(ETIQUETA_ROL[x.usuario.rol])}</div>
                <p class="meta">Enviada ${hace(x.fechaEnvio).toLowerCase()}</p>
              </article>`)}
          </div>
          <article class="tarjeta destacada columna-fija">
            <div class="fila-entre"><h3>${s.usuario.nombre}</h3>${chip(ETIQUETA_ROL[s.usuario.rol])}</div>
            <p class="meta">${s.usuario.correo} · ${s.usuario.telefono}</p>
            <p class="meta">${s.usuario.direccion} · Enviada ${hace(s.fechaEnvio).toLowerCase()}</p>
            <div style="margin-top:14px">
              ${s.documentos.map((d) => html`
                <div class="fila-entre" style="padding:10px 0;border-top:1px solid var(--borde)">
                  <span>${d.nombre}</span>
                  ${d.estado === 'CARGADO'
                    ? html`<button class="btn btn-chico" data-ver="${d.idDocumento}" data-nombre="${d.nombre}">Ver documento</button>`
                    : chip('Falta', 'peligro')}
                </div>`)}
            </div>
            <div class="campo" style="margin-top:12px">
              <label for="obs">Observaciones</label>
              <textarea class="control" id="obs" placeholder="Motivo si rechazas"></textarea>
            </div>
            <div class="acciones">
              <button class="btn btn-peligro" data-resolver="rechazar">Rechazar</button>
              <button class="btn btn-primario" data-resolver="aprobar">Aprobar</button>
            </div>
          </article>
        </div>`
      : vacio('No hay verificaciones pendientes.')}`);

    $$('[data-abrir]', contenedor).forEach((b) => b.addEventListener('click', () => { abierta = Number(b.dataset.abrir); pintar(); }));
    $$('[data-ver]', contenedor).forEach((b) => b.addEventListener('click', () => verDocumento(b.dataset.ver, b.dataset.nombre)));
    $$('[data-resolver]', contenedor).forEach((b) =>
      b.addEventListener('click', async () => {
        const aprobar = b.dataset.resolver === 'aprobar';
        const observaciones = $('#obs').value.trim();
        if (!aprobar && !observaciones) {
          avisar('Escribe el motivo del rechazo en observaciones.', 'error');
          $('#obs').focus();
          return;
        }
        try {
          await conBoton(b, () => api.post(`/admin/verificaciones/${abierta}/resolver`, { aprobar, observaciones }));
          avisar(aprobar ? 'Cuenta verificada.' : 'Solicitud rechazada.', 'ok');
          abierta = null;
          await pintar();
        } catch (error) {
          avisarError(error);
        }
      }));
  };

  await pintar();
  alLimpiar(escuchar((tipo) => { if (tipo === 'notificacion') pintar().catch(() => {}); }));
}

export async function vistaUsuarios({ contenedor, encabezado, usuario: yo, sigueActiva }) {
  encabezado();
  const filtros = { rol: '', q: '' };
  let temporizador = null;

  montar(contenedor, html`
    <div class="titulo-pagina"><h2>Usuarios</h2></div>
    <div class="barra-filtros">
      <div class="filtro-ancho"><label class="etiqueta" for="buscar">Buscar</label>
        <input class="control" id="buscar" type="search" placeholder="Nombre o correo"></div>
      <div><label class="etiqueta" for="rol">Rol</label>
        <select class="control" id="rol">
          <option value="">Todos los roles</option>
          ${Object.entries(ETIQUETA_ROL).map(([v, t]) => html`<option value="${v}">${t}</option>`)}
        </select></div>
    </div>
    <div id="lista"></div>`);

  const pintarLista = async () => {
    const { usuarios } = await api.get('/admin/usuarios', filtros);
    if (!sigueActiva()) return;
    montar($('#lista'), usuarios.length ? html`
      <div class="tabla-contenedor">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th>Verificación</th><th>Cuenta</th><th></th></tr></thead>
          <tbody>
            ${usuarios.map((u) => html`
              <tr>
                <td><strong>${u.nombre}</strong></td>
                <td>${u.correo}</td>
                <td>${u.telefono}</td>
                <td>${ETIQUETA_ROL[u.rol]}</td>
                <td>${u.requiereVerificacion ? chipVerificacion(u.estadoVerificacion) : html`<span class="texto-suave">—</span>`}</td>
                <td>${u.activo ? chip('Activa', 'ok') : chip('Desactivada', 'peligro')}</td>
                <td class="derecha">${u.idUsuario !== yo.idUsuario ? html`<button class="btn btn-chico ${u.activo ? 'btn-peligro' : ''}" data-activo="${u.activo ? 0 : 1}" data-id="${u.idUsuario}">${u.activo ? 'Desactivar' : 'Reactivar'}</button>` : ''}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>` : vacio('Sin resultados.'));

    $$('[data-id]', contenedor).forEach((b) =>
      b.addEventListener('click', async () => {
        const activar = b.dataset.activo === '1';
        if (!activar && !(await confirmar('Desactivar cuenta', 'La persona no podrá iniciar sesión.', { textoAceptar: 'Desactivar', peligro: true }))) return;
        try {
          await api.patch(`/admin/usuarios/${b.dataset.id}`, { activo: activar });
          await pintarLista();
        } catch (error) {
          avisarError(error);
        }
      }));
  };

  $('#buscar').addEventListener('input', (e) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { filtros.q = e.target.value.trim(); pintarLista(); }, 300);
  });
  $('#rol').addEventListener('change', (e) => { filtros.rol = e.target.value; pintarLista(); });
  await pintarLista();
}

const ESTADOS = [['', 'Todos'], ['PUBLICADO', 'Disponibles'], ['EN_RECOLECCION', 'En recolección'], ['ENTREGADO', 'Entregados'], ['CADUCADO', 'Caducados'], ['CANCELADO', 'Cancelados']];

export async function vistaLotesAdmin({ contenedor, encabezado, sigueActiva }) {
  encabezado();
  let estado = '';

  const pintar = async () => {
    const { lotes } = await api.get('/admin/lotes', { estado });
    if (!sigueActiva()) return;
    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Lotes</h2><button class="btn btn-chico" id="tarea">Verificar caducidades ahora</button></div>
      <div class="chips" style="margin:16px 0">
        ${ESTADOS.map(([v, t]) => html`<button class="chip ${v === estado ? 'chip-solido' : ''}" data-estado="${v}">${t}</button>`)}
      </div>
      ${lotes.length ? html`
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead><tr><th>Lote</th><th>Peso</th><th>Donante</th><th>Categoría</th><th>Caducidad</th><th>Receptor</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              ${lotes.map((l) => html`
                <tr>
                  <td><strong>${l.nombre}</strong></td>
                  <td>${kg(l.pesoKg)}</td>
                  <td>${l.donante.nombre}</td>
                  <td>${l.categoria}</td>
                  <td>${textoCaducidad(l.fechaCaducidad, l.horaCaducidad)}</td>
                  <td>${l.ruta?.receptorNombre ?? html`<span class="texto-suave">—</span>`}</td>
                  <td>${l.estado === 'PUBLICADO' && l.urgente ? chip('Urgente', 'peligro') : chipLote(l.estado)}</td>
                  <td class="derecha"><a class="btn btn-chico" href="#/lote/${l.idLote}">Ver detalle</a></td>
                </tr>`)}
            </tbody>
          </table>
        </div>` : vacio('No hay lotes con ese estado.')}`);

    $$('[data-estado]', contenedor).forEach((b) => b.addEventListener('click', () => { estado = b.dataset.estado; pintar(); }));
    $('#tarea').addEventListener('click', async (e) => {
      try {
        const { resultado } = await conBoton(e.currentTarget, () => api.post('/admin/tareas/caducidades'));
        avisar(`Listo: ${resultado?.alertasEnviadas ?? 0} alertas enviadas, ${resultado?.caducados ?? 0} lotes caducados.`, 'ok');
        await pintar();
      } catch (error) {
        avisarError(error);
      }
    });
  };
  await pintar();
}
