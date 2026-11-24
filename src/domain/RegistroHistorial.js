const DESCRIPCIONES = Object.freeze({
  EN_RECOLECCION: 'En recolección',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
});

export class RegistroHistorial {
  constructor(fila) {
    this.idHistorial = fila.id_historial;
    this.fecha = fila.fecha_evento;
    this.tipoActividad = fila.estado;
    this.idLote = fila.id_lote;
    this.nombreLote = fila.nombre_lote ?? null;
    this.pesoKg = fila.peso_kg === undefined ? null : Number(fila.peso_kg);
    this.contraparte = fila.contraparte ?? null;
  }

  get descripcion() {
    return `${this.nombreLote ?? 'Lote'} · ${DESCRIPCIONES[this.tipoActividad] ?? this.tipoActividad}`;
  }

  toJSON() {
    return {
      idHistorial: this.idHistorial,
      fecha: this.fecha,
      tipoActividad: this.tipoActividad,
      descripcion: this.descripcion,
      idLote: this.idLote,
      nombreLote: this.nombreLote,
      pesoKg: this.pesoKg,
      contraparte: this.contraparte,
    };
  }
}
