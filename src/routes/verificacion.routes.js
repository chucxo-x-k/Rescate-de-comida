import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { subidaDocumentos } from '../middleware/subidas.js';
import { idDeRuta } from '../utils/validacion.js';

// CU 3: Identidad / Organización.
export function rutasVerificacion(c, { autenticar }) {
  const router = Router();
  router.use(autenticar);

  router.get('/', async (req, res) => {
    res.json(await c.verificacion.obtenerSolicitudActual(req.usuario));
  });

  router.post('/documentos/:tipo', subidaDocumentos.single('archivo'), async (req, res) => {
    res.json(await c.verificacion.subirDocumento(req.usuario, req.params.tipo, req.file));
  });

  router.post('/guardar', async (req, res) => {
    res.json(await c.verificacion.guardarBorrador(req.usuario));
  });

  router.post('/enviar', async (req, res) => {
    res.json(await c.verificacion.solicitar(req.usuario));
  });

  // Documentos privados: se sirven solo al dueño o a un administrador.
  router.get('/documentos/:id/archivo', async (req, res) => {
    const { flujo, tipo } = await c.verificacion.archivoDocumento(req.usuario, idDeRuta(req.params.id));
    res.set('Content-Type', tipo);
    res.set('Cache-Control', 'private, no-store');
    await pipeline(flujo, res);
  });

  return router;
}
