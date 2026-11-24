import { api } from '../clienteApi.js';
import { escuchar } from '../notificacionesTiempoReal.js';
import { $, $$, avisarError, chip, hace, html, montar, vacio } from '../utilidadesInterfaz.js';

const PESTANAS = [
  ['', 'Todas'],
  ['NUEVO_LOTE', 'Nuevos lotes'],
  ['CADUCIDAD_PROXIMA', 'Caducidad'],
  ['CUENTA', 'Cuenta'],
];

const ETIQUETA_TIPO = {
  NUEVO_LOTE: ['Nuevo lote', 'ok'],
  CADUCIDAD_PROXIMA: ['Caducidad próxima', 'peligro'],
  CUENTA: ['Mi cuenta', ''],
};

function destino(notificacion, rol) {
  if (notificacion.idLote) return [`#/lote/${notificacion.idLote}`, 'Ver lote'];
  if (/verific/i.test(notificacion.mensaje) && ['DONANTE', 'RECEPTOR'].includes(rol)) return ['#/verificacion', 'Ver verificación'];
  if (rol === 'ADMINISTRADOR') return ['#/admin', 'Revisar'];
  return ['#/perfil', 'Ver perfil'];
}

export async function vistaAlertas({ contenedor, encabezado, usuario, fijarNoLeidas, alLimpiar, sigueActiva }) {
  encabezado();
  let tipo = '';

  const pintar = async () => {
    const { notificaciones, noLeidas } = await api.get('/notificaciones', { tipo });
    if (!sigueActiva()) return;
    fijarNoLeidas(noLeidas);
    montar(contenedor, html`
      <div class="titulo-pagina">
        <h2>Alertas</h2>
        ${noLeidas > 0 ? html`<button class="btn btn-chico" id="marcar-todas">Marcar todas como leídas</button>` : ''}
      </div>
      <div class="chips" style="margin:16px 0">
        ${PESTANAS.map(([valor, texto]) => html`<button class="chip ${valor === tipo ? 'chip-solido' : ''}" data-tipo="${valor}">${texto}</button>`)}
      </div>
      ${notificaciones.length ? html`
        <div class="bandeja">
          ${notificaciones.map((n) => {
            const [etiqueta, variante] = ETIQUETA_TIPO[n.tipo];
            const [href, textoEnlace] = destino(n, usuario.rol);
            return html`
              <article class="bandeja-fila ${n.leida ? '' : 'no-leida'}">
                <div class="bandeja-tipo">${chip(etiqueta, variante)}</div>
                <p class="bandeja-mensaje">${n.mensaje}</p>
                <span class="texto-suave texto-chico bandeja-hora">${hace(n.fechaEnvio)}</span>
                <a class="btn btn-chico" href="${href}" data-leer="${n.idNotificacion}">${textoEnlace}</a>
              </article>`;
          })}
        </div>` : vacio('No tienes alertas.')}`);

    $$('[data-tipo]', contenedor).forEach((b) => b.addEventListener('click', () => { tipo = b.dataset.tipo; pintar(); }));
    $$('[data-leer]', contenedor).forEach((a) =>
      a.addEventListener('click', () => { api.post(`/notificaciones/${a.dataset.leer}/leida`).catch(() => {}); }));
    $('#marcar-todas')?.addEventListener('click', async () => {
      try {
        await api.post('/notificaciones/leidas');
        await pintar();
      } catch (error) {
        avisarError(error);
      }
    });
  };

  await pintar();
  alLimpiar(escuchar((evento) => { if (evento === 'notificacion') pintar().catch(() => {}); }));
}
