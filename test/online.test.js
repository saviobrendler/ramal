// Testes da contagem de pessoas online. Rodar: npm test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Online } = require('../server/online');

const DEV_A = 'dispositivo-aaaa-1111';
const DEV_B = 'dispositivo-bbbb-2222';

test('conta aparelhos distintos e não duplica o mesmo aparelho', () => {
  let now = 1_000_000;
  const o = new Online({ now: () => now, salt: 's' });
  assert.equal(o.beat(DEV_A), 1);
  assert.equal(o.beat(DEV_A), 1);
  assert.equal(o.beat(DEV_B), 2);
});

test('aparelho sai da contagem 3 minutos depois da última batida', () => {
  let now = 1_000_000;
  const o = new Online({ now: () => now, salt: 's' });
  o.beat(DEV_A);
  now += 2 * 60e3;
  o.beat(DEV_B);
  assert.equal(o.count(), 2);
  now += 1.5 * 60e3; // A tem 3,5 min sem batida; B tem 1,5 min
  assert.equal(o.count(), 1);
});

test('rejeita identificador inválido', () => {
  const o = new Online({ salt: 's' });
  assert.throws(() => o.beat('curto'), /inválido/);
  assert.throws(() => o.beat(undefined), /inválido/);
});

test('guarda só o hash do identificador, não o identificador', () => {
  const o = new Online({ salt: 's' });
  o.beat(DEV_A);
  for (const k of o.seen.keys()) assert.ok(!k.includes('dispositivo'));
});
