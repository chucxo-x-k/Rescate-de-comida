// Lienzo de firma digital del receptor (CU 9).
export function crearFirma(lienzo) {
  const contexto = lienzo.getContext('2d');
  let dibujando = false;
  let trazos = 0;

  const ajustarTamano = () => {
    const escala = window.devicePixelRatio || 1;
    const { width, height } = lienzo.getBoundingClientRect();
    lienzo.width = Math.round(width * escala);
    lienzo.height = Math.round(height * escala);
    contexto.setTransform(escala, 0, 0, escala, 0, 0);
    contexto.lineWidth = 2.4;
    contexto.lineCap = 'round';
    contexto.lineJoin = 'round';
    contexto.strokeStyle = '#1d1c1a';
    trazos = 0;
  };

  const punto = (e) => {
    const r = lienzo.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  lienzo.addEventListener('pointerdown', (e) => {
    dibujando = true;
    lienzo.setPointerCapture(e.pointerId);
    const p = punto(e);
    contexto.beginPath();
    contexto.moveTo(p.x, p.y);
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!dibujando) return;
    const p = punto(e);
    contexto.lineTo(p.x, p.y);
    contexto.stroke();
    trazos += 1;
  });
  const terminar = () => { dibujando = false; };
  lienzo.addEventListener('pointerup', terminar);
  lienzo.addEventListener('pointercancel', terminar);

  ajustarTamano();

  return {
    vacia: () => trazos < 5,
    limpiar: ajustarTamano,
    aBlob: () => new Promise((r) => lienzo.toBlob(r, 'image/png')),
  };
}
