import { ErrorApp } from './ErrorAplicacion.js';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_TELEFONO = /^[0-9+\-\s()]{8,20}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

export const esCorreo = (valor) => REGEX_CORREO.test(texto(valor));
export const esTelefono = (valor) => REGEX_TELEFONO.test(texto(valor));
export const esHora = (valor) => REGEX_HORA.test(texto(valor));

export const aBooleano = (valor) => valor === true || valor === 1 || valor === '1' || valor === 'true' || valor === 'on';

export function aNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function normalizarHora(valor) {
  const t = texto(valor);
  if (!t) return null;
  return t.length === 5 ? `${t}:00` : t;
}

export function entero(valor, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export function exigir(errores) {
  const lista = Object.entries(errores).filter(([, msg]) => Boolean(msg));
  if (lista.length > 0) {
    throw ErrorApp.solicitudInvalida('Revisa los datos enviados.', Object.fromEntries(lista));
  }
}

export function idDeRuta(valor) {
  const id = entero(valor);
  if (!id) throw ErrorApp.solicitudInvalida('Identificador inválido.');
  return id;
}
