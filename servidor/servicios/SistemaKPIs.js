import { IndicadoresKPI } from '../modelos/IndicadoresKPI.js';
import { ultimosDias } from '../utilidades/fechas.js';
import { entero } from '../utilidades/validacion.js';
import { vistaRuta } from './formatoRespuestas.js';

const PERIODOS_VALIDOS = [7, 30, 90, 365];
const DIAS_GRAFICA = 7;

export class SistemaKPIs {
  constructor({ repos }) {
    this.repos = repos;
  }

  async calcular({ dias = 30, idCategoria = null } = {}, usuario = null) {
    const periodo = PERIODOS_VALIDOS.includes(Number(dias)) ? Number(dias) : 30;
    const categoria = entero(idCategoria);
    const filtro = { dias: periodo, idCategoria: categoria };

    const [kgPorRacion, umbralHoras, totales, serie, activas] = await Promise.all([
      this.repos.configuracion.obtenerNumero('kg_por_racion', 0.4),
      this.repos.configuracion.obtenerNumero('umbral_caducidad_horas', 6),
      this.repos.rutas.indicadores(filtro),
      this.repos.rutas.kgPorDia({ dias: DIAS_GRAFICA, idCategoria: categoria }),
      this.repos.rutas.rutasActivas({ idCategoria: categoria }),
    ]);

    const kgPorDia = ultimosDias(DIAS_GRAFICA).map(({ dia, etiqueta }) => ({
      dia,
      etiqueta,
      kg: Number(serie.find((s) => s.dia === dia)?.kg ?? 0),
    }));

    return new IndicadoresKPI({
      kgRescatados: totales.kg_rescatados,
      racionesEstimadas: IndicadoresKPI.calcularRaciones(totales.kg_rescatados, kgPorRacion),
      vencidosEvitados: totales.vencidos_evitados,
      tiempoMedioTrasladoMin: totales.traslado_medio_min,
      kgPorDia,
      rutasActivas: activas.map((f) => vistaRuta(f, { usuario, umbralHoras })),
      periodoDias: periodo,
    });
  }
}
