import { api } from '../api.js';
import { crearFirma } from '../firma.js';
import { mapaPuntos } from '../mapa.js';
import { escuchar } from '../tiempoReal.js';
import {
  $, $$, abrirModal, avisar, avisarError, chip, chipRuta, confirmar, conBoton, enlaceMaps, horaCorta, html, kg, km,
  limpiarErrores, montar, mostrarErrores, selectorFotos, textoRestante, vacio,
} from '../ui.js';
import { montarCalificaciones } from './comunes.js';

// CU 7 · Wireframe "Panel de Control KPIs".
export async function vistaPanelKpis({ contenedor, encabezado, sigueActiva }) {
  encabezado();
  const { categorias } = await api.get('/categorias');
  const filtros = { dias: 30, categoria: '' };

  const pintar = async () => {
    const { indicadores: k } = await api.get('/kpis', filtros);
    if (!sigueActiva()) return;
    const maximo = Math.max(1, ...k.kgPorDia.map((d) => d.kg));
    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Panel de control</h2></div>
      <div class="rejilla-2" style="margin:12px 0 14px">
        <div><label class="etiqueta" for="periodo">Periodo</label>
          <select class="control" id="periodo">
            ${[[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días'], [365, 'Último año']].map(([v, t]) =>
              html`<option value="${v}" ${v === filtros.dias ? 'selected' : ''}>${t}</option>`)}
          </select></div>
        <div><label class="etiqueta" for="categoria">Tipo de alimento</label>
          <select class="control" id="categoria">
            <option value="">Todos</option>
            ${categorias.map((c) => html`<option value="${c.idCategoria}" ${String(c.idCategoria) === filtros.categoria ? 'selected' : ''}>${c.nombre}</option>`)}
          </select></div>
      </div>
      <div class="rejilla-2">
        <div class="contador"><strong>${k.kgRescatados}</strong><span>Kg rescatados</span></div>
        <div class="contador"><strong>${k.racionesEstimadas}</strong><span>Raciones estimadas</span></div>
        <div class="contador"><strong>${k.vencidosEvitados}</strong><span>Vencidos evitados</span></div>
        <div class="contador"><strong>${k.tiempoMedioTrasladoMin} min</strong><span>Traslado medio</span></div>
      </div>
      <div class="tarjeta" style="margin-top:14px">
        <h3>Kg rescatados por día</h3>
        <div class="grafica" role="img" aria-label="Kilogramos rescatados en los últimos 7 días">
          ${k.kgPorDia.map((d) => html`<div class="barra-dato" style="height:${Math.round((d.kg / maximo) * 100)}%" title="${d.dia}: ${d.kg} kg"><span>${d.kg ? Math.round(d.kg) : ''}</span></div>`)}
        </div>
        <div class="grafica-etiquetas">${k.kgPorDia.map((d) => html`<span>${d.etiqueta}</span>`)}</div>
      </div>
      <div class="tarjeta">
        <h3>Rutas activas</h3>
        ${k.rutasActivas.length
          ? html`<ul class="lista-limpia">${k.rutasActivas.map((r) => html`
              <li class="fila-entre" style="padding:10px 0;border-top:1px solid var(--borde)">
                <div><strong>${r.lote.nombre} · ${kg(r.lote.pesoKg)}</strong>
                  <div class="texto-suave texto-chico">${r.recoleccion.nombre} → ${r.entrega.nombre}</div></div>
                ${chipRuta(r.estado)}
              </li>`)}</ul>`
          : html`<p class="texto-suave">No hay rutas en curso.</p>`}
      </div>`);
    $('#periodo').addEventListener('change', (e) => { filtros.dias = Number(e.target.value); pintar(); });
    $('#categoria').addEventListener('change', (e) => { filtros.categoria = e.target.value; pintar(); });
  };
  await pintar();
}

function paradas(ruta) {
  return html`
    <div class="parada"><span class="num">1</span><div><strong>Recolección</strong>
      <div class="texto-suave texto-chico">${ruta.recoleccion.nombre} · ${ruta.recoleccion.direccion}
        ${ruta.ventanaInicio ? ` · ${horaCorta(ruta.ventanaInicio)}${ruta.ventanaFin ? `–${horaCorta(ruta.ventanaFin)}` : ''}` : ''}</div></div></div>
    <div class="parada"><span class="num">2</span><div><strong>Entrega</strong>
      <div class="texto-suave texto-chico">${ruta.entrega.nombre} · ${ruta.entrega.direccion}</div></div></div>`;
}

const ZONAS = [['', 'Todas'], ['5', 'Hasta 5 km'], ['10', 'Hasta 10 km'], ['20', 'Hasta 20 km'], ['50', 'Hasta 50 km']];

// CU 8 · Wireframe "Rutas Disponibles".
export async function vistaRutasDisponibles({ contenedor, encabezado, ir, alLimpiar, sigueActiva }) {
  encabezado();
  const filtros = { radio: '', orden: 'caducidad' };
  let seleccionada = null;
  let mapa = null;
  alLimpiar(() => mapa?.destruir());

  const pintar = async () => {
    const [{ rutas }, { ruta: activa }] = await Promise.all([api.get('/rutas/disponibles', filtros), api.get('/rutas/activa')]);
    if (!sigueActiva()) return;
    if (!rutas.some((r) => r.idRuta === seleccionada)) seleccionada = rutas[0]?.idRuta ?? null;
    mapa?.destruir();
    mapa = null;

    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Rutas disponibles</h2></div>
      ${activa ? html`<div class="aviso-caja" style="margin:10px 0">Ya tienes una ruta activa: ${activa.lote.nombre}.
        <div style="margin-top:6px"><a href="#/voluntario/ruta"><strong>Ir a mi ruta</strong></a></div></div>` : ''}
      <div class="rejilla-2" style="margin:12px 0 14px">
        <div><label class="etiqueta" for="zona">Zona</label>
          <select class="control" id="zona">${ZONAS.map(([v, t]) => html`<option value="${v}" ${v === filtros.radio ? 'selected' : ''}>${t}</option>`)}</select></div>
        <div><label class="etiqueta" for="orden">Ordenar</label>
          <select class="control" id="orden">
            <option value="caducidad" ${filtros.orden === 'caducidad' ? 'selected' : ''}>Caducidad</option>
            <option value="distancia" ${filtros.orden === 'distancia' ? 'selected' : ''}>Distancia</option>
          </select></div>
      </div>
      ${rutas.length ? rutas.map((r) => r.idRuta === seleccionada
        ? html`
          <article class="tarjeta destacada">
            <div class="fila-entre"><h3>${r.lote.nombre} · ${kg(r.lote.pesoKg)}</h3>${r.urgente ? chip('Urgente', 'peligro') : ''}</div>
            <p class="meta">${r.recoleccion.nombre} → ${r.entrega.nombre}${r.distanciaKm !== null ? ` · ${km(r.distanciaKm)}` : ''}</p>
            <p class="meta">${textoRestante(r.lote.horasRestantes)}${r.distanciaVoluntarioKm !== null ? ` · a ${km(r.distanciaVoluntarioKm)} de ti` : ''}</p>
            <div class="mapa" id="mapa-ruta" style="margin-top:10px"></div>
            ${paradas(r)}
            <button class="btn btn-primario btn-bloque btn-grande" style="margin-top:14px" data-aceptar="${r.idRuta}" ${activa ? 'disabled' : ''}>Aceptar ruta</button>
            <p class="ayuda centro">Al aceptar verás instrucciones y contactos.</p>
          </article>`
        : html`
          <article class="tarjeta" data-seleccionar="${r.idRuta}" style="cursor:pointer">
            <div class="fila-entre"><h3>${r.lote.nombre} · ${kg(r.lote.pesoKg)}</h3>${r.urgente ? chip('Urgente', 'peligro') : ''}</div>
            <p class="meta">${r.recoleccion.nombre} → ${r.entrega.nombre}</p>
            <p class="meta">${r.distanciaKm !== null ? `${km(r.distanciaKm)} · ` : ''}${textoRestante(r.lote.horasRestantes)}</p>
          </article>`)
      : vacio('No hay rutas disponibles por ahora. Te avisaremos cuando un receptor acepte un lote cerca de ti.')}`);

    const elegida = rutas.find((r) => r.idRuta === seleccionada);
    if (elegida) {
      mapa = mapaPuntos($('#mapa-ruta'), [
        { latitud: elegida.recoleccion.latitud, longitud: elegida.recoleccion.longitud, etiqueta: '1 · Recolección' },
        { latitud: elegida.entrega.latitud, longitud: elegida.entrega.longitud, etiqueta: '2 · Entrega' },
      ], { linea: true });
    }

    $('#zona').addEventListener('change', (e) => { filtros.radio = e.target.value; pintar(); });
    $('#orden').addEventListener('change', (e) => { filtros.orden = e.target.value; pintar(); });
    $$('[data-seleccionar]', contenedor).forEach((t) =>
      t.addEventListener('click', () => { seleccionada = Number(t.dataset.seleccionar); pintar(); }));
    $('[data-aceptar]', contenedor)?.addEventListener('click', async (e) => {
      try {
        const boton = e.currentTarget;
        await conBoton(boton, () => api.post(`/rutas/${boton.dataset.aceptar}/aceptar`));
        avisar('Ruta aceptada. Dirígete al punto de recolección.', 'ok');
        ir('/voluntario/ruta');
      } catch (error) {
        avisarError(error);
        pintar();
      }
    });
  };

  await pintar();
  alLimpiar(escuchar((tipo, datos) => {
    if (tipo === 'notificacion' && datos.notificacion.tipo === 'NUEVO_LOTE') pintar().catch(() => {});
  }));
}

const ETIQUETA_ESTADO_ACTIVA = {
  EN_RECOLECCION: 'En proceso de recolección',
  EN_CAMINO: 'En camino a entregar',
};

function pasosRuta(paso) {
  const lista = [[1, '1 · Recolección'], [2, '2 · Checklist'], [3, '3 · Evidencia'], [4, '4 · Entregado']];
  return html`<div class="pasos">${lista.map(([n, t]) => html`<span class="paso ${n === paso ? 'activo' : n < paso ? 'hecho' : ''}">${t}</span>`)}</div>`;
}

function pintarEntregaTerminada(contenedor, idRuta, nombreLote) {
  montar(contenedor, html`
    <div class="titulo-pagina"><h2>Mi ruta activa</h2></div>
    ${pasosRuta(4)}
    <div class="aviso-caja ok">¡Entrega registrada! ${nombreLote} llegó a su destino. Gracias por tu apoyo.</div>
    <div id="calificaciones"></div>
    <a class="btn btn-primario btn-bloque" style="margin-top:16px" href="#/voluntario/rutas">Buscar otra ruta</a>`);
  montarCalificaciones($('#calificaciones', contenedor), idRuta);
}

// CU 9 y 10 · Wireframe "Ruta Activa".
export async function vistaMiRuta({ contenedor, encabezado, ir, alLimpiar }) {
  encabezado();
  const { ruta, checklist, criterios } = await api.get('/rutas/activa');

  if (!ruta) {
    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Mi ruta activa</h2></div>
      ${vacio('No tienes una ruta activa.')}
      <a class="btn btn-primario btn-bloque" style="margin-top:14px" href="#/voluntario/rutas">Ver rutas disponibles</a>`);
    return;
  }

  const enCamino = ruta.estado === 'EN_CAMINO';
  const marcado = (criterio) => checklist?.items.find((i) => i.criterio === criterio)?.cumple ?? false;
  let mapa = null;
  alLimpiar(() => mapa?.destruir());

  montar(contenedor, html`
    <div class="titulo-pagina"><h2>Mi ruta activa</h2></div>
    <p class="texto-suave" style="margin:2px 0 8px">${ruta.lote.nombre} · ${kg(ruta.lote.pesoKg)} · ${textoRestante(ruta.lote.horasRestantes)}</p>
    ${chip(ETIQUETA_ESTADO_ACTIVA[ruta.estado] ?? ruta.estado, enCamino ? 'info' : 'aviso')}
    ${pasosRuta(ruta.paso)}

    <div class="tarjeta">
      <div class="fila-entre"><strong>Resumen de la ruta</strong><button class="enlace" id="ver-resumen">Ver</button></div>
      <div id="resumen" hidden>
        <div class="mapa" id="mapa-activa" style="margin-top:10px"></div>
        ${paradas(ruta)}
        <div class="rejilla-2" style="margin-top:12px">
          <div class="texto-chico"><strong>Donante</strong><br>${ruta.recoleccion.nombre}<br>
            ${ruta.recoleccion.telefono ? html`<a href="tel:${ruta.recoleccion.telefono}">${ruta.recoleccion.telefono}</a>` : ''}<br>
            <a href="${enlaceMaps(ruta.recoleccion.latitud, ruta.recoleccion.longitud)}" target="_blank" rel="noopener">Cómo llegar</a></div>
          <div class="texto-chico"><strong>Receptor</strong><br>${ruta.entrega.nombre}<br>
            ${ruta.entrega.telefono ? html`<a href="tel:${ruta.entrega.telefono}">${ruta.entrega.telefono}</a>` : ''}<br>
            ${ruta.entrega.latitud !== null ? html`<a href="${enlaceMaps(ruta.entrega.latitud, ruta.entrega.longitud)}" target="_blank" rel="noopener">Cómo llegar</a>` : ''}</div>
        </div>
      </div>
    </div>

    <form class="tarjeta" id="form-checklist" novalidate>
      <div class="fila-entre"><h3>Checklist de inocuidad</h3>${enCamino ? chip('Aprobado', 'ok') : ''}</div>
      <div style="margin-top:10px" class="pila">
        ${criterios.map(({ criterio }) => html`
          <label class="casilla"><input type="checkbox" name="criterio" value="${criterio}" ${marcado(criterio) || enCamino ? 'checked' : ''} ${enCamino ? 'disabled' : ''}>
            <span>${criterio}</span></label>`)}
      </div>
      <div class="campo" style="margin-top:12px" data-campo="temperaturaC">
        <label for="temperatura">Temperatura (°C)</label>
        <input class="control" id="temperatura" name="temperaturaC" type="number" step="0.1" inputmode="decimal" placeholder="0.0"
          value="${checklist?.temperaturaC ?? ''}" ${enCamino ? 'disabled' : ''}>
      </div>
      <p class="ayuda">Todos los puntos críticos deben estar aprobados.</p>
      ${enCamino ? '' : html`
        <button class="btn btn-primario btn-bloque" type="submit">Validar checklist y confirmar recolección</button>
        <button class="btn btn-bloque" type="button" id="incumplimiento" style="margin-top:8px">Reportar incumplimiento</button>`}
    </form>

    <form class="tarjeta ${enCamino ? '' : 'deshabilitada'}" id="form-evidencia" novalidate aria-disabled="${enCamino ? 'false' : 'true'}">
      <h3>Evidencia de entrega</h3>
      ${enCamino ? '' : html`<p class="ayuda">Se habilita al aprobar el checklist.</p>`}
      <div class="campo" style="margin-top:10px" data-campo="fotos"><div id="fotos-evidencia"></div></div>
      <div class="campo" data-campo="confirmacion">
        <div class="fila-entre"><span class="etiqueta">Firma digital del receptor</span><button type="button" class="enlace texto-chico" id="limpiar-firma">Limpiar</button></div>
        <canvas class="firma-lienzo" id="firma" aria-label="Área para firmar"></canvas>
      </div>
      <div class="campo" data-campo="codigo">
        <label for="codigo">O código de confirmación</label>
        <input class="control" id="codigo" name="codigo" inputmode="numeric" maxlength="6" placeholder="Código del receptor">
      </div>
      <button class="btn btn-primario btn-bloque" type="submit" ${enCamino ? '' : 'disabled'}>Confirmar entrega</button>
    </form>`);

  $('#ver-resumen').addEventListener('click', (e) => {
    const caja = $('#resumen');
    caja.hidden = !caja.hidden;
    e.currentTarget.textContent = caja.hidden ? 'Ver' : 'Ocultar';
    if (!caja.hidden && !mapa) {
      mapa = mapaPuntos($('#mapa-activa'), [
        { latitud: ruta.recoleccion.latitud, longitud: ruta.recoleccion.longitud, etiqueta: '1 · Recolección' },
        { latitud: ruta.entrega.latitud, longitud: ruta.entrega.longitud, etiqueta: '2 · Entrega' },
      ], { linea: true });
    }
  });

  const datosChecklist = (observaciones) => {
    const marcados = $$('input[name=criterio]:checked', contenedor).map((i) => i.value);
    return {
      respuestas: Object.fromEntries(criterios.map(({ criterio }) => [criterio, marcados.includes(criterio)])),
      temperaturaC: $('#temperatura').value,
      observaciones,
    };
  };

  const formChecklist = $('#form-checklist');
  formChecklist.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formChecklist);
    try {
      const resultado = await conBoton($('[type=submit]', formChecklist), () =>
        api.post(`/rutas/${ruta.idRuta}/checklist`, datosChecklist()));
      if (resultado.aprobado) {
        avisar('Checklist aprobado. Recolección confirmada: ve al punto de entrega.', 'ok');
        ir('/voluntario/ruta');
      } else {
        mostrarErrores(formChecklist, {
          message: `Faltan puntos críticos: ${resultado.incumplidos.join(', ')}. Si el lote no cumple, repórtalo.`,
        });
      }
    } catch (error) {
      mostrarErrores(formChecklist, error);
    }
  });

  $('#incumplimiento')?.addEventListener('click', () => {
    const { elemento, cerrar } = abrirModal(String(html`
      <h3>Reportar incumplimiento</h3>
      <p class="texto-suave">El lote se rechazará y se avisará al donante y al receptor. Esta acción no se puede deshacer.</p>
      <form novalidate>
        <div class="campo" data-campo="observaciones">
          <label for="obs">¿Qué no cumple?</label>
          <textarea class="control" id="obs" placeholder="Ej. La cadena de frío se rompió: 15 °C" required></textarea>
        </div>
        <div class="acciones">
          <button class="btn" type="button" data-cerrar>Cancelar</button>
          <button class="btn btn-peligro" type="submit">Rechazar lote</button>
        </div>
      </form>`));
    elemento.querySelector('[data-cerrar]').addEventListener('click', cerrar);
    const formulario = elemento.querySelector('form');
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await conBoton(formulario.querySelector('[type=submit]'), () =>
          api.post(`/rutas/${ruta.idRuta}/incumplimiento`, datosChecklist(formulario.querySelector('textarea').value)));
        cerrar();
        avisar('Incumplimiento reportado. El lote fue rechazado.', 'ok');
        ir('/voluntario/rutas');
      } catch (error) {
        mostrarErrores(formulario, error);
      }
    });
  });

  if (!enCamino) return;

  const fotos = selectorFotos($('#fotos-evidencia'));
  const firma = crearFirma($('#firma'));
  $('#limpiar-firma').addEventListener('click', () => firma.limpiar());

  const formEvidencia = $('#form-evidencia');
  formEvidencia.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formEvidencia);
    const datos = new FormData();
    for (const archivo of fotos.archivos()) datos.append('fotos', archivo, archivo.name);
    if (!firma.vacia()) datos.append('firma', await firma.aBlob(), 'firma.png');
    const codigo = $('#codigo').value.trim();
    if (codigo) datos.append('codigo', codigo);

    const ok = await confirmar('Confirmar entrega', `¿${ruta.entrega.nombre} recibió ${ruta.lote.nombre}?`, { textoAceptar: 'Sí, confirmar' });
    if (!ok) return;
    try {
      await conBoton($('[type=submit]', formEvidencia), () => api.enviarFormulario(`/rutas/${ruta.idRuta}/evidencia`, datos));
      avisar('Entrega registrada.', 'ok');
      pintarEntregaTerminada(contenedor, ruta.idRuta, ruta.lote.nombre);
    } catch (error) {
      mostrarErrores(formEvidencia, error);
    }
  });
}
