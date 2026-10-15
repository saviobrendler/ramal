// Testes do código Pix (BR Code). Rodar: npm test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pixPayload, crc16, PIX_KEY } = require('../pix');

test('CRC-16/CCITT-FALSE confere com o valor de referência', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('payload termina com o CRC correto e tem o campo 63', () => {
  const p = pixPayload({ amount: 5 });
  assert.match(p, /6304[0-9A-F]{4}$/);
  assert.equal(crc16(p.slice(0, -4)), p.slice(-4));
});

test('inclui a chave Pix e o valor (campo 54) quando informado', () => {
  const p = pixPayload({ amount: 10 });
  assert.ok(p.includes(PIX_KEY));
  // Campo 54: id "54", tamanho "05", valor "10.00".
  assert.ok(p.includes('540510.00'));
});

test('sem valor, não inclui o campo 54', () => {
  const p = pixPayload({});
  assert.ok(p.includes(PIX_KEY));
  assert.ok(!p.includes('54'.concat('05')));
});
