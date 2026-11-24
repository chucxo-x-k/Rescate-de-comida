import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contieneComercializacion } from '../../src/middleware/comercializacion.js';

test('bloquea campos y textos de venta o cobro', () => {
  assert.ok(contieneComercializacion({ precio: 10 }));
  assert.ok(contieneComercializacion({ descripcion: 'Se vende pan a $20' }));
  assert.ok(contieneComercializacion({ descripcion: 'Cuota de recuperación 50 pesos' }));
  assert.ok(contieneComercializacion({ nombre: 'Lote', extra: { costoEnvio: 5 } }));
});

test('permite descripciones normales de donación', () => {
  assert.equal(contieneComercializacion({ descripcion: 'Conchas del día en bolsas cerradas, 12 kg' }), null);
  assert.equal(contieneComercializacion({ contrasena: 'vendo$1234' }), null);
  assert.equal(contieneComercializacion({ firma: 'data:image/png;base64,AAAA' }), null);
});
