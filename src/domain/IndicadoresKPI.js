export class IndicadoresKPI {
  constructor({
    kgRescatados = 0,
    racionesEstimadas = 0,
    vencidosEvitados = 0,
    tiempoMedioTrasladoMin = 0,
    kgPorDia = [],
    rutasActivas = [],
    periodoDias = 30,
  } = {}) {
    this.kgRescatados = Number(kgRescatados);
    this.racionesEstimadas = Number(racionesEstimadas);
    this.vencidosEvitados = Number(vencidosEvitados);
    this.tiempoMedioTrasladoMin = Number(tiempoMedioTrasladoMin);
    this.kgPorDia = kgPorDia;
    this.rutasActivas = rutasActivas;
    this.periodoDias = periodoDias;
  }

  /** Raciones = kg rescatados / kg por ración (parámetro kg_por_racion). */
  static calcularRaciones(kgRescatados, kgPorRacion) {
    if (!(kgPorRacion > 0)) return 0;
    return Math.floor(Number(kgRescatados) / kgPorRacion);
  }

  toJSON() {
    return {
      kgRescatados: Math.round(this.kgRescatados * 100) / 100,
      racionesEstimadas: this.racionesEstimadas,
      vencidosEvitados: this.vencidosEvitados,
      tiempoMedioTrasladoMin: Math.round(this.tiempoMedioTrasladoMin),
      kgPorDia: this.kgPorDia,
      rutasActivas: this.rutasActivas,
      periodoDias: this.periodoDias,
    };
  }
}
