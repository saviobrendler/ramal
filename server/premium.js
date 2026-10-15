// Ramal Premium: códigos de acesso de 30 dias, criados por você depois de confirmar o Pix.
// - Você gera o código (painel/API de admin) e envia para quem pagou.
// - A pessoa digita o código no app; ele vale uma única vez e libera o mapa por 30 dias.
// - Só o hash do código fica no banco. Sem o código original, ninguém consegue ativar.
// O bloqueio é feito no app: o mapa usa dados públicos, então isto é um apoio, não uma proteção forte.

const crypto = require('crypto');

const DAY = 24 * 60 * 60 * 1000;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0, O, 1, I para não confundir
const ATTEMPTS_PER_HOUR = 10;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code).replace(/[^A-Za-z0-9]/g, '').toUpperCase()).digest('hex');
}

function newCode() {
  const bytes = crypto.randomBytes(12);
  let s = '';
  for (const b of bytes) s += ALPHA[b % ALPHA.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function fail(status, msg) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

class Premium {
  constructor(db, { now = () => Date.now() } = {}) {
    this.now = now;
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS premium_codes (
      h TEXT PRIMARY KEY, days INTEGER NOT NULL, label TEXT, created INTEGER NOT NULL, used_at INTEGER
    )`);
    this.stmt = {
      insert: db.prepare('INSERT INTO premium_codes (h, days, label, created) VALUES (?, ?, ?, ?)'),
      get: db.prepare('SELECT * FROM premium_codes WHERE h = ?'),
      use: db.prepare('UPDATE premium_codes SET used_at = ? WHERE h = ?'),
      list: db.prepare('SELECT label, days, created, used_at FROM premium_codes ORDER BY created DESC LIMIT 100'),
    };
    this.attempts = new Map(); // ip -> [timestamps]
  }

  // Gera um código novo. Devolve o código em texto puro (uma única vez).
  create({ days = 30, label = '' } = {}) {
    const code = newCode();
    this.stmt.insert.run(hashCode(code), Math.max(1, Math.min(365, Number(days) || 30)), String(label).slice(0, 80), this.now());
    return code;
  }

  // Ativa um código. Devolve a data de expiração em ms.
  activate(code, ip = 'desconhecido') {
    const now = this.now();
    const recent = (this.attempts.get(ip) || []).filter(t => t > now - 3600e3);
    if (recent.length >= ATTEMPTS_PER_HOUR) throw fail(429, 'Muitas tentativas. Tente de novo mais tarde.');
    recent.push(now);
    this.attempts.set(ip, recent);

    const row = this.stmt.get.get(hashCode(String(code || '')));
    if (!row) throw fail(400, 'Código inválido.');
    if (row.used_at) throw fail(400, 'Este código já foi usado.');
    this.stmt.use.run(now, row.h);
    return { expires: now + row.days * DAY };
  }

  list() {
    return this.stmt.list.all();
  }
}

module.exports = { Premium, hashCode, newCode, DAY };
