// Ramal — geração de viagens, posição "ao vivo" e planejador de rotas (Connection Scan).

const PEAKS = [[330, 540], [990, 1170]]; // 05:30–09:00 e 16:30–19:30
const TRANSFER_MIN = 3; // tempo mínimo de baldeação

const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const fmt = m => {
  m = Math.round(m);
  const h = Math.floor(m / 60) % 24, mm = ((m % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

function spNow() {
  // Lê data e hora de São Paulo pelas partes (funciona em todos os navegadores, inclusive Firefox e Safari antigos).
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date())) p[x.type] = x.value;
  return new Date(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
}
const minutesOf = d => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
// Feriado usa a grade de domingo (lista em holidays.js, igual à do servidor).
const dayTypeOf = d => RamalFeriados.dayTypeFor(d);

function startTimes(s, dir, total) {
  if (s.times) return s.times.map(toMin).map(t => (dir ? t + total + 10 : t));
  const out = [];
  let t = toMin(s.first) + (dir ? 4 : 0);
  const last = toMin(s.last);
  while (t <= last) {
    out.push(t);
    const peak = PEAKS.some(([a, b]) => t >= a && t < b);
    t += peak ? s.peak : s.off;
  }
  return out;
}

const tripCache = {};

function gtfsTrips(dayType) {
  const g = window.GTFS_DATA, byId = new Map(LINES.map(l => [l.id, l]));
  return (g.trips[dayType] || []).map(([id, lineId, dir, dest, st]) => {
    const line = byId.get(lineId);
    // Tipo do trem, calculado só com a grade trem a trem: passa em todas as estações do ramal = parador; pula algumas = expresso.
    const tipo = line && st.length < line.stops.length ? 'expresso' : 'parador';
    return { id, line, dir, dest, tipo, simDelay: 0, delay: 0, rt: false,
      stops: st.map(([i, time]) => ({ name: g.stations[i], time })) };
  });
}

function tripsFor(dayType) {
  if (tripCache[dayType]) return tripCache[dayType];
  if (DATA_MODE === 'gtfs') return (tripCache[dayType] = applyRealtime(gtfsTrips(dayType), dayType));
  const trips = [];
  for (const line of LINES) {
    const s = line.service[dayType];
    if (!s) continue;
    const total = line.stops[line.stops.length - 1][1];
    for (const dir of [0, 1]) {
      const order = dir === 0 ? line.stops : [...line.stops].reverse();
      for (const t of startTimes(s, dir, total)) {
        const id = `${line.id}-${dayType}-${dir}-${t}`;
        const h = hashStr(id);
        // Atraso simulado: ~70% no horário, restante 1–8 min.
        const delay = h % 10 < 7 ? 0 : 1 + ((h >>> 4) % 8);
        trips.push({
          id, line, dir, simDelay: delay, delay, rt: false,
          dest: order[order.length - 1][0],
          stops: order.map(([name, off]) => ({ name, time: t + (dir === 0 ? off : total - off) })),
        });
      }
    }
  }
  return (tripCache[dayType] = applyRealtime(trips, dayType));
}

// ---------- Tempo real ----------
// REALTIME.active = true quando o servidor (/api/realtime) entrega atrasos de uma fonte real.
// Sem fonte real: GTFS mostra o horário programado; o modo de demonstração mostra atrasos simulados.

const REALTIME = { active: false, source: null, updatedAt: null, delays: new Map() };

// Classificação expresso/parador informada pelo responsável do app (não publicada pela operadora).
// Japeri e Santa Cruz: expressos nos dias úteis. Demais ramais e todos os fins de semana: paradores.
// Se a grade trem a trem vier com a estação de cada viagem, a classificação real (tipo já definido) prevalece.
function tipoRule(line, dayType) {
  if (dayType !== 'util') return 'parador';
  return line && (line.id === 'japeri' || line.id === 'santacruz') ? 'expresso' : 'parador';
}

function applyRealtime(trips, dayType) {
  for (const t of trips) {
    if (!t.tipo) t.tipo = tipoRule(t.line, dayType);
    const d = REALTIME.delays.get(t.id);
    t.rt = REALTIME.active && d !== undefined;
    // Sem fonte real, não há atraso: a demonstração não inventa atrasos.
    t.delay = t.rt ? Math.max(0, Math.round(d)) : 0;
  }
  return trips;
}

async function refreshRealtime() {
  try {
    const res = await fetch(API_BASE + 'api/realtime', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    REALTIME.active = !!j.active;
    REALTIME.source = j.source || null;
    REALTIME.updatedAt = j.updatedAt || null;
    REALTIME.delays = new Map(Object.entries(j.delays || {}));
  } catch {
    REALTIME.active = false;
    REALTIME.delays = new Map();
  }
  for (const k in tripCache) applyRealtime(tripCache[k]);
}

// ---------- Ao vivo ----------

function liveTrips(now, dayType, lineId) {
  return tripsFor(dayType).filter(t =>
    (!lineId || t.line.id === lineId) &&
    now >= t.stops[0].time + t.delay && now <= t.stops[t.stops.length - 1].time + t.delay);
}

// Índice fracionário da posição do trem na lista de paradas da viagem.
function tripPosition(trip, now) {
  const e = now - trip.delay, st = trip.stops;
  for (let i = 0; i < st.length - 1; i++) {
    if (e < st[i + 1].time) return i + Math.max(0, (e - st[i].time) / (st[i + 1].time - st[i].time));
  }
  return st.length - 1;
}

// ---------- Dados oficiais (oficial-data.js) ----------
// Primeiro e último trem que a operadora publica para cada estação, sentido (destino) e tipo de dia.
// Quando existe um par para o destino, a grade estimada fica limitada a essa janela.

const OFFICIAL_BY_NAME = new Map(((window.OFICIAL && window.OFICIAL.estacoes) || []).map(e => [e.nome, e]));

function officialStation(name) { return OFFICIAL_BY_NAME.get(name) || null; }

function officialWindow(station, dest, dayType) {
  const st = officialStation(station);
  if (!st) return null;
  const rows = st.trens.filter(t => t.para === dest && t.dia === dayType);
  if (!rows.length) return null;
  return {
    first: Math.min(...rows.map(r => toMin(r.primeiro))),
    last: Math.max(...rows.map(r => toMin(r.ultimo))),
  };
}

// true se o trem sai dentro da janela oficial (ou se não há janela para esse destino).
function withinOfficial(station, dest, time, dayType) {
  const w = officialWindow(station, dest, dayType);
  return !w || (time >= w.first - 2 && time <= w.last + 2);
}

function departures(station, now, dayType, perGroup = 5) {
  const groups = new Map();
  for (const trip of tripsFor(dayType)) {
    const i = trip.stops.findIndex(s => s.name === station);
    if (i < 0 || i === trip.stops.length - 1) continue;
    const sched = trip.stops[i].time, eta = sched + trip.delay;
    if (eta < now - 0.5) continue;
    if (!withinOfficial(station, trip.dest, sched, dayType)) continue;
    const key = `${trip.line.id}|${trip.dir}`;
    if (!groups.has(key)) groups.set(key, { line: trip.line, dest: trip.dest, items: [] });
    groups.get(key).items.push({ trip, sched, eta });
  }
  const out = [...groups.values()];
  for (const g of out) g.items = g.items.sort((a, b) => a.eta - b.eta).slice(0, perGroup);
  return out.sort((a, b) => a.items[0].eta - b.items[0].eta);
}

// ---------- Planejador (Connection Scan Algorithm) ----------

const connCache = {};
function connectionsFor(dayType) {
  if (connCache[dayType]) return connCache[dayType];
  const conns = [];
  for (const trip of tripsFor(dayType)) {
    for (let i = 0; i < trip.stops.length - 1; i++) {
      const a = trip.stops[i], b = trip.stops[i + 1];
      conns.push({ trip, seq: i, from: a.name, to: b.name, dep: a.time, arr: b.time });
    }
  }
  conns.sort((x, y) => x.dep - y.dep || x.arr - y.arr);
  return (connCache[dayType] = conns);
}

function planOnce(from, to, dep, dayType) {
  const conns = connectionsFor(dayType);
  let lo = 0, hi = conns.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (conns[m].dep < dep) lo = m + 1; else hi = m; }

  const best = new Map([[from, dep]]);
  const boarded = new Map(); // trip.id -> índice da conexão de embarque
  const ptr = new Map();     // estação -> { enter, exit }
  for (let i = lo; i < conns.length; i++) {
    const c = conns[i];
    if (best.has(to) && best.get(to) <= c.dep) break;
    let on = boarded.has(c.trip.id);
    if (!on && best.has(c.from)) {
      const ready = best.get(c.from) + (c.from === from ? 0 : TRANSFER_MIN);
      if (ready <= c.dep) { boarded.set(c.trip.id, i); on = true; }
    }
    if (!on) continue;
    if (!best.has(c.to) || c.arr < best.get(c.to)) {
      best.set(c.to, c.arr);
      ptr.set(c.to, { enter: boarded.get(c.trip.id), exit: i });
    }
  }
  if (!ptr.has(to)) return null;

  const legs = [];
  for (let s = to, guard = 0; s !== from && guard < 20; guard++) {
    const p = ptr.get(s), a = conns[p.enter], b = conns[p.exit];
    legs.unshift({ trip: a.trip, from: a.from, to: b.to, dep: a.dep, arr: b.arr, count: b.seq - a.seq + 1 });
    s = a.from;
  }
  return { legs, dep: legs[0].dep, arr: legs[legs.length - 1].arr };
}

function plan(from, to, dep, dayType, n = 3) {
  if (!from || !to || from === to) return [];
  const out = [];
  let t = dep;
  for (let k = 0; k < n * 3 && out.length < n; k++) {
    const r = planOnce(from, to, t, dayType);
    if (!r) break;
    const key = r.legs.map(l => l.trip.id).join('|');
    if (!out.some(o => o.key === key)) out.push({ ...r, key });
    t = r.dep + 1;
  }
  return out;
}
