const MS_POR_MINUTO = 60_000;

export class SistemaDeTiempo {
  #temporizador = null;
  #ejecutando = false;

  constructor({ repos, moduloAlertas, registrador = console }) {
    this.repos = repos;
    this.moduloAlertas = moduloAlertas;
    this.registrador = registrador;
    this.intervaloMin = 5;
  }

  async ejecutarAhora() {
    if (this.#ejecutando) return null;
    this.#ejecutando = true;
    try {
      return await this.moduloAlertas.verificarCaducidades();
    } catch (error) {
      this.registrador.error('[SistemaDeTiempo] Error al verificar caducidades:', error.message);
      return null;
    } finally {
      this.#ejecutando = false;
    }
  }

  async activarTareaProgramada() {
    this.intervaloMin = await this.repos.configuracion.obtenerNumero('intervalo_alertas_min', 5);
    const intervaloMs = Math.max(1, this.intervaloMin) * MS_POR_MINUTO;
    await this.ejecutarAhora();
    this.#temporizador = setInterval(() => this.ejecutarAhora(), intervaloMs);
    this.#temporizador.unref();
    this.registrador.info(`[SistemaDeTiempo] Verificación de caducidades cada ${this.intervaloMin} min.`);
  }

  detener() {
    if (this.#temporizador) clearInterval(this.#temporizador);
    this.#temporizador = null;
  }
}
