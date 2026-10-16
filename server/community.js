// Ramal — relatos dos passageiros: armazenamento (SQLite), validação, moderação e estatísticas.
//
// Tipos de relato:
//   passou   trem passou na estação; value = atraso estimado em minutos
//   lotacao  value 1 vazio · 2 com lugar · 3 em pé · 4 lotado
//   parado   trem parado / circulação interrompida
//   ar       ar-condicionado quebrado
//   vagao    melhor vagão; goal saida|baldeacao; value frente|meio|fundo
//   acess    acessibilidade da estação; item elevador|escada|rampa|vao; value true (ok) | false

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { DatabaseSync } = require('node:sqlite');
const { dayTypeFor } = require('../holidays');

const DAY = 24 * 60 * 60 * 1000;
// Chave para transformar o identificador do aparelho em um resumo irreversível. Defina PRIVACY_SALT no servidor
// para manter o mesmo resumo após reinícios; sem ela, uma chave nova é gerada a cada start.
const DEV_KEY = process.env.PRIVACY_SALT || crypto.randomBytes(32).toString('hex');
function hashDev(d) { return crypto.createHmac('sha256', DEV_KEY).update(String(d)).digest('hex').slice(0, 32); }
const RETENTION_DAYS = 400;
const TYPES = new Set(['passou', 'lotacao', 'parado', 'ar', 'vagao', 'acess']);
const ACESS_ITEMS = { elevador: 7, escada: 7, rampa: 365, vao: 365 }; // validade em dias
const ZONES = new Set(['frente', 'meio', 'fundo']);
const PER_HOUR_LIMIT = 40;

function loadNetwork(root) {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  for (const f of ['gtfs-data.js', 'oficial-data.js', 'data.js']) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx);
  }
  const LINES = vm.runInContext('LINES', ctx);
  const lines = new Map(LINES.map(l => [l.id, { id: l.id, name: l.name, stations: new Set(l.stops.map(s => s[0])) }]));
  const stations = new Set(LINES.flatMap(l => l.stops.map(s => s[0])));
  return { lines, stations };
}

function spParts(ts) {
  const d = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return { day: dayTypeFor(d), minute: d.getHours() * 60 + d.getMinutes() };
}

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL, dev TEXT NOT NULL, who TEXT NOT NULL, type TEXT NOT NULL, station TEXT NOT NULL,
    line TEXT, dir INTEGER, day TEXT NOT NULL, minute INTEGER NOT NULL,
    value TEXT, goal TEXT, item TEXT
  );
  CREATE INDEX IF NOT EXISTS reports_ts ON reports(ts);
  CREATE INDEX IF NOT EXISTS reports_station ON reports(station);
  CREATE TABLE IF NOT EXISTS blocked (dev TEXT PRIMARY KEY, reason TEXT, ts INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS hidden (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL);
`;

class Community {
  // file: caminho do banco SQLite (ex.: data/community.db) ou ':memory:' em testes.
  constructor({ root, file, salt, now = () => Date.now(), startTimers = true }) {
    this.file = file;
    this.now = now;
    this.net = loadNetwork(root);
    this.salt = salt || crypto.randomBytes(16).toString('hex');
    this.rate = new Map();
    this.reports = [];
    this.blocked = new Set();
    if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    this.db.exec(SCHEMA);
    this.stmt = {
      insert: this.db.prepare(`INSERT INTO reports (ts, dev, who, type, station, line, dir, day, minute, value, goal, item)
        VALUES (@ts, @dev, @who, @type, @station, @line, @dir, @day, @minute, @value, @goal, @item)`),
      del: this.db.prepare('DELETE FROM reports WHERE id = ?'),
      prune: this.db.prepare('DELETE FROM reports WHERE ts < ?'),
      hide: this.db.prepare('INSERT OR REPLACE INTO hidden (id, ts) VALUES (?, ?)'),
      block: this.db.prepare('INSERT OR REPLACE INTO blocked (dev, reason, ts) VALUES (?, ?, ?)'),
      unblock: this.db.prepare('DELETE FROM blocked WHERE dev = ?'),
      loadBlocked: this.db.prepare('SELECT dev FROM blocked'),
      loadHidden: this.db.prepare('SELECT id FROM hidden'),
      loadSince: this.db.prepare('SELECT * FROM reports WHERE ts > ? ORDER BY ts'),
      count: this.db.prepare('SELECT COUNT(*) AS n FROM reports'),
      list: this.db.prepare('SELECT * FROM reports ORDER BY ts DESC LIMIT ?'),
    };
    this.migrateDevs();
    this.load();
    this.prune();
    if (startTimers) setInterval(() => this.prune(), 60 * 60e3).unref();
  }

  // Carrega para a memória o que as estatísticas usam (só relatos visíveis e recentes).
  load() {
    const hidden = new Set(this.stmt.loadHidden.all().map(r => r.id));
    this.blocked = new Set(this.stmt.loadBlocked.all().map(r => r.dev));
    this.reports = this.stmt.loadSince.all(this.now() - RETENTION_DAYS * DAY)
      .filter(r => !hidden.has(r.id) && !this.blocked.has(r.dev))
      .map(fromRow);
  }

  prune() {
    const cut = this.now() - RETENTION_DAYS * DAY;
    this.stmt.prune.run(cut);
    this.reports = this.reports.filter(r => r.ts > cut);
    const hour = this.now() - 3600e3;
    for (const [k, times] of this.rate) {
      const keep = times.filter(t => t > hour);
      keep.length ? this.rate.set(k, keep) : this.rate.delete(k);
    }
  }

  count() { return this.stmt.count.get().n; }

  // Troca identificadores brutos antigos pelo resumo (uma vez; resumos têm 32 caracteres hexadecimais).
  migrateDevs() {
    const rows = this.db.prepare('SELECT DISTINCT dev FROM reports').all();
    for (const r of rows) if (!/^[0-9a-f]{32}$/.test(r.dev)) this.db.prepare('UPDATE reports SET dev = ? WHERE dev = ?').run(hashDev(r.dev), r.dev);
    const blk = this.db.prepare('SELECT dev FROM blocked').all();
    for (const r of blk) if (!/^[0-9a-f]{32}$/.test(r.dev)) this.db.prepare('UPDATE blocked SET dev = ? WHERE dev = ?').run(hashDev(r.dev), r.dev);
  }

  // ---------- Entrada ----------

  add(input, { ip }) {
    const devRaw = String(input.dev || '');
    if (!/^[a-z0-9-]{8,64}$/i.test(devRaw)) throw new HttpError(400, 'Dispositivo inválido');
    const dev = hashDev(devRaw);
    if (this.blocked.has(dev)) throw new HttpError(403, 'Não foi possível enviar.');
    const type = String(input.type || '');
    if (!TYPES.has(type)) throw new HttpError(400, 'Tipo de relato inválido');
    const station = String(input.station || '');
    if (!this.net.stations.has(station)) throw new HttpError(400, 'Estação desconhecida');

    const now = this.now();
    const who = crypto.createHash('sha256').update(this.salt + ip).digest('hex').slice(0, 12);
    const key = dev + '|' + who;
    const recent = (this.rate.get(key) || []).filter(t => t > now - 3600e3);
    if (recent.length >= PER_HOUR_LIMIT) throw new HttpError(429, 'Muitos relatos em pouco tempo. Tente mais tarde.');
    recent.push(now);
    this.rate.set(key, recent);

    // Relato enviado sem internet: usa o horário do envio, desde que tenha no máximo 6 horas.
    const sent = Number(input.ts);
    const ts = sent && now - sent >= 0 && now - sent <= 6 * 3600e3 ? sent : now;
    const r = { ts, dev, who, type, station, line: null, dir: null, ...spParts(ts), value: null, goal: null, item: null };

    if (type !== 'acess') {
      const line = this.net.lines.get(String(input.line || ''));
      if (!line || !line.stations.has(station)) throw new HttpError(400, 'Ramal não passa nesta estação');
      const dir = Number(input.dir);
      if (dir !== 0 && dir !== 1) throw new HttpError(400, 'Sentido inválido');
      r.line = line.id;
      r.dir = dir;
    }

    if (type === 'passou') {
      const v = Number(input.value);
      if (!Number.isFinite(v) || v < -5 || v > 90) throw new HttpError(400, 'Atraso fora do intervalo');
      r.value = Math.round(v * 10) / 10;
    } else if (type === 'lotacao') {
      const v = Number(input.value);
      if (![1, 2, 3, 4].includes(v)) throw new HttpError(400, 'Lotação inválida');
      r.value = v;
    } else if (type === 'vagao') {
      if (!['saida', 'baldeacao'].includes(input.goal)) throw new HttpError(400, 'Objetivo inválido');
      if (!ZONES.has(input.value)) throw new HttpError(400, 'Vagão inválido');
      r.goal = input.goal;
      r.value = input.value;
    } else if (type === 'acess') {
      if (!(input.item in ACESS_ITEMS)) throw new HttpError(400, 'Item inválido');
      r.item = input.item;
      r.value = input.value === true ? 'true' : 'false';
    }

    // Um voto por pessoa: vagão e acessibilidade substituem o anterior; relatos repetidos em 10 min também.
    const same = x => x.dev === dev && x.type === type && x.station === station && x.line === r.line && x.dir === r.dir &&
      (type === 'vagao' ? x.goal === r.goal : type === 'acess' ? x.item === r.item : x.ts > now - 10 * 60e3);
    const dropped = this.reports.filter(same);
    this.db.exec('BEGIN');
    try {
      for (const x of dropped) this.stmt.del.run(x.id);
      const info = this.stmt.insert.run({ ...r, value: r.value == null ? null : String(r.value) });
      this.db.exec('COMMIT');
      r.id = Number(info.lastInsertRowid);
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    this.reports = this.reports.filter(x => !dropped.includes(x));
    this.reports.push(r);
    return { ok: true };
  }

  // ---------- Moderação ----------

  // Oculta um relato (some das estatísticas e dos alertas, fica guardado para auditoria).
  hide(id) {
    const r = this.reports.find(x => x.id === Number(id));
    this.stmt.hide.run(Number(id), this.now());
    this.reports = this.reports.filter(x => x.id !== Number(id));
    return { ok: true, hidden: !!r };
  }

  // Bloqueia um dispositivo: os relatos dele saem das estatísticas e novos envios são recusados.
  block(devRaw, reason = '') {
    const dev = hashDev(devRaw);
    this.stmt.block.run(dev, String(reason).slice(0, 200), this.now());
    this.blocked.add(dev);
    this.reports = this.reports.filter(x => x.dev !== dev);
    return { ok: true };
  }

  unblock(devRaw) {
    const dev = hashDev(devRaw);
    this.stmt.unblock.run(dev);
    this.blocked.delete(dev);
    this.load();
    return { ok: true };
  }

  // Relatos recentes para a tela de moderação (inclui ocultos e bloqueados quando pedido).
  listRecent(limit = 100) {
    return this.stmt.list.all(Math.min(Math.max(1, limit), 500)).map(r => ({
      id: r.id, ts: r.ts, dev: r.dev, who: r.who, type: r.type, station: r.station, line: r.line, dir: r.dir, value: r.value, goal: r.goal, item: r.item,
    }));
  }

  // ---------- Saída ----------

  since(ms) { const cut = this.now() - ms; return this.reports.filter(r => r.ts > cut); }

  // Lotação média por ramal|sentido|faixa de 30 min. Com station: só aquela estação.
  crowd(day, station) {
    const out = {};
    for (const r of this.since(60 * DAY)) {
      if (r.type !== 'lotacao' || r.day !== day || (station && r.station !== station)) continue;
      const k = `${r.line}|${r.dir}`, slot = Math.floor(r.minute / 30);
      const g = (out[k] ||= {});
      const s = (g[slot] ||= [0, 0]);
      s[0] += Number(r.value); s[1]++;
    }
    for (const g of Object.values(out)) for (const s in g) g[s] = [Math.round((g[s][0] / g[s][1]) * 100) / 100, g[s][1]];
    return out;
  }

  station(name, day) {
    if (!this.net.stations.has(name)) throw new HttpError(404, 'Estação desconhecida');
    const now = this.now();
    const here = this.reports.filter(r => r.station === name);

    const vagao = {};
    for (const r of here) {
      if (r.type !== 'vagao' || r.ts < now - 365 * DAY) continue;
      const g = (vagao[`${r.line}|${r.dir}|${r.goal}`] ||= { frente: 0, meio: 0, fundo: 0 });
      g[r.value]++;
    }

    const acess = {};
    for (const [item, days] of Object.entries(ACESS_ITEMS)) {
      const votes = here.filter(r => r.type === 'acess' && r.item === item && r.ts > now - days * DAY)
        .sort((a, b) => b.ts - a.ts).slice(0, 7);
      if (!votes.length) continue;
      const yes = votes.filter(v => v.value === 'true').length;
      // Empate: vale o relato mais recente.
      const ok = yes * 2 === votes.length ? votes[0].value === 'true' : yes * 2 > votes.length;
      acess[item] = { ok, n: votes.length, at: votes[0].ts };
    }

    const recent = here
      .filter(r => ['passou', 'lotacao', 'parado', 'ar'].includes(r.type) && r.ts > now - 60 * 60e3)
      .sort((a, b) => b.ts - a.ts).slice(0, 12)
      .map(r => ({ type: r.type, line: r.line, dir: r.dir, value: r.type === 'passou' || r.type === 'lotacao' ? Number(r.value) : null, ago: Math.round((now - r.ts) / 60e3) }));

    return { station: name, crowd: this.crowd(day, name), vagao, acess, recent };
  }

  // Alerta de "trem parado" confirmado por 2+ dispositivos (ou 3 na mesma rede) nos últimos 30 min.
  stoppedAlerts() {
    const groups = new Map();
    for (const r of this.since(30 * 60e3)) {
      if (r.type !== 'parado') continue;
      const g = groups.get(r.line) || { devs: new Set(), nets: new Set(), stations: new Set(), at: 0 };
      g.devs.add(r.dev); g.nets.add(r.who);
      g.stations.add(r.station);
      g.at = Math.max(g.at, r.ts);
      groups.set(r.line, g);
    }
    const out = [];
    for (const [lineId, g] of groups) {
      // 2 pessoas em redes diferentes, ou 3 dispositivos na mesma rede (vários passageiros no mesmo trem
      // costumam sair pela mesma operadora de celular).
      const people = g.devs.size;
      // Só alerta com 3 ou mais aparelhos distintos: o relato é de passageiros e não é verificado.
      if (people < 3) continue;
      const line = this.net.lines.get(lineId);
      out.push({
        id: `parado-${lineId}`,
        kind: 'paralisacao',
        title: `Trem parado no ramal ${line ? line.name : lineId}`,
        detail: `${people} pessoas informaram trem parado perto de ${[...g.stations].join(', ')}. Relato não verificado.`,
        lines: [lineId], stations: [...g.stations], at: new Date(g.at).toISOString(),
        source: 'Relatos de passageiros',
      });
    }
    return out;
  }

  punctuality(days) {
    const per = new Map();
    for (const r of this.since(days * DAY)) {
      if (r.type !== 'passou' && r.type !== 'parado') continue;
      const p = per.get(r.line) || { n: 0, sum: 0, onTime: 0, stops: new Set(), hours: new Map() };
      if (r.type === 'passou') {
        const d = Math.max(0, Number(r.value));
        p.n++; p.sum += d; if (d <= 5) p.onTime++;
        const h = Math.floor(r.minute / 60), hh = p.hours.get(h) || [0, 0];
        hh[0] += d; hh[1]++; p.hours.set(h, hh);
      } else {
        p.stops.add(Math.floor(r.ts / (30 * 60e3))); // conta episódios de 30 min, não relatos
      }
      per.set(r.line, p);
    }
    const lines = [...this.net.lines.values()].map(l => {
      const p = per.get(l.id);
      if (!p) return { line: l.id, n: 0 };
      let worst = null;
      for (const [h, [s, n]] of p.hours) if (n >= 3 && (!worst || s / n > worst.avg)) worst = { hour: h, avg: Math.round((s / n) * 10) / 10 };
      return {
        line: l.id, n: p.n,
        avgDelay: p.n ? Math.round((p.sum / p.n) * 10) / 10 : null,
        onTimePct: p.n ? Math.round((p.onTime / p.n) * 100) : null,
        stops: p.stops.size, worst,
      };
    });
    return { days, lines };
  }

  close() { this.db.close(); }
}

function fromRow(r) {
  return {
    id: r.id, ts: r.ts, dev: r.dev, who: r.who, type: r.type, station: r.station, line: r.line, dir: r.dir,
    day: r.day, minute: r.minute, value: r.value, goal: r.goal, item: r.item,
  };
}

// Grava relatos já prontos (migração ou dados de teste), em uma transação.
function insertRaw(community, rows) {
  community.db.exec('BEGIN');
  try {
    for (const r of rows) {
      community.stmt.insert.run({
        ts: r.ts, dev: r.dev, who: r.who, type: r.type, station: r.station, line: r.line ?? null, dir: r.dir ?? null,
        day: r.day, minute: r.minute, value: r.value == null ? null : String(r.value), goal: r.goal ?? null, item: r.item ?? null,
      });
    }
    community.db.exec('COMMIT');
  } catch (e) { community.db.exec('ROLLBACK'); throw e; }
  community.load();
  return rows.length;
}

// Importa o arquivo JSON antigo uma única vez, se o banco ainda estiver vazio.
function migrateJson(community, jsonFile) {
  if (!fs.existsSync(jsonFile) || community.count() > 0) return 0;
  const old = JSON.parse(fs.readFileSync(jsonFile, 'utf8')).reports || [];
  const n = insertRaw(community, old);
  fs.renameSync(jsonFile, jsonFile + '.migrado');
  return n;
}

module.exports = { Community, HttpError, loadNetwork, migrateJson, insertRaw, hashDev };
