import { api } from '../api.js';
import { $$, avisar, avisarError, html, montar, ETIQUETA_ROL } from '../ui.js';

export async function montarCalificaciones(contenedor, idRuta) {
  let pendientes;
  try {
    ({ pendientes } = await api.get(`/rutas/${idRuta}/calificaciones`));
  } catch {
    contenedor.innerHTML = '';
    return;
  }
  if (!pendientes.length) {
    contenedor.innerHTML = '';
    return;
  }

  montar(contenedor, html`
    <h3 class="seccion-titulo">Califica la entrega</h3>
    <div class="rejilla-tarjetas">
      ${pendientes.map((p) => html`
        <div class="tarjeta" data-evaluado="${p.idUsuario}">
          <div class="fila-entre"><strong>${p.nombre}</strong><span class="texto-suave texto-chico">${ETIQUETA_ROL[p.rol]}</span></div>
          <div class="estrellas" role="radiogroup" aria-label="Puntuación de ${p.nombre}" style="margin:8px 0">
            ${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-puntos="${n}" aria-label="${n} de 5">★</button>`)}
          </div>
          <input class="control" maxlength="255" placeholder="Comentario (opcional)">
          <button class="btn btn-primario btn-bloque" style="margin-top:8px" disabled>Enviar calificación</button>
        </div>`)}
    </div>`);

  $$('[data-evaluado]', contenedor).forEach((tarjeta) => {
    let puntos = 0;
    const botonEnviar = tarjeta.querySelector('.btn');
    tarjeta.querySelectorAll('[data-puntos]').forEach((estrella) => {
      estrella.addEventListener('click', () => {
        puntos = Number(estrella.dataset.puntos);
        tarjeta.querySelectorAll('[data-puntos]').forEach((s) => s.classList.toggle('on', Number(s.dataset.puntos) <= puntos));
        botonEnviar.disabled = false;
      });
    });
    botonEnviar.addEventListener('click', async () => {
      try {
        await api.post(`/rutas/${idRuta}/calificaciones`, {
          idEvaluado: Number(tarjeta.dataset.evaluado),
          puntuacion: puntos,
          comentario: tarjeta.querySelector('input').value,
        });
        avisar('¡Gracias por calificar!', 'ok');
        await montarCalificaciones(contenedor, idRuta);
      } catch (error) {
        avisarError(error);
      }
    });
  });
}
