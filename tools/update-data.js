// Atualiza os dados públicos em um comando: estações e horários oficiais (site da TrensRJ)
// e, se faltarem, as coordenadas das estações (OpenStreetMap).
//
// Uso: npm run update-data
// Rode uma vez por semana ou quando a operadora mudar os horários. Depois reinicie o servidor
// (o site lê oficial-data.js, então um recarregamento da página basta para o navegador).

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const run = script => {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) { console.error(`${script} falhou (código ${r.status}).`); process.exit(r.status || 1); }
};

run('fetch-trensrj.js');

if (!fs.existsSync(path.join(root, 'stations-geo.json'))) {
  console.log('\nstations-geo.json não existe: buscando coordenadas no OpenStreetMap...');
  run('fetch-station-coords.js');
}

const off = JSON.parse(fs.readFileSync(path.join(root, 'data', 'trensrj-oficial.json'), 'utf8'));
console.log(`\nDados atualizados em ${new Date(off.coletadoEm).toLocaleString('pt-BR')}: ${off.estacoes.length} estações, ${off.falharam.length} falhas.`);
