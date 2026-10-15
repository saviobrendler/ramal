// Completa stations-geo.json com as estações da rede que ainda não têm coordenadas.
// Usa as coordenadas já salvas (vindas do OpenStreetMap) e, para as faltantes, o Nominatim
// (geocodificador do OpenStreetMap), com 1,1 s entre consultas e identificação do projeto.
//
// Uso: node tools/geocode-stations.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'stations-geo.json');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['gtfs-data.js', 'oficial-data.js', 'data.js']) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx);
}
const LINES = vm.runInContext('LINES', ctx);
const wanted = [...new Set(LINES.flatMap(l => l.stops.map(s => s[0])))];

// Nomes antigos que ainda existem no arquivo.
const OLD = { 'Mangueira/Jamelão': 'Mangueira', 'Olímpica de Engenho de Dentro': 'Engenho de Dentro', 'Quintino': 'Quintino Bocaiúva',
  'Prefeito Bento Ribeiro': 'Bento Ribeiro', 'Mocidade Padre Miguel': 'Padre Miguel', 'Benjamim do Monte': 'Benjamin do Monte',
  'Cavalcanti': 'Cavalcante', 'Pavuna/São João de Meriti': 'Pavuna', 'Corte 8': 'Corte Oito' };

const geo = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const out = {};
const missing = [];
for (const name of wanted) {
  const have = geo[name] || geo[OLD[name]];
  if (have && inRio(have)) out[name] = have;
  else missing.push(name);
}

function inRio([lat, lon]) { return lat > -23.3 && lat < -22.3 && lon > -44.2 && lon < -42.9; }

(async () => {
  console.log(`${Object.keys(out).length} já com coordenadas; buscando ${missing.length} no Nominatim...`);
  for (const name of missing) {
    const q = encodeURIComponent(`Estação ${name}, Rio de Janeiro, Brasil`);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=3&countrycodes=br`, {
        headers: { 'User-Agent': 'Ramal-app/0.6 (projeto independente; uso pontual)', 'Accept-Language': 'pt-BR' },
        signal: AbortSignal.timeout(30000),
      });
      const hits = await res.json();
      const best = hits.find(h => inRio([Number(h.lat), Number(h.lon)]));
      if (best) { out[name] = [Number(Number(best.lat).toFixed(5)), Number(Number(best.lon).toFixed(5))]; console.log(`  ok  ${name}`); }
      else console.log(`  --  ${name} (sem resultado no Rio)`);
    } catch (e) { console.log(`  erro ${name}: ${e.message}`); }
    await new Promise(r => setTimeout(r, 1100));
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const still = wanted.filter(n => !out[n]);
  console.log(`\nGravado: ${Object.keys(out).length}/${wanted.length} estações.`);
  if (still.length) console.log('Sem coordenadas (ajuste à mão em stations-geo.json):', still.join(', '));
})();
