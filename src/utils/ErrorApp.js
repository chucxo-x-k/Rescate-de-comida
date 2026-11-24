export class ErrorApp extends Error {
  constructor(estado, mensaje, detalles = null) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.estado = estado;
    this.detalles = detalles;
  }

  static solicitudInvalida(mensaje, detalles = null) {
    return new ErrorApp(400, mensaje, detalles);
  }

  static noAutenticado(mensaje = 'Debes iniciar sesión.') {
    return new ErrorApp(401, mensaje);
  }

  static prohibido(mensaje = 'No tienes permiso para realizar esta acción.') {
    return new ErrorApp(403, mensaje);
  }

  static noEncontrado(mensaje = 'Recurso no encontrado.') {
    return new ErrorApp(404, mensaje);
  }

  static conflicto(mensaje) {
    return new ErrorApp(409, mensaje);
  }
}
