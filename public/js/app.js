import { api } from './api.js';
import { sesion } from './sesion.js';
import { conectar, desconectar, escuchar } from './tiempoReal.js';
import { $, ICONOS, avisar, html, montar } from './ui.js';
import { vistaLogin, vistaRegistro } from './vistas/acceso.js';
import { vistaPanelDonante, vistaPublicarLote, vistaMisLotes } from './vistas/donante.js';
import { vistaDetalleLote } from './vistas/lote.js';
import { vistaLotesCercanos, vistaRecepciones } from './vistas/receptor.js';
import { vistaPanelKpis, vistaRutasDisponibles, vistaMiRuta } from './vistas/voluntario.js';
import { vistaAlertas } from './vistas/alertas.js';
import { vistaPerfil } from './vistas/perfil.js';
import { vistaVerificacion } from './vistas/verificacion.js';
import { vistaVerificacionesPendientes, vistaUsuarios, vistaLotesAdmin } from './vistas/admin.js';

const INICIO_POR_ROL = {
  DONANTE: '/donante',
  RECEPTOR: '/receptor',
  VOLUNTARIO: '/voluntario',
  ADMINISTRADOR: '/admin',
};

const NAVEGACION = {
  DONANTE: [
    ['panel', 'Panel', '/donante'],
    ['publicar', 'Publicar', '/donante/publicar'],
    ['lotes', 'Mis lotes', '/donante/lotes'],
    ['perfil', 'Perfil', '/perfil'],
  ],
  RECEPTOR: [
    ['lotes', 'Lotes', '/receptor'],
    ['recepciones', 'Recepciones', '/receptor/recepciones'],
    ['alertas', 'Alertas', '/alertas'],
    ['perfil', 'Perfil', '/perfil'],
  ],
  VOLUNTARIO: [
    ['panel', 'Panel', '/voluntario'],
    ['rutas', 'Rutas', '/voluntario/rutas'],
    ['ruta', 'Mi ruta', '/voluntario/ruta'],
    ['perfil', 'Perfil', '/perfil'],
  ],
  ADMINISTRADOR: [
    ['verificar', 'Verificar', '/admin'],
    ['usuarios', 'Usuarios', '/admin/usuarios'],
    ['lotes', 'Lotes', '/admin/lotes'],
  ],
};

const RUTAS = [
  { patron: /^\/login$/, vista: vistaLogin, publica: true },
  { patron: /^\/registro$/, vista: vistaRegistro, publica: true },
  { patron: /^\/donante$/, vista: vistaPanelDonante, roles: ['DONANTE'], pestana: 'panel' },
  { patron: /^\/donante\/publicar$/, vista: vistaPublicarLote, roles: ['DONANTE'], pestana: 'publicar' },
  { patron: /^\/donante\/lotes$/, vista: vistaMisLotes, roles: ['DONANTE'], pestana: 'lotes' },
  { patron: /^\/receptor$/, vista: vistaLotesCercanos, roles: ['RECEPTOR'], pestana: 'lotes' },
  { patron: /^\/receptor\/recepciones$/, vista: vistaRecepciones, roles: ['RECEPTOR'], pestana: 'recepciones' },
  { patron: /^\/voluntario$/, vista: vistaPanelKpis, roles: ['VOLUNTARIO'], pestana: 'panel' },
  { patron: /^\/voluntario\/rutas$/, vista: vistaRutasDisponibles, roles: ['VOLUNTARIO'], pestana: 'rutas' },
  { patron: /^\/voluntario\/ruta$/, vista: vistaMiRuta, roles: ['VOLUNTARIO'], pestana: 'ruta' },
  { patron: /^\/admin$/, vista: vistaVerificacionesPendientes, roles: ['ADMINISTRADOR'], pestana: 'verificar' },
  { patron: /^\/admin\/usuarios$/, vista: vistaUsuarios, roles: ['ADMINISTRADOR'], pestana: 'usuarios' },
  { patron: /^\/admin\/lotes$/, vista: vistaLotesAdmin, roles: ['ADMINISTRADOR'], pestana: 'lotes' },
  { patron: /^\/alertas$/, vista: vistaAlertas, pestana: 'alertas' },
  { patron: /^\/perfil$/, vista: vistaPerfil, pestana: 'perfil' },
  { patron: /^\/verificacion$/, vista: vistaVerificacion, roles: ['DONANTE', 'RECEPTOR'], pestana: 'perfil' },
  { patron: /^\/lote\/(\d+)$/, vista: vistaDetalleLote, pestana: null },
];

const barra = $('#barra');
const contenido = $('#contenido');
const navegacion = $('#navegacion');
let limpiezas = [];
let noLeidas = 0;
let rutaActual = '';

function ir(ruta) {
  if (location.hash === `#${ruta}`) enrutar();
  else location.hash = `#${ruta}`;
}

function pintarInsignia() {
  const insignia = $('#insignia-alertas');
  if (!insignia) return;
  insignia.hidden = noLeidas === 0;
  insignia.textContent = noLeidas > 99 ? '99+' : String(noLeidas);
}

function fijarNoLeidas(total) {
  noLeidas = Math.max(0, Number(total) || 0);
  pintarInsignia();
}

function encabezado({ titulo = 'Rescate de Comida', atras = null, alertas = true } = {}) {
  barra.hidden = false;
  montar(barra, html`
    ${atras ? html`<button class="atras" type="button" aria-label="Regresar">←</button>` : ''}
    <h1>${titulo}</h1>
    ${alertas && sesion.activa
      ? html`<a class="btn-alertas" href="#/alertas">Alertas<span id="insignia-alertas" class="insignia" hidden></span></a>`
      : ''}`);
  if (atras) {
    $('.atras', barra).addEventListener('click', () => {
      if (atras === true) history.back();
      else ir(atras);
    });
  }
  pintarInsignia();
}

function pintarNavegacion(rol, pestana) {
  const opciones = NAVEGACION[rol];
  if (!opciones || pestana === undefined) {
    navegacion.hidden = true;
    return;
  }
  navegacion.hidden = false;
  montar(navegacion, opciones.map(([clave, texto, ruta]) => html`
    <a href="#${ruta}" class="${clave === pestana ? 'activo' : ''}" aria-current="${clave === pestana ? 'page' : 'false'}">
      ${ICONOS[clave] ?? ICONOS.panel}<span>${texto}</span>
    </a>`));
}

async function refrescarUsuario() {
  const { usuario } = await api.get('/auth/yo');
  sesion.actualizarUsuario(usuario);
  return usuario;
}

async function enrutar() {
  const ruta = location.hash.replace(/^#/, '') || '/';
  rutaActual = ruta;
  limpiezas.forEach((fn) => fn());
  limpiezas = [];

  const definicion = RUTAS.find((r) => r.patron.test(ruta));
  if (!definicion) {
    ir(sesion.activa ? INICIO_POR_ROL[sesion.usuario.rol] : '/login');
    return;
  }
  if (!definicion.publica && !sesion.activa) {
    ir('/login');
    return;
  }
  if ((definicion.publica && sesion.activa) || (definicion.roles && !definicion.roles.includes(sesion.usuario.rol))) {
    ir(INICIO_POR_ROL[sesion.usuario.rol]);
    return;
  }

  const params = definicion.patron.exec(ruta).slice(1);
  barra.hidden = true;
  if (definicion.publica) navegacion.hidden = true;
  else pintarNavegacion(sesion.usuario.rol, definicion.pestana);
  contenido.innerHTML = '<div class="cargando">Cargando…</div>';
  window.scrollTo(0, 0);

  const contexto = {
    contenedor: contenido,
    params,
    get usuario() { return sesion.usuario; },
    encabezado,
    ir,
    refrescarUsuario,
    fijarNoLeidas,
    alLimpiar: (fn) => limpiezas.push(fn),
    sigueActiva: () => rutaActual === ruta,
  };

  try {
    await definicion.vista(contexto);
  } catch (error) {
    if (rutaActual !== ruta || !sesion.activa) return;
    montar(contenido, html`<div class="mensaje-error">${error.message ?? 'No se pudo cargar la pantalla.'}</div>
      <button class="btn btn-bloque" id="reintentar">Reintentar</button>`);
    $('#reintentar').addEventListener('click', enrutar);
  }
}

let dejarDeEscuchar = null;

export function iniciarSesionUI({ token, expira, usuario }) {
  sesion.iniciar({ token, expira, usuario });
  activarTiempoReal();
  ir(INICIO_POR_ROL[usuario.rol]);
}

export function cerrarSesionUI() {
  sesion.cerrar();
  desconectar();
  dejarDeEscuchar?.();
  dejarDeEscuchar = null;
  fijarNoLeidas(0);
  ir('/login');
}

function activarTiempoReal() {
  conectar(sesion.token);
  dejarDeEscuchar?.();
  dejarDeEscuchar = escuchar((tipo, datos) => {
    if (tipo === 'conteo') fijarNoLeidas(datos.noLeidas);
    if (tipo === 'notificacion') {
      fijarNoLeidas(datos.noLeidas);
      if (!rutaActual.startsWith('/alertas')) avisar(datos.notificacion.mensaje, 'info', 6000);
    }
  });
}

window.addEventListener('sesion-expirada', () => {
  desconectar();
  avisar('Tu sesión expiró. Inicia sesión de nuevo.', 'error');
  ir('/login');
});

window.addEventListener('hashchange', enrutar);

if (sesion.activa) {
  activarTiempoReal();
  refrescarUsuario().catch(() => {});
}
enrutar();
