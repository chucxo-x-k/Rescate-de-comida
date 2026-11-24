import { sesion } from './sesionUsuario.js';

class ErrorApi extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles ?? null;
  }
}

function construirUrl(ruta, query) {
  const url = new URL(`/api${ruta}`, location.origin);
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
  }
  return url;
}

async function solicitar(metodo, ruta, { json, form, query, crudo = false } = {}) {
  const headers = {};
  if (sesion.token) headers.Authorization = `Bearer ${sesion.token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  let respuesta;
  try {
    respuesta = await fetch(construirUrl(ruta, query), { method: metodo, headers, body });
  } catch {
    throw new ErrorApi(0, 'Sin conexión con el servidor. Revisa tu internet.');
  }

  if (respuesta.status === 401 && sesion.token) {
    sesion.cerrar();
    window.dispatchEvent(new CustomEvent('sesion-expirada'));
  }

  if (crudo) {
    if (!respuesta.ok) throw new ErrorApi(respuesta.status, 'No se pudo abrir el archivo.');
    return respuesta;
  }

  const esJson = respuesta.headers.get('content-type')?.includes('application/json');
  const datos = esJson ? await respuesta.json() : null;
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos?.error ?? 'Ocurrió un error inesperado.', datos?.detalles);
  }
  return datos;
}

export const api = {
  get: (ruta, query) => solicitar('GET', ruta, { query }),
  post: (ruta, json = {}) => solicitar('POST', ruta, { json }),
  put: (ruta, json = {}) => solicitar('PUT', ruta, { json }),
  patch: (ruta, json = {}) => solicitar('PATCH', ruta, { json }),
  enviarFormulario: (ruta, form) => solicitar('POST', ruta, { form }),
  archivo: async (ruta) => (await solicitar('GET', ruta, { crudo: true })).blob(),
};
