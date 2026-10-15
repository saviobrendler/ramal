// Gera relatos FALSOS de teste em data/community-teste.json, para ver as telas preenchidas.
// Nunca use este arquivo em produção.
//
// Uso: node tools/seed-test-reports.js
//      node server.js --community-file=data/community-teste.json

const fs = require('fs');
const path = require('path');
const { loadNetwork } = require('../server/community');

const root = path.join(__dirname, '..');
const net = loadNetwork(root);
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = a => a[Math.floor(rnd() * a.length)];
const DAY = 864e5;

function parts(ts) {
  const d = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const w = d.getDay();
  return { day: w === 0 ? 'dom' : w === 6 ? 'sab' : 'util', minute: d.getHours() * 60 + d.getMinutes() };
}

const reports = [];
const devs = Array.from({ length: 300 }, (_, i) => `teste-${String(i).padStart(4, '0')}`);
const add = (ts, r) => reports.push({ ts, who: 'teste' + Math.floor(rnd() * 200), ...parts(ts), ...r });
const now = Date.now();
const lines = [...net.lines.values()];

for (let i = 0; i < 6000; i++) {
  // Só em horário de operação (4h30–23h).
  const dayStart = Math.floor((now - rnd() * 45 * DAY) / DAY) * DAY;
  // Nunca no futuro: o dia de hoje é cortado no horário atual.
  const ts = Math.min(dayStart + (270 + rnd() * 1110) * 60e3 + 3 * 3600e3, now - 5 * 60e3);
  const line = pick(lines), station = pick([...line.stations]), dir = rnd() < 0.5 ? 0 : 1;
  const { minute } = parts(ts);
  // Pico: de manhã rumo à Central (dir 1), à tarde saindo dela (dir 0).
  const peak = (minute >= 330 && minute < 540 && dir === 1) || (minute >= 990 && minute < 1170 && dir === 0);
  const crowd = Math.max(1, Math.min(4, Math.round((peak ? 3.4 : 1.8) + (rnd() - 0.5) * 1.6)));
  add(ts, { dev: pick(devs), type: 'lotacao', line: line.id, dir, station, value: crowd });
  const slow = { santacruz: 6, japeri: 5, belfordroxo: 7, saracuruna: 5, deodoro: 3 }[line.id] || 4;
  add(ts, { dev: pick(devs), type: 'passou', line: line.id, dir, station, value: Math.max(-1, Math.round((rnd() ** 2) * slow * 3 * (peak ? 1.5 : 1))) });
  if (rnd() < 0.02) add(ts, { dev: pick(devs), type: 'parado', line: line.id, dir, station });
}

for (const station of net.stations) {
  for (const line of lines.filter(l => l.stations.has(station))) {
    for (const dir of [0, 1]) {
      for (const goal of ['saida', 'baldeacao']) {
        const best = pick(['frente', 'meio', 'fundo']);
        const votes = Math.floor(rnd() * 12);
        for (let v = 0; v < votes; v++) {
          add(now - rnd() * 90 * DAY, { dev: devs[v], type: 'vagao', line: line.id, dir, station, goal, value: rnd() < 0.75 ? best : pick(['frente', 'meio', 'fundo']) });
        }
      }
    }
  }
  for (const [item, p] of [['elevador', 0.6], ['escada', 0.5], ['rampa', 0.7], ['vao', 0.5]]) {
    const n = Math.floor(rnd() * 5);
    const truth = rnd() < p;
    for (let v = 0; v < n; v++) add(now - rnd() * 5 * DAY, { dev: devs[v], type: 'acess', station, item, value: rnd() < 0.85 ? truth : !truth });
  }
}

// Relatos recentes para a Central e um alerta de trem parado no Japeri.
for (let i = 0; i < 6; i++) {
  const line = pick(lines.filter(l => l.stations.has('Central do Brasil')));
  add(now - rnd() * 40 * 60e3, { dev: pick(devs), type: pick(['lotacao', 'passou', 'ar']), line: line.id, dir: rnd() < 0.5 ? 0 : 1, station: 'Central do Brasil', value: 3 });
}
add(now - 8 * 60e3, { dev: 'teste-9001', who: 'rede-a', type: 'parado', line: 'japeri', dir: 1, station: 'Queimados' });
add(now - 4 * 60e3, { dev: 'teste-9002', who: 'rede-b', type: 'parado', line: 'japeri', dir: 1, station: 'Austin' });
reports.at(-1).who = 'rede-b'; reports.at(-2).who = 'rede-a';

// Grava num banco separado (data/community-teste.db), para nunca misturar com dados reais.
const { Community, insertRaw } = require('../server/community');
const dbFile = path.join(root, 'data', 'community-teste.db');
if (fs.existsSync(dbFile)) fs.rmSync(dbFile, { force: true });
for (const ext of ['-wal', '-shm']) fs.rmSync(dbFile + ext, { force: true });
const c = new Community({ root, file: dbFile, startTimers: false });
insertRaw(c, reports);
c.close();
console.log(`${reports.length} relatos de teste em data/community-teste.db`);
