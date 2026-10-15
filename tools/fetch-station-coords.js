// Busca as coordenadas das estações de trem no OpenStreetMap (Overpass) e grava stations-geo.json.
// Usado pelo servidor para cruzar alertas de segurança com as estações.
//
// Uso: node tools/fetch-station-coords.js
// Dados © colaboradores do OpenStreetMap (ODbL).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['gtfs-data.js', 'oficial-data.js', 'data.js']) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx);
}
const LINES = vm.runInContext('LINES', ctx);
const wanted = [...new Set(LINES.flatMap(l => l.stops.map(s => s[0])))];

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^esta[cç][aã]o\s+/, '').replace(/\s+/g, ' ').trim();

const query = '[out:json][timeout:90];(node["railway"="station"](-23.1,-44.0,-22.3,-42.8);node["railway"="halt"](-23.1,-44.0,-22.3,-42.8););out body;';

(async () => {
  const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  let elements;
  for (const url of mirrors) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ramal-app/0.3 (projeto independente)' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ({ elements } = await res.json());
      break;
    } catch (e) { console.warn(`${url}: ${e.message}`); }
  }
  if (!elements) throw new Error('nenhum servidor Overpass respondeu');

  // Prefere estações de trem (não metrô/VLT) quando há nomes repetidos.
  const score = e => (/(metr[oô]|vlt|brt)/i.test(`${e.tags.network || ''} ${e.tags.operator || ''} ${e.tags.station || ''}`) ? 0 : 1);
  const byName = new Map();
  for (const e of elements) {
    if (!e.tags || !e.tags.name) continue;
    const k = norm(e.tags.name);
    if (!byName.has(k) || score(e) > score(byName.get(k))) byName.set(k, e);
  }

  const out = {}, missing = [];
  for (const name of wanted) {
    const k = norm(name);
    // Exato; senão, nome do OSM que contém o nosso (ex.: "Mangueira - Jamelão").
    const e = byName.get(k) || [...byName].filter(([n]) => n.includes(k)).map(([, v]) => v).sort((a, b) => score(b) - score(a))[0];
    if (e) out[name] = [Number(e.lat.toFixed(5)), Number(e.lon.toFixed(5))];
    else missing.push(name);
  }
  fs.writeFileSync(path.join(root, 'stations-geo.json'), JSON.stringify(out, null, 1));
  console.log(`${Object.keys(out).length}/${wanted.length} estações com coordenadas.`);
  if (missing.length) console.log('Sem correspondência (edite stations-geo.json à mão):', missing.join(', '));
})().catch(e => { console.error('Falhou:', e.message); process.exit(1); });
