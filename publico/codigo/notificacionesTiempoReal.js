let fuente = null;
const oyentes = new Set();

function emitir(tipo, datos) {
  for (const oyente of oyentes) oyente(tipo, datos);
}

export function conectar(token) {
  desconectar();
  if (!token || typeof EventSource === 'undefined') return;
  fuente = new EventSource(`/api/notificaciones/stream?token=${encodeURIComponent(token)}`);
  fuente.addEventListener('conteo', (e) => emitir('conteo', JSON.parse(e.data)));
  fuente.addEventListener('notificacion', (e) => emitir('notificacion', JSON.parse(e.data)));
}

export function desconectar() {
  fuente?.close();
  fuente = null;
}

export function escuchar(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}
