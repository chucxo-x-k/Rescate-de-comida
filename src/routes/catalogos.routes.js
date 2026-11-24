import { Router } from 'express';
import { requiereRol } from '../middleware/auth.js';
import { RolUsuario } from '../domain/enums.js';

export function rutasCatalogos(c, { autenticar }) {
  const router = Router();

  router.get('/categorias', async (_req, res) => {
    const filas = await c.repos.categorias.listar();
    res.json({ categorias: filas.map((f) => ({ idCategoria: f.id_categoria, nombre: f.nombre })) });
  });

  router.get('/parametros', async (_req, res) => {
    const filas = await c.repos.configuracion.todas();
    res.json({ parametros: Object.fromEntries(filas.map((f) => [f.clave, f.valor])) });
  });

  router.get('/kpis', autenticar, requiereRol(RolUsuario.VOLUNTARIO, RolUsuario.ADMINISTRADOR), async (req, res) => {
    const indicadores = await c.kpis.calcular({ dias: req.query.dias, idCategoria: req.query.categoria }, req.usuario);
    res.json({ indicadores });
  });

  return router;
}
