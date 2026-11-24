import { api } from '../api.js';
import { escuchar } from '../tiempoReal.js';
import {
  $, abrirModal, avisar, avisarError, chip, chipRuta, chipVerificacion, conBoton, horaCorta, html, kg, km, montar,
  mostrarErrores, textoRestante, vacio,
} from '../ui.js';

const RADIOS = [2, 5, 10, 20, 50];

function tarjetaLoteCercano(lote) {
  return html`
    <article class="tarjeta">
      <div class="tarjeta-lote">
        ${lote.foto
          ? html`<img class="miniatura" src="${lote.foto}" alt="" loading="lazy">`
          : html`<div class="miniatura vacia">Foto</div>`}
        <div>
          <div class="fila-entre" style="align-items:flex-start">
            <h3>${lote.nombre} · ${kg(lote.pesoKg)}</h3>
            ${lote.urgente ? chip('Urgente', 'peligro') : lote.nuevo ? chip('Nuevo', 'ok') : ''}
          </div>
          <p class="meta" style="margin:2px 0 0">${lote.donante.nombre} · ${km(lote.distanciaKm)}</p>
          <p class="meta" style="margin:0">${textoRestante(lote.horasRestantes)}</p>
        </div>
      </div>
      <a class="btn btn-bloque" style="margin-top:12px" href="#/lote/${lote.idLote}">Ver lote</a>
    </article>`;
}

function abrirDisponibilidad(usuario, alGuardar) {
  const { elemento, cerrar } = abrirModal(String(html`
    <h3>Capacidad y horario</h3>
    <form id="form-disponibilidad" novalidate>
      <div class="campo" data-campo="capacidadKg">
        <label for="capacidad">Capacidad disponible (kg)</label>
        <input class="control" id="capacidad" name="capacidadKg" type="number" min="0" step="0.5" value="${usuario.capacidadKg ?? 0}">
        <div class="ayuda">Solo recibirás sugerencias de lotes que quepan en esta capacidad.</div>
      </div>
      <div class="rejilla-2">
        <div class="campo" data-campo="horarioInicio">
          <label for="inicio">Recibo desde</label>
          <input class="control" id="inicio" name="horarioInicio" type="time" value="${horaCorta(usuario.horarioInicio)}">
        </div>
        <div class="campo" data-campo="horarioFin">
          <label for="fin">Hasta</label>
          <input class="control" id="fin" name="horarioFin" type="time" value="${horaCorta(usuario.horarioFin)}">
        </div>
      </div>
      <div class="campo" data-campo="radioCoberturaKm">
        <label for="radio">Radio de cobertura (km)</label>
        <input class="control" id="radio" name="radioCoberturaKm" type="number" min="0.5" max="100" step="0.5" value="${usuario.radioCoberturaKm ?? 5}">
      </div>
      <div class="acciones">
        <button class="btn" type="button" data-cerrar>Cancelar</button>
        <button class="btn btn-primario" type="submit">Guardar</button>
      </div>
    </form>`));
  elemento.querySelector('[data-cerrar]').addEventListener('click', cerrar);
  const formulario = elemento.querySelector('form');
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { usuario: actualizado } = await conBoton(
        formulario.querySelector('[type=submit]'),
        () => api.put('/perfil/disponibilidad', Object.fromEntries(new FormData(formulario))),
      );
      cerrar();
      avisar('Disponibilidad actualizada.', 'ok');
      alGuardar(actualizado);
    } catch (error) {
      mostrarErrores(formulario, error);
    }
  });
}

// Wireframe "Panel Receptor" (Lotes cercanos).
export async function vistaLotesCercanos({ contenedor, encabezado, refrescarUsuario, alLimpiar, sigueActiva }) {
  encabezado();
  let usuario = await refrescarUsuario();
  const filtros = { radio: Math.min(50, Math.max(2, Number(usuario.radioCoberturaKm) || 5)), orden: 'cercano' };
  if (!RADIOS.includes(filtros.radio)) filtros.radio = 5;

  const pintar = async () => {
    let lista = null;
    let errorLista = null;
    if (usuario.latitud !== null) {
      try {
        ({ lotes: lista } = await api.get('/lotes/cercanos', filtros));
      } catch (error) {
        errorLista = error.message;
      }
    }
    if (!sigueActiva()) return;
    const verificado = usuario.estadoVerificacion === 'VERIFICADO';
    const resumen = `${kg(usuario.capacidadKg)} · ${usuario.horarioInicio ? `${horaCorta(usuario.horarioInicio)}–${horaCorta(usuario.horarioFin)}` : 'sin horario'} · radio ${usuario.radioCoberturaKm} km`;

    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Lotes cercanos</h2>${chipVerificacion(usuario.estadoVerificacion)}</div>
      ${!verificado ? html`<div class="aviso-caja" style="margin:10px 0">Necesitas una cuenta verificada para aceptar lotes.
        <div style="margin-top:6px"><a href="#/verificacion"><strong>Verificar organización</strong></a></div></div>` : ''}
      <div class="rejilla-2" style="margin:12px 0">
        <div><label class="etiqueta" for="radio">Radio</label>
          <select class="control" id="radio">${RADIOS.map((r) => html`<option value="${r}" ${r === filtros.radio ? 'selected' : ''}>Hasta ${r} km</option>`)}</select></div>
        <div><label class="etiqueta" for="orden">Ordenar</label>
          <select class="control" id="orden">
            <option value="cercano" ${filtros.orden === 'cercano' ? 'selected' : ''}>Más cercano</option>
            <option value="caducidad" ${filtros.orden === 'caducidad' ? 'selected' : ''}>Caduca antes</option>
          </select></div>
      </div>
      <div class="tarjeta" style="margin-bottom:14px">
        <label class="casilla"><input type="checkbox" id="recibiendo" ${usuario.recibiendoLotes ? 'checked' : ''} ${verificado ? '' : 'disabled'}>
          <span>Estoy recibiendo lotes</span></label>
        <p class="ayuda" style="margin:6px 0 8px 30px">${resumen}</p>
        <button class="enlace" id="editar-disponibilidad">Editar capacidad y horario</button>
      </div>
      ${usuario.latitud === null
        ? html`<div class="aviso-caja">Registra tu ubicación en <a href="#/perfil"><strong>Perfil</strong></a> para ver lotes cercanos.</div>`
        : errorLista ? html`<div class="mensaje-error">${errorLista}</div>`
        : lista.length ? lista.map(tarjetaLoteCercano)
        : vacio('No hay lotes disponibles en este radio. Te avisaremos cuando se publique uno cerca.')}`);

    $('#radio').addEventListener('change', (e) => { filtros.radio = Number(e.target.value); pintar(); });
    $('#orden').addEventListener('change', (e) => { filtros.orden = e.target.value; pintar(); });
    $('#editar-disponibilidad').addEventListener('click', () =>
      abrirDisponibilidad(usuario, (actualizado) => { usuario = actualizado; pintar(); }));
    $('#recibiendo').addEventListener('change', async (e) => {
      try {
        ({ usuario } = await api.put('/perfil/disponibilidad', { recibiendoLotes: e.target.checked }));
        avisar(usuario.recibiendoLotes ? 'Recibirás avisos de lotes cercanos.' : 'Pausaste la recepción de lotes.', 'ok');
        pintar();
      } catch (error) {
        e.target.checked = !e.target.checked;
        avisarError(error);
      }
    });
  };

  await pintar();
  alLimpiar(escuchar((tipo, datos) => {
    if (tipo === 'notificacion' && datos.notificacion.tipo === 'NUEVO_LOTE') pintar();
  }));
}

function tarjetaRecepcion(ruta) {
  const activa = ['DISPONIBLE', 'EN_RECOLECCION', 'EN_CAMINO'].includes(ruta.estado);
  return html`
    <article class="tarjeta ${ruta.estado === 'EN_CAMINO' ? 'destacada' : ''}">
      <div class="fila-entre"><h3>${ruta.lote.nombre} · ${kg(ruta.lote.pesoKg)}</h3>${chipRuta(ruta.estado)}</div>
      <p class="meta">De: ${ruta.recoleccion.nombre}${ruta.distanciaKm !== null ? ` · ${km(ruta.distanciaKm)}` : ''}</p>
      ${ruta.voluntario ? html`<p class="meta">Voluntario: ${ruta.voluntario.nombre}
        ${ruta.voluntario.telefono ? html` · <a href="tel:${ruta.voluntario.telefono}">${ruta.voluntario.telefono}</a>` : ''}</p>` : ''}
      ${activa && ruta.codigoConfirmacion ? html`
        <div class="caja-legal" style="margin-top:10px">
          <span class="etiqueta">Código de confirmación</span>
          <div class="codigo-grande">${ruta.codigoConfirmacion}</div>
          <p class="ayuda" style="margin:0">Dáselo al voluntario solo cuando recibas los alimentos.</p>
        </div>` : ''}
      <p style="margin:10px 0 0"><a href="#/lote/${ruta.lote.idLote}"><strong>${ruta.estado === 'ENTREGADA' ? 'Ver evidencia y calificar' : 'Ver lote'}</strong></a></p>
    </article>`;
}

// Mapa de navegación: "Mis recepciones".
export async function vistaRecepciones({ contenedor, encabezado, alLimpiar, sigueActiva }) {
  encabezado();
  const pintar = async () => {
    const { rutas } = await api.get('/rutas/recepciones');
    if (!sigueActiva()) return;
    const activas = rutas.filter((r) => ['DISPONIBLE', 'EN_RECOLECCION', 'EN_CAMINO'].includes(r.estado));
    const cerradas = rutas.filter((r) => !activas.includes(r));
    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Mis recepciones</h2></div>
      <p class="subtitulo">Lotes que aceptaste y su estado de entrega.</p>
      <h3 class="seccion-titulo">En curso</h3>
      ${activas.length ? activas.map(tarjetaRecepcion) : vacio('No tienes recepciones en curso.')}
      ${cerradas.length ? html`<h3 class="seccion-titulo">Anteriores</h3>${cerradas.map(tarjetaRecepcion)}` : ''}`);
  };
  await pintar();
  alLimpiar(escuchar((tipo) => { if (tipo === 'notificacion') pintar().catch(() => {}); }));
}
