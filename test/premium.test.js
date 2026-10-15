// Testes dos códigos Premium. Rodar: npm test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { Premium, hashCode, DAY } = require('../server/premium');

function make() {
  let now = Date.parse('2026-10-15T12:00:00-03:00');
  const db = new DatabaseSync(':memory:');
  const p = new Premium(db, { now: () => now });
  return { p, db, advance: ms => { now += ms; } };
}

test('código ativa uma única vez e libera 30 dias', () => {
  const { p } = make();
  const code = p.create({ days: 30, label: 'teste' });
  const r = p.activate(code, '1.1.1.1');
  assert.ok(r.expires > Date.now());
  assert.equal(Math.round((r.expires - Date.now()) / DAY), 30);
  assert.throws(() => p.activate(code, '1.1.1.1'), /já foi usado/);
});

test('aceita o código com letras minúsculas e sem os traços', () => {
  const { p } = make();
  const code = p.create({});
  assert.ok(p.activate(code.toLowerCase().replace(/-/g, ''), '2.2.2.2').expires);
});

test('código inválido é recusado', () => {
  const { p } = make();
  assert.throws(() => p.activate('XXXX-YYYY-ZZZZ', '3.3.3.3'), /inválido/);
  assert.throws(() => p.activate(undefined, '3.3.3.3'), /inválido/);
});

test('o banco guarda só o hash, nunca o código', () => {
  const { p, db } = make();
  const code = p.create({});
  const rows = db.prepare('SELECT h FROM premium_codes').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].h, hashCode(code));
  assert.ok(!rows[0].h.includes(code.replace(/-/g, '')));
});

test('limite de 10 tentativas por hora por endereço', () => {
  const { p, advance } = make();
  for (let i = 0; i < 10; i++) assert.throws(() => p.activate('ERRADO-CODIGO-0000', '4.4.4.4'), /inválido/);
  assert.throws(() => p.activate('ERRADO-CODIGO-0000', '4.4.4.4'), /Muitas tentativas/);
  advance(61 * 60e3);
  assert.throws(() => p.activate('ERRADO-CODIGO-0000', '4.4.4.4'), /inválido/);
});
