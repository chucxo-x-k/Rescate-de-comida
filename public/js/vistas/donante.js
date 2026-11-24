import { api } from '../api.js';
import { mapaSelector, obtenerUbicacion } from '../mapa.js';
import {
  $, $$, avisar, avisarError, chip, chipLote, chipVerificacion, conBoton, html, kg, limpiarErrores, montar,
  mostrarErrores, selectorFotos, textoCaducidad, vacio,
} from '../ui.js';

/** Enlace de cada tarjeta según el estado (wireframe Panel Donante). */
function accionLote(lote) {
  if (lote.estado === 'EN_RECOLECCION') return 'Ver ruta';
  if (lote.estado === 'ENTREGADO') return 'Ver evidencia';
  return 'Ver detalle';
}

function etiquetaEstado(lote) {
  if (lote.estado === 'PUBLICADO' && lote.ruta) return chip('Aceptado', 'aviso');
  if (lote.estado === 'PUBLICADO' && lote.urgente) return chip('Por caducar', 'peligro');
  return chipLote(lote.estado);
}

export function tarjetaLoteDonante(lote) {
  return html`
    <article class="tarjeta">
      <div class="fila-entre">
        <h3>${lote.nombre}</h3>
        ${etiquetaEstado(lote)}
      </div>
      <p class="meta">${kg(lote.pesoKg)} · ${textoCaducidad(lote.fechaCaducidad, lote.horaCaducidad)}</p>
      ${lote.ruta?.receptorNombre ? html`<p class="meta">Para: ${lote.ruta.receptorNombre}${lote.ruta.voluntarioNombre ? ` · Voluntario: ${lote.ruta.voluntarioNombre}` : ''}</p>` : ''}
      <p style="margin:10px 0 0"><a href="#/lote/${lote.idLote}"><strong>${accionLote(lote)}</strong></a></p>
    </article>`;
}

function avisoVerificacion(usuario) {
  if (usuario.estadoVerificacion === 'VERIFICADO') return '';
  const textos = {
    NO_VERIFICADO: 'Verifica tu cuenta para poder publicar lotes.',
    EN_REVISION: 'Tus documentos están en revisión. Te avisaremos cuando se apruebe tu cuenta.',
    RECHAZADO: 'Tu verificación fue rechazada. Revisa las observaciones y vuelve a enviar.',
  };
  return html`
    <div class="aviso-caja" style="margin:12px 0">
      ${textos[usuario.estadoVerificacion] ?? textos.NO_VERIFICADO}
      <div style="margin-top:8px"><a href="#/verificacion"><strong>Ir a verificación</strong></a></div>
    </div>`;
}

// Wireframe "Panel Donante".
export async function vistaPanelDonante({ contenedor, encabezado, refrescarUsuario }) {
  encabezado();
  const [usuario, datos] = await Promise.all([refrescarUsuario(), api.get('/lotes/mios')]);
  const verificado = usuario.estadoVerificacion === 'VERIFICADO';
  const { contadores, lotes } = datos;

  montar(contenedor, html`
    <div class="titulo-pagina"><h2>Panel del donante</h2>${chipVerificacion(usuario.estadoVerificacion)}</div>
    ${avisoVerificacion(usuario)}
    <a class="btn btn-primario btn-bloque btn-grande" style="margin:14px 0" href="${verificado ? '#/donante/publicar' : '#/verificacion'}">+ Publicar lote</a>
    <div class="rejilla-3">
      <div class="contador"><strong>${contadores.activos}</strong><span>Activos</span></div>
      <div class="contador"><strong>${contadores.entregados}</strong><span>Entregados</span></div>
      <div class="contador"><strong>${contadores.porCaducar}</strong><span>Por caducar</span></div>
    </div>
    <div class="fila-entre"><h3 class="seccion-titulo">Mis lotes</h3>${lotes.length > 5 ? html`<a href="#/donante/lotes">Ver todos</a>` : ''}</div>
    ${lotes.length ? lotes.slice(0, 5).map(tarjetaLoteDonante) : vacio('Aún no publicas lotes. Cuando tengas excedentes, publícalos aquí.')}`);
}

// Wireframe "Mis lotes" (lista completa con filtro).
export async function vistaMisLotes({ contenedor, encabezado }) {
  encabezado({ titulo: 'Mis lotes' });
  const { lotes } = await api.get('/lotes/mios');
  const filtros = [
    ['todos', 'Todos', () => true],
    ['activos', 'Activos', (l) => ['PUBLICADO', 'EN_RECOLECCION'].includes(l.estado)],
    ['entregados', 'Entregados', (l) => l.estado === 'ENTREGADO'],
    ['otros', 'Cancelados / caducados', (l) => ['CANCELADO', 'CADUCADO'].includes(l.estado)],
  ];
  let filtro = 'todos';

  const pintar = () => {
    const funcion = filtros.find(([clave]) => clave === filtro)[2];
    const lista = lotes.filter(funcion);
    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Mis lotes</h2></div>
      <div class="chips" style="margin:12px 0 16px">
        ${filtros.map(([clave, texto]) => html`<button class="chip ${clave === filtro ? 'chip-solido' : ''}" data-filtro="${clave}">${texto}</button>`)}
      </div>
      ${lista.length ? lista.map(tarjetaLoteDonante) : vacio('No hay lotes en esta categoría.')}`);
    $$('[data-filtro]', contenedor).forEach((b) =>
      b.addEventListener('click', () => {
        filtro = b.dataset.filtro;
        pintar();
      }),
    );
  };
  pintar();
}

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// CU 4 · Wireframe "Publicar Lote".
export async function vistaPublicarLote({ contenedor, encabezado, refrescarUsuario, ir, alLimpiar }) {
  encabezado({ titulo: 'Publicar lote' });
  const [usuario, { categorias }] = await Promise.all([refrescarUsuario(), api.get('/categorias')]);

  if (usuario.estadoVerificacion !== 'VERIFICADO') {
    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Publicar lote</h2></div>
      ${avisoVerificacion(usuario)}`);
    return;
  }

  montar(contenedor, html`
    <p class="subtitulo">Describe el excedente para que lo puedan rescatar.</p>
    <form id="form-lote" novalidate>
      <div class="campo" data-campo="nombre">
        <label for="nombre">Nombre corto</label>
        <input class="control" id="nombre" name="nombre" maxlength="100" placeholder="Ej. Pan dulce" required>
      </div>
      <div class="campo" data-campo="descripcion">
        <label for="descripcion">Descripción del alimento</label>
        <textarea class="control" id="descripcion" name="descripcion" placeholder="Qué es, estado y empaque" required></textarea>
      </div>
      <div class="campo" data-campo="id_categoria">
        <label for="categoria">Categoría</label>
        <select class="control" id="categoria" name="idCategoria">
          ${categorias.map((c) => html`<option value="${c.idCategoria}">${c.nombre}</option>`)}
        </select>
      </div>
      <div class="campo" data-campo="peso_kg">
        <label for="peso">Peso estimado (kg)</label>
        <input class="control" id="peso" name="pesoKg" type="number" min="0.1" step="0.1" inputmode="decimal" placeholder="0.0" required>
      </div>
      <div class="rejilla-2">
        <div class="campo" data-campo="fecha_caducidad">
          <label for="fecha">Fecha de caducidad</label>
          <input class="control" id="fecha" name="fechaCaducidad" type="date" min="${hoyIso()}" required>
        </div>
        <div class="campo">
          <label for="hora">Hora (opcional)</label>
          <input class="control" id="hora" name="horaCaducidad" type="time">
        </div>
      </div>
      <div class="campo" data-campo="direccion_recogida">
        <label for="direccion">Ubicación de recogida</label>
        <input class="control" id="direccion" name="direccionRecogida" maxlength="255" value="${usuario.direccion ?? ''}" placeholder="Dirección de recogida" required>
      </div>
      <div class="campo" data-campo="ubicacion">
        <div class="mapa" id="mapa-lote"></div>
        <div class="fila-entre" style="margin-top:6px">
          <span class="ayuda" id="coordenadas">Toca el mapa para ajustar el punto de recogida.</span>
          <button class="enlace texto-chico" type="button" id="usar-ubicacion">Usar mi ubicación</button>
        </div>
      </div>
      <div class="campo" data-campo="fotos">
        <span class="etiqueta">Fotografías</span>
        <div id="fotos"></div>
      </div>
      <div class="campo" data-campo="declaracion_buena_fe">
        <div class="caja-legal">
          <label class="casilla"><input type="checkbox" name="declaracionBuenaFe" value="true">
            <span>Declaro de buena fe que los alimentos son aptos para el consumo y acepto el deslinde de responsabilidad.</span></label>
          <p class="ayuda">Los alimentos donados no pueden venderse ni cobrarse.</p>
        </div>
      </div>
      <div class="acciones">
        <a class="btn" href="#/donante">Cancelar</a>
        <button class="btn btn-primario" type="submit">Publicar</button>
      </div>
    </form>`);

  const formulario = $('#form-lote');
  const punto = { latitud: usuario.latitud, longitud: usuario.longitud };
  const mostrar = () => {
    if (punto.latitud !== null) {
      $('#coordenadas').textContent = `Punto: ${Number(punto.latitud).toFixed(5)}, ${Number(punto.longitud).toFixed(5)}`;
    }
  };
  mostrar();
  const mapa = mapaSelector($('#mapa-lote'), {
    latitud: punto.latitud,
    longitud: punto.longitud,
    alCambiar: (lat, lng) => {
      punto.latitud = lat;
      punto.longitud = lng;
      mostrar();
    },
  });
  alLimpiar(() => mapa.destruir());
  const fotos = selectorFotos($('#fotos'));

  $('#usar-ubicacion').addEventListener('click', async () => {
    try {
      const gps = await obtenerUbicacion();
      Object.assign(punto, gps);
      mapa.fijar(gps.latitud, gps.longitud);
      mostrar();
    } catch (error) {
      avisarError(error);
    }
  });

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formulario);
    const datos = new FormData(formulario);
    if (punto.latitud !== null && punto.latitud !== undefined) {
      datos.set('latitud', punto.latitud);
      datos.set('longitud', punto.longitud);
    }
    for (const archivo of fotos.archivos()) datos.append('fotos', archivo, archivo.name);
    try {
      const respuesta = await conBoton($('button[type=submit]', formulario), () => api.enviarFormulario('/lotes', datos));
      const n = respuesta.receptoresNotificados;
      avisar(
        n > 0 ? `Lote publicado. Se avisó a ${n} receptor${n === 1 ? '' : 'es'} cercano${n === 1 ? '' : 's'}.` : 'Lote publicado.',
        'ok',
      );
      ir(`/lote/${respuesta.lote.idLote}`);
    } catch (error) {
      mostrarErrores(formulario, error);
    }
  });
}
