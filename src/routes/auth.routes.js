import { Router } from 'express';

export function rutasAuth(c, { autenticar }) {
  const router = Router();

  // CU 1: registro; inicia sesión al terminar para redirigir al panel del rol.
  router.post('/registro', async (req, res) => {
    const cuerpo = req.body ?? {};
    await c.autenticacion.registrar(cuerpo);
    const { sesion, usuario } = await c.autenticacion.iniciarSesion(cuerpo.correo, cuerpo.contrasena);
    res.status(201).json({ token: sesion.token, expira: sesion.fechaExpira, usuario });
  });

  // CU 2: iniciar sesión.
  router.post('/login', async (req, res) => {
    const { sesion, usuario } = await c.autenticacion.iniciarSesion(req.body?.correo, req.body?.contrasena);
    res.json({ token: sesion.token, expira: sesion.fechaExpira, usuario });
  });

  router.get('/correo-disponible', async (req, res) => {
    res.json({ disponible: await c.autenticacion.correoDisponible(req.query.correo) });
  });

  router.get('/yo', autenticar, (req, res) => {
    res.json({ usuario: req.usuario });
  });

  return router;
}
