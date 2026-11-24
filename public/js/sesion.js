const CLAVE = 'rescate-comida-sesion';

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) ?? null;
  } catch {
    return null;
  }
}

function escribir(valor) {
  try {
    if (valor) localStorage.setItem(CLAVE, JSON.stringify(valor));
    else localStorage.removeItem(CLAVE);
  } catch {}
}

let actual = leer();
if (actual?.expira && new Date(actual.expira) <= new Date()) {
  actual = null;
  escribir(null);
}

export const sesion = {
  get token() { return actual?.token ?? null; },
  get usuario() { return actual?.usuario ?? null; },
  get activa() { return Boolean(actual?.token); },

  iniciar({ token, expira, usuario }) {
    actual = { token, expira, usuario };
    escribir(actual);
  },

  actualizarUsuario(usuario) {
    if (!actual) return;
    actual = { ...actual, usuario };
    escribir(actual);
  },

  cerrar() {
    actual = null;
    escribir(null);
  },
};
