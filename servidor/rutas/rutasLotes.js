import { Router } from 'express';
import { requiereRol } from '../intermediarios/autenticacion.js';
import { subidaImagenes } from '../intermediarios/subidaArchivos.js';
import { bloquearComercializacion } from '../intermediarios/bloqueoComercializacion.js';
import { RolUsuario } from '../modelos/enumeraciones.js';
import { idDeRuta } from '../utilidades/validacion.js';

export function rutasLotes(c, { autenticar }) {
  const router = Router();
  router.use(autenticar);

  router.post(
    '/',
    requiereRol(RolUsuario.DONANTE),
    subidaImagenes.array('fotos', 6),
    bloquearComercializacion,
    async (req, res) => {
      res.status(201).json(await c.lotes.publicar(req.usuario, req.body ?? {}, req.files ?? []));
    },
  );

  router.get('/mios', requiereRol(RolUsuario.DONANTE), async (req, res) => {
    res.json(await c.lotes.misLotes(req.usuario));
  });

  router.get('/cercanos', requiereRol(RolUsuario.RECEPTOR), async (req, res) => {
    res.json(await c.lotes.cercanos(req.usuario, { radioKm: req.query.radio, orden: req.query.orden }));
  });

  router.get('/activos', requiereRol(RolUsuario.ADMINISTRADOR, RolUsuario.VOLUNTARIO), async (req, res) => {
    res.json({ lotes: await c.lotes.listarActivos(req.usuario) });
  });

  router.get('/:id', async (req, res) => {
    res.json(await c.lotes.detalle(idDeRuta(req.params.id), req.usuario));
  });

  router.post('/:id/aceptar', requiereRol(RolUsuario.RECEPTOR), async (req, res) => {
    res.status(201).json(await c.rutas.crearDesdeLote(req.usuario, idDeRuta(req.params.id)));
  });

  router.post('/:id/cancelar', requiereRol(RolUsuario.DONANTE, RolUsuario.ADMINISTRADOR), async (req, res) => {
    res.json(await c.lotes.cancelar(req.usuario, idDeRuta(req.params.id)));
  });

  return router;
}
