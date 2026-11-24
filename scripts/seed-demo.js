// Datos de demostración: un donante, un receptor y un voluntario ya verificados,
// más un lote publicado. Contraseña de todas las cuentas demo: Demo1234
import bcrypt from 'bcryptjs';
import { cerrarPool, consultar } from '../src/config/db.js';
import { fechaLocal } from '../src/utils/fechas.js';

const CONTRASENA = 'Demo1234';

const cuentas = [
  {
    nombre: 'Abarrotes La Esperanza (demo)',
    correo: 'donante@demo.mx',
    telefono: '5511112222',
    rol: 'DONANTE',
    direccion: 'Centro Histórico, Cuauhtémoc, CDMX',
    latitud: 19.4326,
    longitud: -99.1332,
  },
  {
    nombre: 'Comedor Comunitario Nueva Vida (demo)',
    correo: 'receptor@demo.mx',
    telefono: '5533334444',
    rol: 'RECEPTOR',
    direccion: 'Col. Guerrero, Cuauhtémoc, CDMX',
    latitud: 19.4440,
    longitud: -99.1450,
  },
  {
    nombre: 'Ana López (demo)',
    correo: 'voluntario@demo.mx',
    telefono: '5555556666',
    rol: 'VOLUNTARIO',
    direccion: 'Col. Santa María la Ribera, CDMX',
    latitud: 19.4500,
    longitud: -99.1560,
  },
];

async function crearCuenta(cuenta, hash) {
  const [existente] = await consultar('SELECT id_usuario FROM usuarios WHERE correo = ?', [cuenta.correo]);
  if (existente) return existente.id_usuario;
  const resultado = await consultar('INSERT INTO usuarios SET ?', [
    {
      ...cuenta,
      contrasena_hash: hash,
      estado_verificacion: 'VERIFICADO',
      acepta_terminos: 1,
      indice_confiabilidad: 0,
    },
  ]);
  return resultado.insertId;
}

try {
  const hash = await bcrypt.hash(CONTRASENA, 10);
  const ids = {};
  for (const cuenta of cuentas) ids[cuenta.rol] = await crearCuenta(cuenta, hash);

  await consultar(
    `INSERT INTO disponibilidad_receptor (id_receptor, recibiendo_lotes, capacidad_kg, horario_inicio, horario_fin, radio_cobertura_km)
     VALUES (?, 1, 200, '08:00:00', '20:00:00', 10)
     ON DUPLICATE KEY UPDATE recibiendo_lotes = 1, capacidad_kg = 200, radio_cobertura_km = 10`,
    [ids.RECEPTOR],
  );

  const [loteDemo] = await consultar('SELECT id_lote FROM lotes_alimentos WHERE id_donante = ? LIMIT 1', [ids.DONANTE]);
  if (!loteDemo) {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const [categoria] = await consultar("SELECT id_categoria FROM categorias_alimento WHERE nombre = 'Panadería'");
    const lote = await consultar('INSERT INTO lotes_alimentos SET ?', [
      {
        id_donante: ids.DONANTE,
        id_categoria: categoria.id_categoria,
        nombre: 'Pan dulce',
        descripcion: 'Conchas y cuernitos del día, en bolsas cerradas. Empaque con golpes leves.',
        peso_kg: 12,
        fecha_caducidad: fechaLocal(manana),
        hora_caducidad: '12:00:00',
        direccion_recogida: 'Centro Histórico, Cuauhtémoc, CDMX',
        latitud: 19.4326,
        longitud: -99.1332,
        declaracion_buena_fe: 1,
      },
    ]);
    await consultar('INSERT INTO fotos_lote (id_lote, url_foto, es_principal) VALUES (?, ?, 1)', [
      lote.insertId,
      '/img/lote-demo.svg',
    ]);
  }

  console.log('Datos demo listos. Contraseña de todas las cuentas: Demo1234');
  for (const cuenta of cuentas) console.log(`  ${cuenta.rol.padEnd(10)} ${cuenta.correo}`);
  console.log('  ADMIN      admin@rescate.mx (contraseña Admin123!)');
} finally {
  await cerrarPool();
}
