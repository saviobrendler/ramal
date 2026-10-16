// Testes dos relatos: validação, votos, limite, moderação, alertas, estatísticas e persistência.
// Rodar: npm test   (usa node:test; banco em memória e relógio fixo, sem tocar nos dados reais)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Community, HttpError, migrateJson, insertRaw } = require('../server/community');

const ROOT = path.join(__dirname, '..');
const T0 = Date.parse('2026-10-14T12:00:00-03:00'); // quarta-feira, meio-dia
const DEV_A = 'dispositivo-aaaa-1111';
const DEV_B = 'dispositivo-bbbb-2222';
const DEV_C = 'dispositivo-cccc-3333';

function make(extra = {}) {
  let now = T0;
  const c = new Community({ root: ROOT, file: ':memory:', salt: 'teste', now: () => now, startTimers: false, ...extra });
  c.advance = ms => { now += ms; };
  return c;
}
const IP1 = '10.0.0.1', IP2 = '10.0.0.2', IP3 = '10.0.0.3';
const CENTRAL = 'Central do Brasil';

test('rejeita dispositivo, tipo, estação e ramal inválidos', () => {
  const c = make();
  assert.throws(() => c.add({ dev: 'curto', type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 }), HttpError);
  assert.throws(() => c.add({ dev: DEV_A, type: 'xyz', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 }), /Tipo/);
  assert.throws(() => c.add({ dev: DEV_A, type: 'ar', station: 'Estação Inventada', line: 'deodoro', dir: 0 }, { ip: IP1 }), /desconhecida/);
  assert.throws(() => c.add({ dev: DEV_A, type: 'ar', station: 'Santa Cruz', line: 'deodoro', dir: 0 }, { ip: IP1 }), /não passa/);
  assert.throws(() => c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 7 }, { ip: IP1 }), /Sentido/);
  c.close();
});

test('valores de lotação e atraso são conferidos', () => {
  const c = make();
  assert.throws(() => c.add({ dev: DEV_A, type: 'lotacao', station: CENTRAL, line: 'deodoro', dir: 0, value: 9 }, { ip: IP1 }), /Lotação/);
  assert.throws(() => c.add({ dev: DEV_A, type: 'passou', station: CENTRAL, line: 'deodoro', dir: 0, value: 500 }, { ip: IP1 }), /Atraso/);
  assert.deepEqual(c.add({ dev: DEV_A, type: 'lotacao', station: CENTRAL, line: 'deodoro', dir: 0, value: 4 }, { ip: IP1 }), { ok: true });
  c.close();
});

test('vagão: o voto da mesma pessoa substitui o anterior', () => {
  const c = make();
  const base = { dev: DEV_A, type: 'vagao', station: CENTRAL, line: 'deodoro', dir: 0, goal: 'saida' };
  c.add({ ...base, value: 'frente' }, { ip: IP1 });
  c.add({ ...base, value: 'fundo' }, { ip: IP1 });
  const st = c.station(CENTRAL, 'util');
  assert.deepEqual(st.vagao['deodoro|0|saida'], { frente: 0, meio: 0, fundo: 1 });
  c.close();
});

test('acessibilidade: maioria vence e empate vale o relato mais recente', () => {
  const c = make();
  c.add({ dev: DEV_A, type: 'acess', station: CENTRAL, item: 'elevador', value: true }, { ip: IP1 });
  c.add({ dev: DEV_B, type: 'acess', station: CENTRAL, item: 'elevador', value: false }, { ip: IP2 });
  c.advance(1000);
  c.add({ dev: DEV_C, type: 'acess', station: CENTRAL, item: 'elevador', value: false }, { ip: IP3 });
  const e = c.station(CENTRAL, 'util').acess.elevador;
  assert.equal(e.ok, false);
  assert.equal(e.n, 3);
  c.close();
});

test('limite de 40 relatos por hora por dispositivo', () => {
  const c = make();
  for (let i = 0; i < 40; i++) {
    c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 });
    c.advance(60e3); // 40 envios em 40 min, dentro da janela de 1 h
  }
  assert.throws(() => c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 }), /Muitos/);
  c.close();
});

test('relatos repetidos em 10 min contam como um só', () => {
  const c = make();
  c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 });
  c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 });
  assert.equal(c.since(60 * 60e3).filter(r => r.type === 'ar').length, 1);
  c.close();
});

test('alerta de trem parado: exige 3 aparelhos distintos e fica marcado como não verificado', () => {
  const c = make();
  c.add({ dev: DEV_A, type: 'parado', station: CENTRAL, line: 'japeri', dir: 1 }, { ip: IP1 });
  c.add({ dev: DEV_B, type: 'parado', station: 'Austin', line: 'japeri', dir: 1 }, { ip: IP2 });
  assert.equal(c.stoppedAlerts().length, 0);
  c.add({ dev: DEV_C, type: 'parado', station: CENTRAL, line: 'japeri', dir: 1 }, { ip: IP3 });
  const [al] = c.stoppedAlerts();
  assert.equal(al.kind, 'paralisacao');
  assert.match(al.detail, /não verificado/);
  c.close();
});

test('alerta some depois de 30 min', () => {
  const c = make();
  c.add({ dev: DEV_A, type: 'parado', station: CENTRAL, line: 'japeri', dir: 1 }, { ip: IP1 });
  c.add({ dev: DEV_B, type: 'parado', station: 'Austin', line: 'japeri', dir: 1 }, { ip: IP2 });
  c.advance(31 * 60e3);
  assert.equal(c.stoppedAlerts().length, 0);
  c.close();
});

test('lotação prevista: média por faixa de 30 min', () => {
  const c = make();
  const ts = T0; // quarta, 12:00 → faixa 12:00–12:29 (minuto 720)
  for (const [dev, v] of [[DEV_A, 4], [DEV_B, 4], [DEV_C, 2]]) {
    c.add({ dev, type: 'lotacao', station: CENTRAL, line: 'deodoro', dir: 0, value: v }, { ip: dev === DEV_C ? IP3 : IP1 });
  }
  const crowd = c.crowd('util', CENTRAL);
  const slot = Math.floor(720 / 30);
  assert.equal(crowd['deodoro|0'][slot][1], 3);
  assert.ok(Math.abs(crowd['deodoro|0'][slot][0] - 3.33) < 0.01);
  assert.ok(ts);
  c.close();
});

test('ocultar relato o tira das estatísticas', () => {
  const c = make();
  c.add({ dev: DEV_A, type: 'parado', station: CENTRAL, line: 'japeri', dir: 1 }, { ip: IP1 });
  c.add({ dev: DEV_B, type: 'parado', station: 'Austin', line: 'japeri', dir: 1 }, { ip: IP2 });
  c.add({ dev: DEV_C, type: 'parado', station: CENTRAL, line: 'japeri', dir: 1 }, { ip: IP3 });
  assert.equal(c.stoppedAlerts().length, 1);
  const id = c.listRecent(10).find(r => r.type === 'parado' && r.station === 'Austin').id;
  c.hide(id);
  assert.equal(c.stoppedAlerts().length, 0, 'com dois aparelhos restantes, o alerta cai');
  c.close();
});

test('bloquear dispositivo apaga os relatos dele e recusa novos envios', () => {
  const c = make();
  c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 });
  c.block(DEV_A, 'spam');
  assert.equal(c.since(3600e3).filter(r => r.dev === DEV_A).length, 0);
  assert.throws(() => c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 }), HttpError);
  c.unblock(DEV_A);
  assert.deepEqual(c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 }), { ok: true });
  c.close();
});

test('pontualidade: percentual no horário e atraso médio', () => {
  const c = make();
  const devs = ['dispositivo-p1-0001', 'dispositivo-p2-0002', 'dispositivo-p3-0003', 'dispositivo-p4-0004'];
  [0, 3, 10, 20].forEach((v, i) => c.add({ dev: devs[i], type: 'passou', station: CENTRAL, line: 'deodoro', dir: 0, value: v }, { ip: IP1 }));
  const d = c.punctuality(30).lines.find(l => l.line === 'deodoro');
  assert.equal(d.n, 4);
  assert.equal(d.onTimePct, 50);
  assert.equal(d.avgDelay, 8.3);
  c.close();
});

test('dados persistem no arquivo e voltam ao reabrir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ramal-'));
  const file = path.join(dir, 'teste.db');
  let c = new Community({ root: ROOT, file, salt: 's', startTimers: false });
  c.add({ dev: DEV_A, type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0 }, { ip: IP1 });
  c.close();
  c = new Community({ root: ROOT, file, salt: 's', startTimers: false });
  assert.equal(c.count(), 1);
  assert.equal(c.since(3600e3).length, 1);
  c.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('migração importa o JSON antigo uma vez e renomeia o arquivo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ramal-'));
  const jsonFile = path.join(dir, 'community.json');
  fs.writeFileSync(jsonFile, JSON.stringify({ reports: [
    { ts: T0, dev: DEV_A, who: 'x', type: 'ar', station: CENTRAL, line: 'deodoro', dir: 0, day: 'util', minute: 720, value: null },
    { ts: T0, dev: DEV_B, who: 'y', type: 'passou', station: CENTRAL, line: 'deodoro', dir: 0, day: 'util', minute: 720, value: 3 },
  ] }));
  const c = make();
  assert.equal(migrateJson(c, jsonFile), 2);
  assert.ok(fs.existsSync(jsonFile + '.migrado'));
  assert.equal(migrateJson(c, jsonFile), 0, 'não importa de novo');
  assert.equal(c.count(), 2);
  c.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('insertRaw grava relatos prontos', () => {
  const c = make();
  insertRaw(c, [{ ts: T0, dev: DEV_A, who: 'x', type: 'lotacao', station: CENTRAL, line: 'deodoro', dir: 0, day: 'util', minute: 720, value: 2 }]);
  assert.equal(c.crowd('util', CENTRAL)['deodoro|0'][24][0], 2);
  c.close();
});
