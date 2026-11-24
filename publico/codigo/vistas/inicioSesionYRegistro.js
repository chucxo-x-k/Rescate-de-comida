import { api } from '../clienteApi.js';
import { iniciarSesionUI } from '../aplicacion.js';
import { mapaSelector, obtenerUbicacion } from '../mapas.js';
import { $, abrirModal, avisar, avisarError, conBoton, html, limpiarErrores, montar, mostrarErrores } from '../utilidadesInterfaz.js';

export async function vistaLogin({ contenedor }) {
  montar(contenedor, html`
    <section class="acceso">
      <div class="acceso-marca">
        <div class="marca"><img src="/imagenes/logotipo.svg" alt=""><strong>Rescate de Comida</strong></div>
        <p class="acceso-lema">Conectamos donantes, comedores comunitarios y voluntarios para rescatar alimentos antes de que caduquen.</p>
        <ul class="acceso-roles">
          <li><strong>Donantes</strong><span>Publican sus excedentes en minutos.</span></li>
          <li><strong>Receptores</strong><span>Reciben lotes cercanos a su comedor.</span></li>
          <li><strong>Voluntarios</strong><span>Recogen y entregan con trazabilidad.</span></li>
        </ul>
      </div>
      <div class="acceso-panel">
        <h2>Iniciar sesión</h2>
        <p class="subtitulo">Accede a tu panel de donante, receptor, voluntario o administrador.</p>
        <form id="form-login" novalidate>
          <div class="campo" data-campo="correo">
            <label for="correo">Correo electrónico</label>
            <input class="control" id="correo" name="correo" type="email" autocomplete="email" placeholder="correo@ejemplo.com" required>
          </div>
          <div class="campo" data-campo="contrasena">
            <label for="contrasena">Contraseña</label>
            <input class="control" id="contrasena" name="contrasena" type="password" autocomplete="current-password" placeholder="Tu contraseña" required>
          </div>
          <button class="btn btn-primario btn-bloque btn-grande" type="submit">Entrar</button>
        </form>
        <p class="centro" style="margin-top:18px">¿No tienes cuenta? <a href="#/registro"><strong>Regístrate</strong></a></p>
      </div>
    </section>`);

  const formulario = $('#form-login');
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(formulario));
    try {
      const respuesta = await conBoton($('button[type=submit]', formulario), () => api.post('/auth/login', datos));
      iniciarSesionUI(respuesta);
    } catch (error) {
      mostrarErrores(formulario, error);
    }
  });
}

const TERMINOS = html`
  <h3>Aviso de privacidad y términos de uso</h3>
  <div class="pila texto-suave texto-chico">
    <p>Rescate de Comida conecta a donantes, receptores y voluntarios para trasladar alimentos aptos para consumo humano
       que de otro modo se desperdiciarían.</p>
    <p><strong>Sin fines de lucro.</strong> Los alimentos donados no pueden venderse, cobrarse ni intercambiarse por dinero.
       El sistema bloquea cualquier publicación o función que implique cobro o comercialización.</p>
    <p><strong>Donación de buena fe.</strong> El donante declara que los alimentos son aptos para el consumo al momento de
       publicarlos. Al hacerlo de buena fe, queda deslindado de responsabilidad por el uso posterior que el receptor haga de ellos.</p>
    <p><strong>Inocuidad.</strong> Antes de confirmar cada recolección se debe completar el checklist de trazabilidad e
       inocuidad (cadena de frío, empaque, estado y fecha vigente).</p>
    <p><strong>Datos personales.</strong> Usamos tu nombre, contacto y ubicación solo para coordinar donaciones. Los documentos
       de verificación solo los consulta el equipo administrador.</p>
  </div>
  <div class="acciones"><button class="btn btn-primario" data-cerrar>Entendido</button></div>`;

export async function vistaRegistro({ contenedor, encabezado, alLimpiar }) {
  encabezado({ titulo: 'Crear cuenta', atras: '/login', alertas: false });
  montar(contenedor, html`
    <form id="form-registro" class="tarjeta formulario-registro" novalidate>
      <div class="campo" data-campo="rol">
        <span class="etiqueta">Tipo de cuenta</span>
        <div class="opciones-rol">
          <label class="opcion-rol"><input type="radio" name="rol" value="DONANTE" checked><strong>Donante</strong>
            <small>Comercio, mercado o productor con excedentes.</small></label>
          <label class="opcion-rol"><input type="radio" name="rol" value="RECEPTOR"><strong>Receptor</strong>
            <small>Casa hogar, comedor u ONG que recibe alimentos.</small></label>
          <label class="opcion-rol"><input type="radio" name="rol" value="VOLUNTARIO"><strong>Voluntario logístico</strong>
            <small>Recoge y entrega lotes en ruta.</small></label>
        </div>
      </div>
      <div class="dos-columnas">
        <div>
          <div class="campo" data-campo="nombre">
            <label for="nombre">Nombre o razón social</label>
            <input class="control" id="nombre" name="nombre" maxlength="150" placeholder="Nombre completo o razón social" required>
          </div>
          <div class="rejilla-2">
            <div class="campo" data-campo="correo">
              <label for="correo">Correo electrónico</label>
              <input class="control" id="correo" name="correo" type="email" maxlength="120" autocomplete="email" placeholder="correo@ejemplo.com" required>
            </div>
            <div class="campo" data-campo="telefono">
              <label for="telefono">Teléfono de contacto</label>
              <input class="control" id="telefono" name="telefono" type="tel" maxlength="20" autocomplete="tel" placeholder="55 1234 5678" required>
            </div>
          </div>
          <div class="rejilla-2">
            <div class="campo" data-campo="contrasena">
              <label for="contrasena">Contraseña</label>
              <input class="control" id="contrasena" name="contrasena" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required>
            </div>
            <div class="campo" data-campo="confirmarContrasena">
              <label for="confirmar">Confirmar contraseña</label>
              <input class="control" id="confirmar" name="confirmarContrasena" type="password" autocomplete="new-password" placeholder="Repite tu contraseña" required>
            </div>
          </div>
          <div class="campo" data-campo="direccion">
            <label for="direccion">Dirección</label>
            <input class="control" id="direccion" name="direccion" maxlength="255" placeholder="Dirección o colonia" required>
          </div>
        </div>
        <div class="campo" data-campo="ubicacion">
          <div class="fila-entre" style="margin-bottom:6px">
            <span class="etiqueta" style="margin:0">Ubicación en el mapa</span>
            <button class="enlace texto-chico" type="button" id="usar-ubicacion">Usar mi ubicación</button>
          </div>
          <div class="mapa" id="mapa-registro"></div>
          <div class="ayuda" id="coordenadas">Haz clic en el mapa para marcar tu punto. Se usa para emparejar lotes cercanos.</div>
        </div>
      </div>
      <div class="pie-formulario">
        <div class="campo" data-campo="aceptaTerminos" style="margin:0">
          <label class="casilla"><input type="checkbox" name="aceptaTerminos" value="true">
            <span>Acepto el <button type="button" class="enlace" id="ver-terminos">aviso de privacidad y los términos de uso</button>.
              Los alimentos donados no pueden venderse.</span></label>
        </div>
        <button class="btn btn-primario btn-grande" type="submit">Crear cuenta</button>
      </div>
      <p class="texto-chico" style="margin:14px 0 0">¿Ya tienes cuenta? <a href="#/login"><strong>Inicia sesión</strong></a></p>
    </form>`);

  const formulario = $('#form-registro');
  const coordenadas = { latitud: null, longitud: null };
  const mostrarCoordenadas = () => {
    $('#coordenadas').textContent = `Punto marcado: ${coordenadas.latitud.toFixed(5)}, ${coordenadas.longitud.toFixed(5)}`;
  };
  const mapa = mapaSelector($('#mapa-registro'), {
    alCambiar: (lat, lng) => {
      coordenadas.latitud = lat;
      coordenadas.longitud = lng;
      mostrarCoordenadas();
    },
  });
  alLimpiar(() => mapa.destruir());

  $('#usar-ubicacion').addEventListener('click', async (e) => {
    try {
      const punto = await conBoton(e.currentTarget, obtenerUbicacion);
      Object.assign(coordenadas, punto);
      mapa.fijar(punto.latitud, punto.longitud);
      mostrarCoordenadas();
    } catch (error) {
      avisarError(error);
    }
  });

  $('#ver-terminos').addEventListener('click', () => {
    const { elemento, cerrar } = abrirModal(String(TERMINOS));
    elemento.querySelector('[data-cerrar]').addEventListener('click', cerrar);
  });

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formulario);
    const datos = Object.fromEntries(new FormData(formulario));
    datos.aceptaTerminos = datos.aceptaTerminos === 'true';
    Object.assign(datos, coordenadas);
    try {
      const respuesta = await conBoton($('button[type=submit]', formulario), () => api.post('/auth/registro', datos));
      avisar('Registro exitoso. ¡Bienvenido!', 'ok');
      iniciarSesionUI(respuesta);
    } catch (error) {
      mostrarErrores(formulario, error);
    }
  });
}
