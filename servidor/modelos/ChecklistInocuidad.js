import { CRITERIOS_INOCUIDAD } from './enumeraciones.js';

export class ItemChecklist {
  constructor({ criterio, cumple = false, esCritico = true }) {
    this.criterio = criterio;
    this.cumple = Boolean(cumple);
    this.esCritico = Boolean(esCritico);
  }

  toJSON() {
    return { criterio: this.criterio, cumple: this.cumple, esCritico: this.esCritico };
  }
}

export class ChecklistInocuidad {
  constructor({ idChecklist = null, idRuta, temperaturaC = null, items = [], observaciones = null }) {
    this.idChecklist = idChecklist;
    this.idRuta = idRuta;
    this.temperaturaC = temperaturaC === null || temperaturaC === '' ? null : Number(temperaturaC);
    this.items = items;
    this.observaciones = observaciones || null;
  }

  static desdeRespuestas(idRuta, respuestas = {}, temperaturaC = null, observaciones = null) {
    const items = CRITERIOS_INOCUIDAD.map(
      (criterio) => new ItemChecklist({ criterio, cumple: respuestas[criterio] === true || respuestas[criterio] === 'true' }),
    );
    return new ChecklistInocuidad({ idRuta, temperaturaC, items, observaciones });
  }

  get cadenaFrioMantenida() {
    return this.items.find((i) => i.criterio === CRITERIOS_INOCUIDAD[0])?.cumple ?? false;
  }

  get empaqueAdecuado() {
    return this.items.find((i) => i.criterio === CRITERIOS_INOCUIDAD[1])?.cumple ?? false;
  }

  temperaturaValida() {
    return this.temperaturaC === null || (this.temperaturaC >= -50 && this.temperaturaC <= 99.9);
  }

  todosCriticosAprobados() {
    return (
      this.items.length === CRITERIOS_INOCUIDAD.length &&
      this.items.filter((i) => i.esCritico).every((i) => i.cumple) &&
      this.temperaturaValida()
    );
  }

  criteriosIncumplidos() {
    return this.items.filter((i) => i.esCritico && !i.cumple).map((i) => i.criterio);
  }

  toJSON() {
    return {
      idChecklist: this.idChecklist,
      idRuta: this.idRuta,
      temperaturaC: this.temperaturaC,
      aprobado: this.todosCriticosAprobados(),
      observaciones: this.observaciones,
      items: this.items.map((i) => i.toJSON()),
    };
  }
}
