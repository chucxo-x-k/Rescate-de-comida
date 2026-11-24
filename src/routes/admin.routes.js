import { Router } from 'express';
import { requiereRol } from '../middleware/auth.js';
import { RolUsuario } from '../domain/enums.js';
import { aBooleano, idDeRuta } from '../utils/validacion.js';

export function rutasAdmin(c, { autenticar }) {
  const router = Router();
  router.use(autenticar, requiereRol(RolUsuario.ADMINISTRADOR));

  router.get('/verificaciones', async (_req, res) => {
    res.json({ solicitudes: await c.verificacion.listarPendientes() });
  });

  router.get('/verificaciones/:id', async (req, res) => {
    res.json({ solicitud: await c.verificacion.detalle(idDeRuta(req.params.id)) });
  });

  router.post('/verificaciones/:id/resolver', async (req, res) => {
    const solicitud = await c.verificacion.actualizarEstatus(
      req.usuario,
      idDeRuta(req.params.id),
      aBooleano(req.body?.aprobar),
      req.body?.observaciones,
    );
    res.json({ solicitud });
  });

  router.get('/usuarios', async (req, res) => {
    res.json({ usuarios: await c.admin.listarUsuarios({ rol: req.query.rol, texto: req.query.q }) });
  });

  router.patch('/usuarios/:id', async (req, res) => {
    res.json({ usuario: await c.admin.cambiarActivo(req.usuario, idDeRuta(req.params.id), req.body?.activo) });
  });

  router.get('/lotes', async (req, res) => {
    res.json({ lotes: await c.lotes.listarParaAdmin(req.usuario, { estado: req.query.estado }) });
  });

  router.post('/tareas/caducidades', async (_req, res) => {
    res.json({ resultado: await c.tiempo.ejecutarAhora() });
  });

  return router;
}
