import { ErrorApp } from '../utilidades/ErrorAplicacion.js';

const CLAVES_PROHIBIDAS = /^(precio|costo|cobro|pago|tarifa|venta|monto|importe|cuota)/i;
const PATRONES_PROHIBIDOS = [
  /\$\s*\d/,
  /\b\d+(?:[.,]\d+)?\s*(?:pesos|mxn|usd|d[oó]lares)\b/i,
  /\b(?:se vende|vendo|vendemos|a la venta|en venta|precio|cobro|cobramos|cobrar|cuota de recuperaci[oó]n)\b/i,
];
const CLAVES_EXCLUIDAS = /contrasena|password|token|firma/i;
const RUTAS_COMERCIALES = /\/(pagos?|cobros?|ventas?|checkout|precios?)(\/|$)/i;

export function contieneComercializacion(valor, clave = '') {
  if (CLAVES_EXCLUIDAS.test(clave)) return null;
  if (clave && CLAVES_PROHIBIDAS.test(clave)) return `Campo no permitido: ${clave}`;
  if (typeof valor === 'string') {
    if (valor.startsWith('data:')) return null;
    return PATRONES_PROHIBIDOS.some((p) => p.test(valor)) ? `El texto de "${clave}" menciona precio o venta.` : null;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const problema = contieneComercializacion(item, clave);
      if (problema) return problema;
    }
    return null;
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      const problema = contieneComercializacion(v, k);
      if (problema) return problema;
    }
  }
  return null;
}

export function bloquearComercializacion(req, _res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && typeof req.body === 'object') {
    const problema = contieneComercializacion(req.body);
    if (problema) {
      throw new ErrorApp(422, 'Los alimentos donados no pueden venderse ni cobrarse.', { comercializacion: problema });
    }
  }
  next();
}

export function bloquearRutasComerciales(req, _res, next) {
  if (RUTAS_COMERCIALES.test(req.path)) {
    throw ErrorApp.prohibido('Rescate de Comida no permite cobros ni ventas de alimentos donados.');
  }
  next();
}
