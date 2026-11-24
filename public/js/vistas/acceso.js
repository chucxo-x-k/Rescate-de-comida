import { api } from '../api.js';
import { iniciarSesionUI } from '../app.js';
import { mapaSelector, obtenerUbicacion } from '../mapa.js';
import { $, abrirModal, avisar, avisarError, conBoton, html, limpiarErrores, montar, mostrarErrores } from '../ui.js';

// CU 2: Iniciar sesión.
export async function vistaLogin({ contenedor }) {
  montar(contenedor, html`
    <section class="acceso">
      <div class="marca"><img src="/img/logo.svg" alt=""><strong>Rescate de Comida</strong></div>
      <h2>Iniciar sesión</h2>
      <p class="subtitulo">Accede a tu panel de donante, receptor o voluntario.</p>
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
  <button class="btn btn-primario btn-bloque" data-cerrar style="margin-top:16px">Entendido</button>`;

// CU 1: Registrarse en el sistema.
export async function vistaRegistro({ contenedor, encabezado, alLimpiar }) {
  encabezado({ titulo: 'Crear cuenta', atras: '/login', alertas: false });
  montar(contenedor, html`
    <form id="form-registro" novalidate>
      <div class="campo" data-campo="rol">
        <span class="etiqueta">Tipo de cuenta</span>
        <label class="opcion-rol"><input type="radio" name="rol" value="DONANTE" checked><strong>Donante</strong>
          <small>Comercio, mercado o productor con excedentes.</small></label>
        <label class="opcion-rol"><input type="radio" name="rol" value="RECEPTOR"><strong>Receptor</strong>
          <small>Casa hogar, comedor u ONG que recibe alimentos.</small></label>
        <label class="opcion-rol"><input type="radio" name="rol" value="VOLUNTARIO"><strong>Voluntario logístico</strong>
          <small>Recoge y entrega lotes en ruta.</small></label>
      </div>
      <div class="campo" data-campo="nombre">
        <label for="nombre">Nombre o razón social</label>
        <input class="control" id="nombre" name="nombre" maxlength="150" placeholder="Nombre completo o razón social" required>
      </div>
      <div class="campo" data-campo="correo">
        <label for="correo">Correo electrónico</label>
        <input class="control" id="correo" name="correo" type="email" maxlength="120" autocomplete="email" placeholder="correo@ejemplo.com" required>
      </div>
      <div class="campo" data-campo="telefono">
        <label for="telefono">Teléfono de contacto</label>
        <input class="control" id="telefono" name="telefono" type="tel" maxlength="20" autocomplete="tel" placeholder="55 1234 5678" required>
      </div>
      <div class="campo" data-campo="contrasena">
        <label for="contrasena">Contraseña</label>
        <input class="control" id="contrasena" name="contrasena" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required>
      </div>
      <div class="campo" data-campo="confirmarContrasena">
        <label for="confirmar">Confirmar contraseña</label>
        <input class="control" id="confirmar" name="confirmarContrasena" type="password" autocomplete="new-password" placeholder="Repite tu contraseña" required>
      </div>
      <div class="campo" data-campo="direccion">
        <label for="direccion">Ubicación</label>
        <input class="control" id="direccion" name="direccion" maxlength="255" placeholder="Dirección o colonia" required>
      </div>
      <div class="campo" data-campo="ubicacion">
        <button class="btn btn-bloque" type="button" id="usar-ubicacion">Usar mi ubicación</button>
        <div class="mapa" id="mapa-registro" style="margin-top:10px"></div>
        <div class="ayuda" id="coordenadas">Toca el mapa para marcar tu punto. Se usa para emparejar lotes cercanos.</div>
      </div>
      <div class="campo" data-campo="aceptaTerminos">
        <label class="casilla"><input type="checkbox" name="aceptaTerminos" value="true">
          <span>Acepto el <button type="button" class="enlace" id="ver-terminos">aviso de privacidad y los términos de uso</button>.
            Los alimentos donados no pueden venderse.</span></label>
      </div>
      <button class="btn btn-primario btn-bloque btn-grande" type="submit">Crear cuenta</button>
      <p class="centro texto-chico" style="margin-top:14px">¿Ya tienes cuenta? <a href="#/login"><strong>Inicia sesión</strong></a></p>
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
