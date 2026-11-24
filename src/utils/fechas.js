const dos = (n) => String(n).padStart(2, '0');

export const fechaLocal = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;

export const horaLocal = (fecha = new Date()) =>
  `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;

export const fechaHoraLocal = (fecha = new Date()) => `${fechaLocal(fecha)} ${horaLocal(fecha)}`;

const INICIALES_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function ultimosDias(dias, hoy = new Date()) {
  const lista = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    lista.push({ dia: fechaLocal(fecha), etiqueta: INICIALES_DIA[fecha.getDay()] });
  }
  return lista;
}
