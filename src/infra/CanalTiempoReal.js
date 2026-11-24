const INTERVALO_LATIDO_MS = 25_000;

export class CanalTiempoReal {
  #conexiones = new Map();
  #latido;

  constructor() {
    this.#latido = setInterval(() => this.#enviarATodos(': latido\n\n'), INTERVALO_LATIDO_MS);
    this.#latido.unref();
  }

  suscribir(idUsuario, req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');

    if (!this.#conexiones.has(idUsuario)) this.#conexiones.set(idUsuario, new Set());
    this.#conexiones.get(idUsuario).add(res);

    req.on('close', () => {
      const conjunto = this.#conexiones.get(idUsuario);
      conjunto?.delete(res);
      if (conjunto?.size === 0) this.#conexiones.delete(idUsuario);
    });
  }

  emitir(idUsuario, evento, datos) {
    const conjunto = this.#conexiones.get(idUsuario);
    if (!conjunto) return false;
    const carga = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
    for (const res of conjunto) res.write(carga);
    return true;
  }

  #enviarATodos(texto) {
    for (const conjunto of this.#conexiones.values()) {
      for (const res of conjunto) res.write(texto);
    }
  }

  cerrar() {
    clearInterval(this.#latido);
    for (const conjunto of this.#conexiones.values()) {
      for (const res of conjunto) res.end();
    }
    this.#conexiones.clear();
  }
}
