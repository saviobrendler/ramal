// Ramal — recursos feitos com os passageiros: relatos, vagão certo, acessibilidade,
// lotação prevista, avisos e pontualidade. Inclui fila de envio para quando estiver sem internet.

const cstore = {
  get(k, d) { try { const v = localStorage.getItem('ramal.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ramal.' + k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
};

const DEV_ID = (() => {
  let id = cstore.get('dev', null);
  if (!id) {
    id = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    cstore.set('dev', id);
  }
  return id;
})();

const COMM = {
  overview: null,        // { alerts, crowdLine }
  stations: new Map(),   // nome -> { crowd, vagao, acess, recent }
  punct: new Map(),      // dias -> { lines }
  pending: new Set(),
  serverOk: true,
};

async function getJSON(url) {
  const res = await fetch(API_BASE + url, { cache: 'no-store' });
  const j = await res.json();
  if (!res.ok || j.offline) throw new Error(j.error || 'offline');
  return j;
}

async function loadOverview(day) {
  try { COMM.overview = await getJSON(`api/overview?day=${day}`); COMM.serverOk = true; }
  catch { COMM.serverOk = false; }
}

// Carrega dados de uma estação uma vez por minuto no máximo; devolve true se trouxe algo novo.
async function loadStation(name, day, force = false) {
  const have = COMM.stations.get(name);
  if (!force && have && Date.now() - have.loadedAt < 60e3) return false;
  if (COMM.pending.has(name)) return false;
  COMM.pending.add(name);
  try {
    const j = await getJSON(`api/station?day=${day}&name=${encodeURIComponent(name)}`);
    COMM.stations.set(name, { ...j, loadedAt: Date.now() });
    return true;
  } catch { return false; } finally { COMM.pending.delete(name); }
}

async function loadPunctuality(days) {
  try { COMM.punct.set(days, await getJSON(`api/punctuality?days=${days}`)); return true; } catch { return false; }
}

// ---------- Envio de relatos (com fila offline) ----------

const queueGet = () => cstore.get('queue', []);
const queueSet = q => cstore.set('queue', q.slice(-50));

async function postReport(body) {
  const res = await fetch(API_BASE + 'api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = {};
  try { j = await res.json(); } catch { /* sem corpo */ }
  if (res.status >= 500) throw new Error('servidor');
  return res.ok ? { ok: true } : { ok: false, error: j.error || 'Não foi possível enviar.' };
}

async function sendReport(report) {
  const body = { ...report, dev: DEV_ID };
  try { return await postReport(body); }
  catch { queueSet([...queueGet(), body]); return { ok: true, queued: true }; }
}

async function flushQueue() {
  const q = queueGet();
  if (!q.length) return;
  const keep = [];
  for (const body of q) {
    try { await postReport(body); } catch { keep.push(body); } // 4xx: descarta; rede: tenta depois
  }
  queueSet(keep);
}
window.addEventListener('online', () => { flushQueue(); });

// ---------- Interpretação dos dados ----------

const CROWD = {
  1: { label: 'Costuma ter lugar', cls: 'c1' },
  2: { label: 'Movimentado', cls: 'c2' },
  3: { label: 'Costuma ir cheio', cls: 'c3' },
  4: { label: 'Costuma ir lotado', cls: 'c4' },
};
const CROWD_NOW = { 1: 'Vazio', 2: 'Com lugar', 3: 'Em pé', 4: 'Lotado' };

function crowdForecast(lineId, dir, time, station) {
  const slot = Math.floor((((time % 1440) + 1440) % 1440) / 30);
  const key = `${lineId}|${dir}`;
  const st = station && COMM.stations.get(station)?.crowd?.[key]?.[slot];
  const ln = COMM.overview?.crowdLine?.[key]?.[slot];
  const v = st && st[1] >= 3 ? st : ln && ln[1] >= 5 ? ln : null;
  if (!v) return null;
  const level = v[0] < 1.75 ? 1 : v[0] < 2.5 ? 2 : v[0] < 3.25 ? 3 : 4;
  return { level, n: v[1], ...CROWD[level] };
}

const meter = level => `<span class="meter" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</span>`;
const crowdChip = f => (f ? `<span class="crowd ${f.cls}" title="Baseado em ${f.n} relatos de passageiros">${meter(f.level)}${f.label}</span>` : '');

const ZONE_LABEL = { frente: 'Frente', meio: 'Meio', fundo: 'Fundo' };
function bestCar(station, lineId, dir, goal) {
  const v = COMM.stations.get(station)?.vagao?.[`${lineId}|${dir}|${goal}`];
  if (!v) return null;
  const total = v.frente + v.meio + v.fundo;
  const zone = Object.keys(v).reduce((a, b) => (v[b] > v[a] ? b : a));
  return { zone, total, pct: Math.round((v[zone] / total) * 100), weak: total < 3 };
}

// Trem de 3 blocos; a frente fica à direita (seta indica o sentido).
const cars = zone => `<span class="cars" aria-hidden="true">${['fundo', 'meio', 'frente'].map(z => `<i class="${z === zone ? 'on' : ''}"></i>`).join('')}<b>›</b></span>`;

function alertsFor({ lines = [], stations = [] }) {
  return (COMM.overview?.alerts || []).filter(a =>
    (a.stations || []).some(s => stations.includes(s)) || (a.lines || []).some(l => lines.includes(l)));
}

// Direções em que o trem CHEGA nesta estação (não começa nela).
function arrivingDirs(line, station) {
  const first0 = line.stops[0][0], first1 = line.stops[line.stops.length - 1][0];
  return [0, 1].filter(d => (d === 0 ? first0 : first1) !== station);
}
const destOf = (line, dir) => (dir === 0 ? line.to : line.from);

// Estima o atraso de quem diz "o trem passou agora": compara com o último horário programado.
function estimateDelay(lineId, dir, station, nowM, dayType) {
  let best = null;
  for (const t of tripsFor(dayType)) {
    if (t.line.id !== lineId || t.dir !== dir) continue;
    const s = t.stops.find(x => x.name === station);
    if (!s || s.time > nowM + 3 || s.time < nowM - 60) continue;
    if (!best || s.time > best) best = s.time;
  }
  return best == null ? null : Math.round((nowM - best) * 10) / 10;
}
