import { api } from '../api.js';
import { mapaPuntos } from '../mapa.js';
import {
  $, $$, avisar, avisarError, chip, chipLote, chipRuta, confirmar, conBoton, fechaCorta, hace, horaCorta, html, kg,
  montar, textoRestante,
} from '../ui.js';
import { montarCalificaciones } from './comunes.js';

const PASOS = [
  ['PUBLICADO', 'Publicado'],
  ['EN_RECOLECCION', 'En recolección'],
  ['ENTREGADO', 'Entregado'],
];

function pasosEstado(estado) {
  const indice = PASOS.findIndex(([clave]) => clave === estado);
  return html`<div class="pasos">
    ${PASOS.map(([, texto], i) => html`<span class="paso ${i === indice ? 'activo' : i < indice ? 'hecho' : ''}">${texto}</span>`)}
  </div>`;
}

export async function vistaDetalleLote({ contenedor, params, encabezado, usuario, ir, alLimpiar }) {
  encabezado({ titulo: 'Detalle del lote', atras: true });
  const lote = await api.get(`/lotes/${params[0]}`);
  const { fotos } = lote;
  const terminado = ['CANCELADO', 'CADUCADO'].includes(lote.estado);

  montar(contenedor, html`
    <div class="titulo-pagina">
      <div class="fila">
        <h2>${lote.nombre} · ${kg(lote.pesoKg)}</h2>
        ${lote.estado === 'PUBLICADO' && lote.urgente ? chip('Urgente', 'peligro') : chipLote(lote.estado)}
      </div>
    </div>
    <div class="dos-columnas" style="margin-top:16px">
      <div>
        ${fotos.length
          ? html`<img class="foto-principal" id="foto-principal" src="${fotos[0]}" alt="Foto principal del lote">
                 ${fotos.length > 1 ? html`<div class="galeria">${fotos.map((f, i) => html`<img src="${f}" alt="Foto ${i + 1}" class="${i === 0 ? 'activa' : ''}" data-foto="${f}">`)}</div>` : ''}`
          : html`<div class="foto-principal mapa-placeholder">Sin fotografía</div>`}
        <h3 class="seccion-titulo">Descripción</h3>
        <p class="texto-suave" style="margin:0">${lote.descripcion}</p>
        ${lote.evidencia ? html`
          <h3 class="seccion-titulo">Evidencia de entrega</h3>
          <div class="tarjeta">
            <p class="meta" style="margin:0 0 8px">Entregado ${hace(lote.evidencia.fechaRegistro).toLowerCase()} · ${lote.evidencia.conCodigo ? 'Confirmado con código' : 'Confirmado con firma'}</p>
            <div class="galeria">${lote.evidencia.fotos.map((f, i) => html`<a href="${f}" target="_blank" rel="noopener"><img src="${f}" alt="Evidencia ${i + 1}"></a>`)}</div>
            ${lote.evidencia.firmaDigital ? html`<p class="etiqueta" style="margin-top:10px">Firma del receptor</p><img src="${lote.evidencia.firmaDigital}" alt="Firma del receptor" style="max-height:110px;border:1px solid var(--borde);border-radius:8px;background:#fff">` : ''}
          </div>` : ''}
        <div id="calificaciones"></div>
      </div>
      <div class="pila">
        <div class="tarjeta">
          ${terminado ? html`<div class="aviso-caja">Este lote fue ${lote.estado === 'CADUCADO' ? 'marcado como caducado' : 'cancelado'}.</div>` : pasosEstado(lote.estado)}
          <dl class="datos-rejilla">
            <div><dt>Categoría</dt><dd>${lote.categoria}</dd></div>
            <div><dt>Peso</dt><dd>${kg(lote.pesoKg)}</dd></div>
            <div><dt>Caduca</dt><dd>${fechaCorta(lote.fechaCaducidad)}${lote.horaCaducidad ? ` · ${horaCorta(lote.horaCaducidad)}` : ''}</dd></div>
            <div><dt>Tiempo restante</dt><dd>${terminado || lote.estado === 'ENTREGADO' ? '—' : textoRestante(lote.horasRestantes)}</dd></div>
          </dl>
          ${lote.puedeAceptar || lote.puedeCancelar ? html`
            <div class="pila" style="margin-top:16px">
              ${lote.puedeAceptar ? html`<button class="btn btn-primario btn-bloque btn-grande" id="aceptar">Aceptar lote</button>` : ''}
              ${lote.puedeCancelar ? html`<button class="btn btn-peligro btn-bloque" id="cancelar">Cancelar publicación</button>` : ''}
            </div>` : ''}
        </div>
        <div class="tarjeta fila-entre">
          <div>
            <strong>${lote.donante.nombre}</strong>
            <div class="texto-suave texto-chico">
              ${lote.distanciaKm !== null && !lote.esDueno ? `${lote.distanciaKm.toFixed(1)} km de ti · ` : ''}Confiabilidad ${Number(lote.donante.confiabilidad ?? 0).toFixed(1)} / 5
            </div>
            ${lote.donante.telefono ? html`<a class="texto-chico" href="tel:${lote.donante.telefono}">${lote.donante.telefono}</a>` : ''}
          </div>
          ${lote.donante.verificado ? chip('Verificado', 'ok') : ''}
        </div>
        ${lote.ruta ? html`
          <div class="tarjeta">
            <div class="fila-entre"><strong>Ruta de rescate</strong>${chipRuta(lote.ruta.estado)}</div>
            <p class="meta">Receptor: ${lote.ruta.receptorNombre ?? '—'}</p>
            <p class="meta">Voluntario: ${lote.ruta.voluntarioNombre ?? 'Esperando voluntario'}</p>
          </div>` : ''}
        <div class="tarjeta">
          <strong>Punto de recogida</strong>
          <p class="meta" style="margin:2px 0 10px">${lote.direccionRecogida}</p>
          <div class="mapa" id="mapa-detalle"></div>
        </div>
      </div>
    </div>`);

  const mapa = mapaPuntos($('#mapa-detalle'), [{ latitud: lote.latitud, longitud: lote.longitud, etiqueta: 'Recolección' }]);
  alLimpiar(() => mapa.destruir());

  $$('[data-foto]', contenedor).forEach((miniatura) =>
    miniatura.addEventListener('click', () => {
      $('#foto-principal').src = miniatura.dataset.foto;
      $$('[data-foto]', contenedor).forEach((m) => m.classList.toggle('activa', m === miniatura));
    }),
  );

  if (lote.ruta?.estado === 'ENTREGADA' && lote.participa) {
    await montarCalificaciones($('#calificaciones'), lote.ruta.idRuta);
  }

  $('#aceptar')?.addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    const ok = await confirmar(
      'Aceptar lote',
      `Te comprometes a recibir ${kg(lote.pesoKg)} de ${lote.nombre}. Un voluntario lo llevará a tu dirección.`,
      { textoAceptar: 'Aceptar lote' },
    );
    if (!ok) return;
    try {
      const ruta = await conBoton(boton, () => api.post(`/lotes/${lote.idLote}/aceptar`));
      avisar(`Lote aceptado. Tu código de confirmación es ${ruta.codigoConfirmacion}.`, 'ok', 8000);
      ir('/receptor/recepciones');
    } catch (error) {
      avisarError(error);
    }
  });

  $('#cancelar')?.addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    const ok = await confirmar('Cancelar publicación', 'El lote dejará de estar disponible para receptores y voluntarios.', {
      textoAceptar: 'Sí, cancelar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await conBoton(boton, () => api.post(`/lotes/${lote.idLote}/cancelar`));
      avisar('Publicación cancelada.', 'ok');
      ir(usuario.rol === 'ADMINISTRADOR' ? '/admin/lotes' : '/donante/lotes');
    } catch (error) {
      avisarError(error);
    }
  });
}
