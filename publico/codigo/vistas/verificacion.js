import { api } from '../clienteApi.js';
import { $, $$, abrirModal, avisar, avisarError, chip, conBoton, html, montar } from '../utilidadesInterfaz.js';

export async function verDocumento(idDocumento, nombre) {
  try {
    const blob = await api.archivo(`/verificacion/documentos/${idDocumento}/archivo`);
    const url = URL.createObjectURL(blob);
    const contenido = blob.type === 'application/pdf'
      ? html`<iframe class="visor-documento" src="${url}" title="${nombre}"></iframe>`
      : html`<img src="${url}" alt="${nombre}" style="width:100%;border-radius:8px">`;
    const { elemento, cerrar } = abrirModal(String(html`
      <h3>${nombre}</h3>${contenido}
      <div class="acciones"><button class="btn" data-cerrar>Cerrar</button></div>`), { alCerrar: () => URL.revokeObjectURL(url) });
    elemento.querySelector('[data-cerrar]').addEventListener('click', cerrar);
  } catch (error) {
    avisarError(error);
  }
}

function pasoActual(estado) {
  if (estado === 'VERIFICADO') return 3;
  if (estado === 'EN_REVISION') return 2;
  return 1;
}

export async function vistaVerificacion({ contenedor, encabezado, refrescarUsuario, sigueActiva }) {
  encabezado({ titulo: 'Verificación de cuenta', atras: '/perfil' });

  const pintar = async (datos) => {
    const v = datos ?? (await api.get('/verificacion'));
    if (!sigueActiva()) return;
    const paso = pasoActual(v.estadoVerificacion);
    const observaciones = v.solicitud?.estado === 'RECHAZADA' ? v.solicitud.observaciones : null;

    montar(contenedor, html`
      <div class="titulo-pagina"><h2>Verificación</h2></div>
      <p class="subtitulo">Necesitas una cuenta verificada para publicar o recibir lotes.</p>
      <div class="pasos">
        ${[[1, '1 · Documentos'], [2, '2 · En revisión'], [3, '3 · Verificado']].map(([n, t]) =>
          html`<span class="paso ${n === paso ? 'activo' : n < paso ? 'hecho' : ''}">${t}</span>`)}
      </div>
      ${v.estadoVerificacion === 'VERIFICADO' ? html`<div class="aviso-caja ok" style="margin-bottom:16px">Tu cuenta está verificada.</div>` : ''}
      ${v.estadoVerificacion === 'EN_REVISION' ? html`<div class="aviso-caja" style="margin-bottom:16px">Tus documentos están en revisión por el administrador.</div>` : ''}
      <div class="dos-columnas">
        <div class="tarjeta">
          <h3>Documentos</h3>
          ${v.documentos.map((d) => html`
            <div class="fila-entre" style="padding:12px 0;border-top:1px solid var(--borde);margin-top:12px">
              <div class="fila">
                <strong>${d.nombre}</strong>
                ${d.estado === 'CARGADO' ? chip('Cargado', 'ok') : chip('Pendiente', 'apagado')}
              </div>
              <div class="fila">
                ${d.idDocumento && d.estado === 'CARGADO' ? html`<button class="btn btn-chico" data-ver="${d.idDocumento}" data-nombre="${d.nombre}">Ver</button>` : ''}
                ${v.editable ? html`
                  <label class="btn btn-chico" style="cursor:pointer">Subir archivo
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-tipo="${d.tipo}" hidden>
                  </label>` : ''}
              </div>
            </div>`)}
        </div>
        <div class="pila">
          <div class="tarjeta">
            <strong>Observaciones del administrador</strong>
            <p class="meta">${observaciones ?? 'Si se rechaza tu solicitud, aquí verás el motivo.'}</p>
          </div>
          ${v.editable ? html`
            <div class="tarjeta">
              <p class="meta" style="margin:0 0 14px">Sube todos los documentos y envíalos a revisión. Puedes guardar el borrador y continuar después.</p>
              <div class="acciones" style="margin:0">
                <button class="btn" id="guardar">Guardar borrador</button>
                <button class="btn btn-primario" id="enviar">Enviar a revisión</button>
              </div>
            </div>` : ''}
        </div>
      </div>`);

    $$('input[data-tipo]', contenedor).forEach((entrada) =>
      entrada.addEventListener('change', async () => {
        const archivo = entrada.files[0];
        if (!archivo) return;
        const datosForm = new FormData();
        datosForm.append('archivo', archivo, archivo.name);
        try {
          const actualizado = await api.enviarFormulario(`/verificacion/documentos/${entrada.dataset.tipo}`, datosForm);
          avisar('Documento cargado.', 'ok');
          await pintar(actualizado);
        } catch (error) {
          avisarError(error);
        }
      }));
    $$('[data-ver]', contenedor).forEach((b) => b.addEventListener('click', () => verDocumento(b.dataset.ver, b.dataset.nombre)));
    $('#guardar')?.addEventListener('click', async (e) => {
      try {
        await pintar(await conBoton(e.currentTarget, () => api.post('/verificacion/guardar')));
        avisar('Borrador guardado.', 'ok');
      } catch (error) {
        avisarError(error);
      }
    });
    $('#enviar')?.addEventListener('click', async (e) => {
      try {
        const actualizado = await conBoton(e.currentTarget, () => api.post('/verificacion/enviar'));
        avisar('Documentos enviados a revisión.', 'ok');
        await refrescarUsuario();
        await pintar(actualizado);
      } catch (error) {
        const faltan = error.detalles?.documentos ? ` Faltan: ${error.detalles.documentos}.` : '';
        avisar(`${error.message}${faltan}`, 'error', 6000);
      }
    });
  };

  await pintar();
}
