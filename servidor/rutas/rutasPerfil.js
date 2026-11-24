import { Router } from 'express';
import { requiereRol } from '../intermediarios/autenticacion.js';
import { RolUsuario } from '../modelos/enumeraciones.js';

export function rutasPerfil(c, { autenticar }) {
  const router = Router();
  router.use(autenticar);

  router.get('/', async (req, res) => {
    res.json({ usuario: await c.perfil.obtenerPerfil(req.usuario.idUsuario) });
  });

  router.put('/', async (req, res) => {
    res.json({ usuario: await c.perfil.guardarCambios(req.usuario.idUsuario, req.body ?? {}) });
  });

  router.get('/historial', async (req, res) => {
    res.json({ historial: await c.perfil.consultarHistorial(req.usuario.idUsuario, { dias: req.query.dias }) });
  });

  router.put('/disponibilidad', requiereRol(RolUsuario.RECEPTOR), async (req, res) => {
    res.json({ usuario: await c.perfil.actualizarDisponibilidad(req.usuario, req.body ?? {}) });
  });

  return router;
}
