const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

class HtmlSeguro {
  constructor(texto) { this.texto = texto; }
  toString() { return this.texto; }
}

function convertir(valor) {
  if (valor instanceof HtmlSeguro) return valor.texto;
  if (Array.isArray(valor)) return valor.map(convertir).join('');
  if (valor === null || valor === undefined || valor === false) return '';
  return escapar(valor);
}

export function html(partes, ...valores) {
  let salida = '';
  partes.forEach((parte, i) => {
    salida += parte;
    if (i < valores.length) salida += convertir(valores[i]);
  });
  return new HtmlSeguro(salida);
}

export function montar(elemento, contenido) {
  elemento.innerHTML = convertir(contenido);
}

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

export function avisar(mensaje, tipo = 'info', duracionMs = 4000) {
  const contenedor = document.getElementById('avisos');
  const nodo = document.createElement('div');
  nodo.className = `aviso ${tipo}`;
  nodo.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  nodo.textContent = mensaje;
  contenedor.append(nodo);
  while (contenedor.children.length > 3) contenedor.firstElementChild.remove();
  setTimeout(() => nodo.remove(), duracionMs);
}

export function avisarError(error) {
  avisar(error?.message ?? 'Ocurrió un error inesperado.', 'error', 5000);
}

export function abrirModal(contenido, { alCerrar } = {}) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${contenido}</div>`;
  const cerrar = () => {
    fondo.remove();
    document.removeEventListener('keydown', porTecla);
    alCerrar?.();
  };
  const porTecla = (e) => { if (e.key === 'Escape') cerrar(); };
  fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
  document.addEventListener('keydown', porTecla);
  document.body.append(fondo);
  return { elemento: fondo.firstElementChild, cerrar };
}

export function confirmar(titulo, mensaje, { textoAceptar = 'Aceptar', peligro = false } = {}) {
  return new Promise((resolver) => {
    let respondido = false;
    const { elemento, cerrar } = abrirModal(
      String(html`
        <h3>${titulo}</h3>
        <p class="texto-suave">${mensaje}</p>
        <div class="acciones">
          <button class="btn" data-r="no">Cancelar</button>
          <button class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" data-r="si">${textoAceptar}</button>
        </div>`),
      { alCerrar: () => { if (!respondido) resolver(false); } },
    );
    elemento.addEventListener('click', (e) => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (!r) return;
      respondido = true;
      resolver(r === 'si');
      cerrar();
    });
  });
}

export function limpiarErrores(formulario) {
  $$('.error-campo', formulario).forEach((n) => n.remove());
  $$('.invalido', formulario).forEach((n) => n.classList.remove('invalido'));
  $('.mensaje-error', formulario)?.remove();
}

export function mostrarErrores(formulario, error) {
  limpiarErrores(formulario);
  const detalles = error?.detalles ?? {};
  const sinUbicar = [];
  for (const [campo, mensaje] of Object.entries(detalles)) {
    const contenedor = formulario.querySelector(`[data-campo="${campo}"]`);
    if (!contenedor) {
      sinUbicar.push(mensaje);
      continue;
    }
    contenedor.querySelector('.control')?.classList.add('invalido');
    const nodo = document.createElement('div');
    nodo.className = 'error-campo';
    nodo.textContent = mensaje;
    contenedor.append(nodo);
  }
  const general = document.createElement('div');
  general.className = 'mensaje-error';
  general.setAttribute('role', 'alert');
  general.textContent = [error?.message, ...sinUbicar].filter(Boolean).join(' ');
  formulario.prepend(general);
  general.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export async function conBoton(boton, tarea) {
  const texto = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Procesando…';
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
    boton.textContent = texto;
  }
}

async function comprimirImagen(archivo, ladoMaximo = 1600) {
  if (!archivo.type.startsWith('image/') || typeof createImageBitmap !== 'function') return archivo;
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
    if (escala === 1 && archivo.size < 1.5 * 1024 * 1024) return archivo;
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], archivo.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : archivo;
  } catch {
    return archivo;
  }
}

export function selectorFotos(contenedor, { maximo = 6 } = {}) {
  const fotos = [];
  montar(contenedor, html`
    <label class="zona-subida">
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple>
      <span>Toca para subir o tomar fotos<br><small class="texto-suave">Máximo ${maximo} · JPG, PNG o WEBP</small></span>
    </label>
    <div class="fotos-previas"></div>`);
  const entrada = $('input', contenedor);
  const previas = $('.fotos-previas', contenedor);

  const pintar = () => {
    previas.innerHTML = '';
    fotos.forEach((foto, i) => {
      const caja = document.createElement('div');
      caja.className = 'foto-previa';
      const img = document.createElement('img');
      img.src = foto.url;
      img.alt = `Foto ${i + 1}`;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.setAttribute('aria-label', `Quitar foto ${i + 1}`);
      quitar.textContent = '×';
      quitar.addEventListener('click', () => {
        URL.revokeObjectURL(foto.url);
        fotos.splice(i, 1);
        pintar();
      });
      caja.append(img, quitar);
      previas.append(caja);
    });
  };

  entrada.addEventListener('change', async () => {
    for (const archivo of [...entrada.files]) {
      if (fotos.length >= maximo) {
        avisar(`Máximo ${maximo} fotos.`, 'error');
        break;
      }
      const comprimido = await comprimirImagen(archivo);
      fotos.push({ archivo: comprimido, url: URL.createObjectURL(comprimido) });
    }
    entrada.value = '';
    pintar();
  });

  return { archivos: () => fotos.map((f) => f.archivo) };
}

const ETIQUETA_LOTE = {
  PUBLICADO: 'Disponible',
  EN_RECOLECCION: 'En recolección',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  CADUCADO: 'Caducado',
};
const ETIQUETA_RUTA = {
  DISPONIBLE: 'Esperando voluntario',
  EN_RECOLECCION: 'En recolección',
  EN_CAMINO: 'En camino',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada',
};
export const ETIQUETA_ROL = {
  DONANTE: 'Donante',
  RECEPTOR: 'Receptor',
  VOLUNTARIO: 'Voluntario',
  ADMINISTRADOR: 'Administrador',
};
const ETIQUETA_VERIFICACION = {
  NO_VERIFICADO: 'Sin verificar',
  EN_REVISION: 'En revisión',
  VERIFICADO: 'Verificado',
  RECHAZADO: 'Rechazado',
};

const VARIANTE = {
  PUBLICADO: '', EN_RECOLECCION: 'info', ENTREGADO: 'ok', CANCELADO: 'apagado', CADUCADO: 'peligro',
  DISPONIBLE: 'aviso', EN_CAMINO: 'info', ENTREGADA: 'ok', CANCELADA: 'apagado',
  NO_VERIFICADO: 'apagado', EN_REVISION: 'aviso', VERIFICADO: 'ok', RECHAZADO: 'peligro',
};

export const chip = (texto, variante = '') => html`<span class="chip ${variante ? `chip-${variante}` : ''}">${texto}</span>`;
export const chipLote = (estado) => chip(ETIQUETA_LOTE[estado] ?? estado, VARIANTE[estado]);
export const chipRuta = (estado) => chip(ETIQUETA_RUTA[estado] ?? estado, VARIANTE[estado]);
export const chipVerificacion = (estado) => chip(ETIQUETA_VERIFICACION[estado] ?? estado, VARIANTE[estado]);

export function kg(valor) {
  const n = Number(valor ?? 0);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} kg`;
}

export function km(valor) {
  return valor === null || valor === undefined ? '' : `${Number(valor).toFixed(1)} km`;
}

export function fechaCorta(fecha) {
  if (!fecha) return '';
  const [a, m, d] = fecha.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export const horaCorta = (hora) => (hora ? hora.slice(0, 5) : '');

export const fechaIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function textoCaducidad(fecha, hora) {
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const sufijo = hora ? `, ${horaCorta(hora)}` : '';
  if (fecha === fechaIso(hoy)) return `Caduca hoy${sufijo}`;
  if (fecha === fechaIso(manana)) return `Caduca mañana${sufijo}`;
  return `Caduca ${fechaCorta(fecha)}${sufijo}`;
}

export function textoRestante(horas) {
  if (horas === null || horas === undefined) return '';
  if (horas <= 0) return 'Caducado';
  if (horas < 1) return `Caduca en ${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `Caduca en ${Math.round(horas)} h`;
  return `Caduca en ${Math.round(horas / 24)} días`;
}

export function hace(fechaTexto) {
  if (!fechaTexto) return '';
  const fecha = new Date(fechaTexto.replace(' ', 'T'));
  const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  if (horas < 48) return 'Ayer';
  return fechaCorta(fechaTexto);
}

export function enlaceMaps(latitud, longitud) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitud},${longitud}`;
}

export const vacio = (texto) => html`<div class="vacio">${texto}</div>`;

const trazo = (d) =>
  new HtmlSeguro(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);

export const ICONOS = {
  panel: trazo('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  publicar: trazo('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  lotes: trazo('<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/>'),
  perfil: trazo('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  recepciones: trazo('<path d="M3 13h4l2 3h6l2-3h4"/><path d="M5 13V5h14v8"/>'),
  alertas: trazo('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  rutas: trazo('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 17V9a4 4 0 0 1 4-4h6M18 7v8a4 4 0 0 1-4 4H8"/>'),
  ruta: trazo('<path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
  verificar: trazo('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  usuarios: trazo('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6 0 4.6 1.6 5.4 4.4"/>'),
};
