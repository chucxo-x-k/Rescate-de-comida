import { ErrorApp } from '../utilidades/ErrorAplicacion.js';

export function crearMiddlewareAuth(servicioAutenticacion) {
  async function cargarUsuario(req, token) {
    if (!token) throw ErrorApp.noAutenticado();
    const sesion = servicioAutenticacion.verificarToken(token);
    req.sesion = sesion;
    req.usuario = await servicioAutenticacion.usuarioDeSesion(sesion);
  }

  async function autenticar(req, _res, next) {
    const cabecera = req.get('authorization') ?? '';
    await cargarUsuario(req, cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null);
    next();
  }

  async function autenticarStream(req, _res, next) {
    await cargarUsuario(req, typeof req.query.token === 'string' ? req.query.token : null);
    next();
  }

  return { autenticar, autenticarStream };
}

export const requiereRol = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.usuario?.rol)) throw ErrorApp.prohibido();
  next();
};
