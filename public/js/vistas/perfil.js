import { api } from '../api.js';
import { mapaSelector, obtenerUbicacion } from '../mapa.js';
import { sesion } from '../sesion.js';
import {
  $, $$, avisar, avisarError, chipLote, chipVerificacion, conBoton, ETIQUETA_ROL, fechaCorta, html, kg, limpiarErrores,
  montar, mostrarErrores, vacio,
} from '../ui.js';

export async function vistaPerfil({ contenedor, encabezado, refrescarUsuario, alLimpiar, sigueActiva }) {
  encabezado();
  let usuario = await refrescarUsuario();
  let pestana = 'datos';
  let dias = 30;
  let mapa = null;
  alLimpiar(() => mapa?.destruir());

  const pintarHistorial = async () => {
    const caja = $('#historial');
    const { historial } = await api.get('/perfil/historial', { dias });
    if (!sigueActiva() || !caja) return;
    montar(caja, historial.length
      ? html`
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead><tr><th>Fecha</th><th>Lote</th><th>Peso</th><th>Contraparte</th><th>Movimiento</th><th></th></tr></thead>
            <tbody>
              ${historial.map((h) => html`
                <tr>
                  <td>${fechaCorta(h.fecha)}</td>
                  <td><strong>${h.nombreLote}</strong></td>
                  <td>${kg(h.pesoKg)}</td>
                  <td>${h.contraparte ?? '—'}</td>
                  <td>${chipLote(h.tipoActividad)}</td>
                  <td class="derecha"><a class="btn btn-chico" href="#/lote/${h.idLote}">Ver lote</a></td>
                </tr>`)}
            </tbody>
          </table>
        </div>`
      : vacio('Sin movimientos en este periodo.'));
  };

  const pintar = () => {
    mapa?.destruir();
    mapa = null;
    montar(contenedor, html`
      <div class="titulo-pagina">
        <h2>Perfil e historial</h2>
        <div class="segmentos">
          <button class="chip ${pestana === 'datos' ? 'chip-solido' : ''}" data-pestana="datos">Mis datos</button>
          <button class="chip ${pestana === 'historial' ? 'chip-solido' : ''}" data-pestana="historial">Historial</button>
        </div>
      </div>
      ${pestana === 'datos' ? html`
        <form class="tarjeta" id="form-perfil" novalidate style="margin-top:16px">
          <div class="dos-columnas">
            <div>
              <div class="campo" data-campo="nombre"><label for="nombre">Nombre o razón social</label>
                <input class="control" id="nombre" name="nombre" maxlength="150" value="${usuario.nombre}"></div>
              <div class="rejilla-2">
                <div class="campo" data-campo="correo"><label for="correo">Correo electrónico</label>
                  <input class="control" id="correo" name="correo" type="email" value="${usuario.correo}"></div>
                <div class="campo" data-campo="telefono"><label for="telefono">Teléfono</label>
                  <input class="control" id="telefono" name="telefono" type="tel" value="${usuario.telefono}"></div>
              </div>
              <div class="campo" data-campo="nuevaContrasena"><label for="nueva">Nueva contraseña</label>
                <input class="control" id="nueva" name="nuevaContrasena" type="password" autocomplete="new-password" placeholder="Vacío para conservar la actual"></div>
              <div class="pila" style="margin-bottom:16px">
                <label class="casilla"><input type="checkbox" name="avisarNuevosLotes" ${usuario.avisarNuevosLotes ? 'checked' : ''}><span>Avisarme de nuevos lotes cercanos</span></label>
                <label class="casilla"><input type="checkbox" name="avisarCaducidades" ${usuario.avisarCaducidades ? 'checked' : ''}><span>Avisarme de caducidades próximas</span></label>
              </div>
              <div class="caja-legal fila-entre"><span>Confiabilidad</span><strong>${Number(usuario.indiceConfiabilidad).toFixed(1)} / 5</strong></div>
              ${usuario.requiereVerificacion ? html`
                <a class="caja-legal fila-entre enlace-caja" style="margin-top:12px" href="#/verificacion">
                  <span><strong>Verificación</strong><br><span class="texto-suave texto-chico">${ETIQUETA_ROL[usuario.rol]}</span></span>
                  ${chipVerificacion(usuario.estadoVerificacion)}
                </a>` : ''}
            </div>
            <div>
              <div class="campo" data-campo="direccion"><label for="direccion">Dirección</label>
                <input class="control" id="direccion" name="direccion" value="${usuario.direccion}"></div>
              <div class="campo" data-campo="ubicacion">
                <div class="mapa" id="mapa-perfil"></div>
                <div class="fila-entre" style="margin-top:6px">
                  <span class="ayuda" id="coordenadas">${usuario.latitud !== null ? `Punto: ${usuario.latitud.toFixed(5)}, ${usuario.longitud.toFixed(5)}` : 'Sin ubicación: haz clic en el mapa.'}</span>
                  <button class="enlace texto-chico" type="button" id="usar-ubicacion">Usar mi ubicación</button>
                </div>
              </div>
            </div>
          </div>
          <div class="acciones"><button class="btn btn-primario" type="submit">Guardar cambios</button></div>
        </form>`
      : html`
        <div class="barra-filtros" style="margin-top:16px">
          <div><label class="etiqueta" for="periodo">Periodo</label>
            <select class="control" id="periodo">
              ${[[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días'], [365, 'Último año']].map(([v, t]) =>
                html`<option value="${v}" ${v === dias ? 'selected' : ''}>${t}</option>`)}
            </select></div>
        </div>
        <div id="historial"><div class="cargando">Cargando…</div></div>`}`);

    $$('[data-pestana]', contenedor).forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.pestana; pintar(); }));

    if (pestana === 'historial') {
      $('#periodo').addEventListener('change', (e) => { dias = Number(e.target.value); pintarHistorial(); });
      pintarHistorial().catch(avisarError);
      return;
    }

    const punto = { latitud: usuario.latitud, longitud: usuario.longitud };
    const mostrar = () => {
      $('#coordenadas').textContent = `Punto: ${Number(punto.latitud).toFixed(5)}, ${Number(punto.longitud).toFixed(5)}`;
    };
    mapa = mapaSelector($('#mapa-perfil'), {
      latitud: punto.latitud,
      longitud: punto.longitud,
      alCambiar: (lat, lng) => { punto.latitud = lat; punto.longitud = lng; mostrar(); },
    });
    $('#usar-ubicacion').addEventListener('click', async () => {
      try {
        Object.assign(punto, await obtenerUbicacion());
        mapa.fijar(punto.latitud, punto.longitud);
        mostrar();
      } catch (error) {
        avisarError(error);
      }
    });

    const formulario = $('#form-perfil');
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      limpiarErrores(formulario);
      const datos = Object.fromEntries(new FormData(formulario));
      datos.avisarNuevosLotes = formulario.avisarNuevosLotes.checked;
      datos.avisarCaducidades = formulario.avisarCaducidades.checked;
      if (punto.latitud !== null) Object.assign(datos, punto);
      try {
        ({ usuario } = await conBoton($('[type=submit]', formulario), () => api.put('/perfil', datos)));
        sesion.actualizarUsuario(usuario);
        avisar('Perfil actualizado.', 'ok');
        pintar();
      } catch (error) {
        mostrarErrores(formulario, error);
      }
    });
  };

  pintar();
}
