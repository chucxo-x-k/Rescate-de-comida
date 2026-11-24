import { Router } from 'express';
import { requiereRol } from '../intermediarios/autenticacion.js';
import { subidaImagenes } from '../intermediarios/subidaArchivos.js';
import { bloquearComercializacion } from '../intermediarios/bloqueoComercializacion.js';
import { RolUsuario } from '../modelos/enumeraciones.js';
import { idDeRuta } from '../utilidades/validacion.js';

export function rutasRecoleccion(c, { autenticar }) {
  const router = Router();
  router.use(autenticar);
  const soloVoluntario = requiereRol(RolUsuario.VOLUNTARIO);

  router.get('/disponibles', soloVoluntario, async (req, res) => {
    res.json(await c.rutas.listarDisponibles(req.usuario, { radioKm: req.query.radio, orden: req.query.orden }));
  });

  router.get('/activa', soloVoluntario, async (req, res) => {
    const ruta = await c.rutas.rutaActiva(req.usuario);
    const checklist = ruta ? await c.inocuidad.obtenerPorRuta(ruta.idRuta) : null;
    res.json({ ruta, checklist, criterios: c.inocuidad.presentarChecklist() });
  });

  router.get('/recepciones', requiereRol(RolUsuario.RECEPTOR), async (req, res) => {
    res.json({ rutas: await c.rutas.misRecepciones(req.usuario) });
  });

  router.get('/:id', async (req, res) => {
    const id = idDeRuta(req.params.id);
    const ruta = await c.rutas.detalleParaParticipante(req.usuario, id);
    res.json({ ruta, checklist: await c.inocuidad.obtenerPorRuta(id) });
  });

  router.post('/:id/aceptar', soloVoluntario, async (req, res) => {
    res.json({ ruta: await c.rutas.aceptar(req.usuario, idDeRuta(req.params.id)) });
  });

  router.post('/:id/checklist', soloVoluntario, async (req, res) => {
    res.json(await c.inocuidad.evaluar(req.usuario, idDeRuta(req.params.id), req.body ?? {}));
  });

  router.post('/:id/incumplimiento', soloVoluntario, async (req, res) => {
    res.json(await c.inocuidad.reportarIncumplimiento(req.usuario, idDeRuta(req.params.id), req.body ?? {}));
  });

  router.post(
    '/:id/evidencia',
    soloVoluntario,
    subidaImagenes.fields([{ name: 'fotos', maxCount: 6 }, { name: 'firma', maxCount: 1 }]),
    bloquearComercializacion,
    async (req, res) => {
      const evidencia = await c.evidencia.registrar(req.usuario, idDeRuta(req.params.id), {
        fotos: req.files?.fotos ?? [],
        firma: req.files?.firma?.[0] ?? null,
        codigo: req.body?.codigo ?? null,
      });
      res.status(201).json({ evidencia });
    },
  );

  router.get('/:id/evidencia', async (req, res) => {
    res.json({ evidencia: await c.evidencia.obtener(req.usuario, idDeRuta(req.params.id)) });
  });

  router.get('/:id/calificaciones', async (req, res) => {
    res.json({ pendientes: await c.calificaciones.pendientes(req.usuario, idDeRuta(req.params.id)) });
  });

  router.post('/:id/calificaciones', async (req, res) => {
    res.status(201).json({ pendientes: await c.calificaciones.calificar(req.usuario, idDeRuta(req.params.id), req.body ?? {}) });
  });

  return router;
}
