export class Sesion {
  constructor({ token, fechaInicio, fechaExpira, idUsuario, rol }) {
    this.token = token;
    this.fechaInicio = fechaInicio;
    this.fechaExpira = fechaExpira;
    this.idUsuario = idUsuario;
    this.rol = rol;
  }

  static desdePayload(token, payload) {
    return new Sesion({
      token,
      fechaInicio: new Date(payload.iat * 1000),
      fechaExpira: new Date(payload.exp * 1000),
      idUsuario: Number(payload.sub),
      rol: payload.rol,
    });
  }

  estaActiva(ahora = new Date()) {
    return this.fechaExpira.getTime() > ahora.getTime();
  }

  toJSON() {
    return { token: this.token, fechaInicio: this.fechaInicio, fechaExpira: this.fechaExpira };
  }
}
