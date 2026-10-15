// Gera um GTFS de TESTE (sample-gtfs/) a partir dos dados de demonstração, mais um
// feed de tempo real de teste (sample-realtime.json). Serve só para testar o importador
// e o servidor enquanto não há um GTFS oficial. Não são dados reais.
//
// Uso: node tools/make-sample-gtfs.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['data.js', 'schedule.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const { LINES, tripsFor } = vm.runInContext('({ LINES, tripsFor })', ctx);

const csv = rows => rows.map(r => r.map(v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n') + '\n';
const hms = m => { const s = Math.round(m * 60); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':'); };

const out = path.join(root, 'sample-gtfs');
fs.mkdirSync(out, { recursive: true });

const stationIds = new Map();
const sid = name => {
  if (!stationIds.has(name)) stationIds.set(name, 'S' + String(stationIds.size + 1).padStart(3, '0'));
  return stationIds.get(name);
};

const trips = [['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id']];
const stopTimes = [['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence']];
for (const dt of ['util', 'sab', 'dom']) {
  for (const t of tripsFor(dt)) {
    trips.push([t.line.id, dt.toUpperCase(), t.id, t.dest, t.dir]);
    t.stops.forEach((s, i) => stopTimes.push([t.id, hms(s.time), hms(s.time), sid(s.name), i + 1]));
  }
}

fs.writeFileSync(path.join(out, 'agency.txt'), csv([['agency_id', 'agency_name', 'agency_url', 'agency_timezone'], ['TESTE', 'GTFS de teste (gerado localmente)', 'http://localhost', 'America/Sao_Paulo']]));
fs.writeFileSync(path.join(out, 'routes.txt'), csv([['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color'],
  ...LINES.map(l => [l.id, 'TESTE', l.name, l.kind, 2, l.color.slice(1)])]));
fs.writeFileSync(path.join(out, 'stops.txt'), csv([['stop_id', 'stop_name'], ...[...stationIds].map(([n, id]) => [id, n])]));
fs.writeFileSync(path.join(out, 'calendar.txt'), csv([
  ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
  ['UTIL', 1, 1, 1, 1, 1, 0, 0, '20260101', '20271231'],
  ['SAB', 0, 0, 0, 0, 0, 1, 0, '20260101', '20271231'],
  ['DOM', 0, 0, 0, 0, 0, 0, 1, '20260101', '20271231'],
]));
fs.writeFileSync(path.join(out, 'trips.txt'), csv(trips));
fs.writeFileSync(path.join(out, 'stop_times.txt'), csv(stopTimes));

// Tempo real de teste: atraso em segundos para algumas viagens de hoje.
const delays = {};
for (const t of tripsFor('util').concat(tripsFor('sab'), tripsFor('dom'))) if (t.simDelay) delays[t.id] = t.simDelay * 60 + 30;
fs.writeFileSync(path.join(root, 'sample-realtime.json'), JSON.stringify({ delays }, null, 0));

console.log(`GTFS de teste em ${out}: ${trips.length - 1} viagens, ${stationIds.size} estações`);
console.log(`Tempo real de teste: sample-realtime.json (${Object.keys(delays).length} viagens com atraso)`);
