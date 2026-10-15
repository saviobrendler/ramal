// Importa um feed GTFS (pasta já descompactada) e gera gtfs-data.js para o site.
//
// Uso:  node tools/import-gtfs.js <pasta-do-gtfs> [--route-type=2] [--source="Nome da fonte"]
//
// Lê agency/routes/trips/stops/stop_times/calendar. Só rotas ferroviárias (route_type 2) por padrão;
// use --route-type=all para importar todas.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=') || true];
}));
if (!dir) {
  console.error('Uso: node tools/import-gtfs.js <pasta-do-gtfs> [--route-type=2|all] [--source="..."]');
  process.exit(1);
}

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  const keys = head.map(h => h.trim());
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

function read(name, required = true) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    if (required) { console.error(`Arquivo obrigatório ausente: ${name}`); process.exit(1); }
    return [];
  }
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

const toMin = t => { const [h, m, s] = t.split(':').map(Number); return h * 60 + m + (s || 0) / 60; };
const round1 = n => Math.round(n * 10) / 10;

const agency = read('agency.txt', false);
const routesAll = read('routes.txt');
const trips = read('trips.txt');
const stops = read('stops.txt');
const stopTimes = read('stop_times.txt');
const calendar = read('calendar.txt', false);

const routeType = opt['route-type'] ?? '2';
const routes = routesAll.filter(r => routeType === 'all' || r.route_type === String(routeType));
if (!routes.length) {
  console.error(`Nenhuma rota com route_type=${routeType}. Tente --route-type=all.`);
  process.exit(1);
}
const routeIds = new Set(routes.map(r => r.route_id));

// Estação: usa a parent_station quando existir, para juntar plataformas.
const stopById = new Map(stops.map(s => [s.stop_id, s]));
const stationName = id => {
  const s = stopById.get(id);
  if (!s) return id;
  const parent = s.parent_station && stopById.get(s.parent_station);
  return (parent || s).stop_name;
};

// Tipos de dia a partir do calendar.txt.
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const dayTypes = new Map(); // service_id -> Set(util|sab|dom)
for (const c of calendar) {
  if (c.end_date && c.end_date < today) continue;
  const set = new Set();
  if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].some(d => c[d] === '1')) set.add('util');
  if (c.saturday === '1') set.add('sab');
  if (c.sunday === '1') set.add('dom');
  dayTypes.set(c.service_id, set);
}
const servicesOf = serviceId => dayTypes.get(serviceId) ?? (calendar.length ? new Set() : new Set(['util', 'sab', 'dom']));

// Agrupa stop_times por viagem.
const tripMeta = new Map(trips.filter(t => routeIds.has(t.route_id)).map(t => [t.trip_id, t]));
const timesByTrip = new Map();
for (const st of stopTimes) {
  if (!tripMeta.has(st.trip_id)) continue;
  const time = st.departure_time || st.arrival_time;
  if (!time) continue;
  if (!timesByTrip.has(st.trip_id)) timesByTrip.set(st.trip_id, []);
  timesByTrip.get(st.trip_id).push({ seq: Number(st.stop_sequence), name: stationName(st.stop_id), time: toMin(time) });
}

const stations = [];
const stationIdx = new Map();
const idx = name => {
  if (!stationIdx.has(name)) { stationIdx.set(name, stations.length); stations.push(name); }
  return stationIdx.get(name);
};

const PALETTE = ['#d93a2b', '#1e9e57', '#2563eb', '#0d9488', '#8b5cf6', '#ea7a12', '#b7791f', '#db2777'];
const lines = [];
const out = { util: [], sab: [], dom: [] };

routes.forEach((r, ri) => {
  const rTrips = [...tripMeta.values()].filter(t => t.route_id === r.route_id && timesByTrip.has(t.trip_id));
  if (!rTrips.length) return;
  const seqOf = t => timesByTrip.get(t.trip_id).sort((a, b) => a.seq - b.seq);

  // Viagem representativa (mais paradas) define a ordem das estações do ramal.
  const rep = rTrips.reduce((a, b) => (seqOf(b).length > seqOf(a).length ? b : a));
  const repSeq = seqOf(rep);
  const repDir = rep.direction_id || '0';
  const lineStops = repSeq.map(s => [s.name, Math.round(s.time - repSeq[0].time)]);
  const order = new Map(lineStops.map(([n], i) => [n, i]));

  lines.push({
    id: r.route_id,
    name: r.route_short_name || r.route_long_name || r.route_id,
    color: r.route_color ? '#' + r.route_color : PALETTE[ri % PALETTE.length],
    kind: r.route_long_name && r.route_short_name ? r.route_long_name : 'Ramal',
    stops: lineStops,
  });

  for (const t of rTrips) {
    const seq = seqOf(t);
    let dir;
    if (t.direction_id !== undefined && t.direction_id !== '') dir = t.direction_id === repDir ? 0 : 1;
    else dir = (order.get(seq[0].name) ?? 0) <= (order.get(seq[seq.length - 1].name) ?? 0) ? 0 : 1;
    const row = [t.trip_id, r.route_id, dir, t.trip_headsign || seq[seq.length - 1].name, seq.map(s => [idx(s.name), round1(s.time)])];
    for (const d of servicesOf(t.service_id)) out[d].push(row);
  }
});

const data = {
  generatedAt: new Date().toISOString(),
  source: opt.source || agency.map(a => a.agency_name).filter(Boolean).join(', ') || path.basename(path.resolve(dir)),
  stations,
  lines,
  trips: out,
};

const target = path.join(__dirname, '..', 'gtfs-data.js');
fs.writeFileSync(target, `// Gerado por tools/import-gtfs.js em ${data.generatedAt}. Não editar à mão.\nwindow.GTFS_DATA = ${JSON.stringify(data)};\n`);
console.log(`OK: ${lines.length} ramais, ${stations.length} estações, viagens: útil ${out.util.length}, sábado ${out.sab.length}, domingo ${out.dom.length}`);
console.log(`Arquivo: ${target}`);
