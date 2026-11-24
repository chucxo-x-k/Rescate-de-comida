import { Router } from 'express';
import { idDeRuta } from '../utils/validacion.js';

export function rutasNotificaciones(c, { autenticar, autenticarStream }) {
  const router = Router();

  // Canal en tiempo real (SSE). Va antes del middleware de cabecera Authorization.
  router.get('/stream', autenticarStream, async (req, res) => {
    c.canal.suscribir(req.usuario.idUsuario, req, res);
    const noLeidas = await c.notificador.contarNoLeidas(req.usuario.idUsuario);
    res.write(`event: conteo\ndata: ${JSON.stringify({ noLeidas })}\n\n`);
  });

  router.use(autenticar);

  router.get('/', async (req, res) => {
    const [notificaciones, noLeidas] = await Promise.all([
      c.notificador.listar(req.usuario.idUsuario, req.query.tipo),
      c.notificador.contarNoLeidas(req.usuario.idUsuario),
    ]);
    res.json({ notificaciones, noLeidas });
  });

  router.get('/no-leidas', async (req, res) => {
    res.json({ noLeidas: await c.notificador.contarNoLeidas(req.usuario.idUsuario) });
  });

  router.post('/leidas', async (req, res) => {
    await c.notificador.marcarTodasLeidas(req.usuario.idUsuario);
    res.json({ noLeidas: 0 });
  });

  router.post('/:id/leida', async (req, res) => {
    await c.notificador.marcarLeida(idDeRuta(req.params.id), req.usuario.idUsuario);
    res.json({ noLeidas: await c.notificador.contarNoLeidas(req.usuario.idUsuario) });
  });

  return router;
}
