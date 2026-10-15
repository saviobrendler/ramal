// Coleta os dados PÚBLICOS das páginas de estações do site da TrensRJ (trensrj.com.br) e grava
// data/trensrj-oficial.json: ramais de cada estação, horário de funcionamento, primeiro e último
// trem por sentido e tipo de dia, e serviços (elevador, escada rolante, banheiro...).
//
// Respeita o robots.txt (Allow: /), identifica o projeto no User-Agent e espera 1,2 s entre páginas.
// Só lê as páginas públicas que qualquer visitante vê; não usa APIs internas do site.
//
// Uso: node tools/fetch-trensrj.js            (coleta tudo)
//      node tools/fetch-trensrj.js --only=madureira,central-do-brasil   (teste)

const fs = require('fs');
const path = require('path');

const BASE = 'https://trensrj.com.br';
const INDEX = `${BASE}/pt/conheca-as-estacoes`;
const OUT = path.join(__dirname, '..', 'data', 'trensrj-oficial.json');
const UA = 'Ramal-app/0.4 (projeto independente; leitura de horarios publicos)';
const DELAY_MS = 1200;
const LINE_NAMES = ['Deodoro', 'Santa Cruz', 'Japeri', 'Belford Roxo', 'Saracuruna', 'Paracambi', 'Vila Inhomirim', 'Guapimirim'];
const SERVICES = ['Elevador', 'Escada rolante', 'Bicicletário', 'Caixa eletrônico', 'Wi-Fi', 'Banheiro'];
const DAY = { WEEKDAY: 'util', SATURDAY: 'sab', SUNDAY: 'dom' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(3000 * attempt);
    }
  }
}

// Texto visível, uma linha por bloco.
function textLines(html) {
  return decode(html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n'))
    .split('\n').map(s => s.trim()).filter(Boolean);
}

function parseIndex(html) {
  const slugs = [...new Set([...html.matchAll(/\/pt\/conheca-as-estacoes\/([a-z0-9-]+)/g)].map(m => m[1]))];
  return slugs.filter(s => s !== 'conheca-as-estacoes');
}

function parseStation(slug, html) {
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || slug;
  const name = decode(title.split('|')[0]).trim();
  const lines = textLines(html);

  // Ramais atendidos: nomes de ramal entre o título da seção e "Endereço".
  const a = lines.indexOf('Ramais atendidos');
  const e = lines.indexOf('Endereço', a + 1);
  const ramais = a >= 0 ? lines.slice(a + 1, e > a ? e : a + 6).filter(l => LINE_NAMES.includes(l)) : [];

  // Horário de funcionamento: rótulo seguido de dois horários.
  // O intervalo vem como "04:00", "–", "22:45" (o traço é um bloco separado no HTML).
  const hours = {};
  const h = lines.indexOf('Horários de funcionamento');
  if (h >= 0) {
    for (let i = h; i < Math.min(lines.length, h + 20); i++) {
      const key = { 'Dias úteis': 'util', 'Sábado': 'sab', 'Domingo e feriados': 'dom' }[lines[i]];
      if (!key) continue;
      const times = lines.slice(i + 1, i + 4).filter(l => /^\d\d:\d\d$/.test(l));
      if (times.length === 2) hours[key] = times;
    }
  }

  // Primeiro e último trem por sentido e tipo de dia (dados embutidos na página).
  const trains = [];
  const re = /destinationLabel\\?":\\?"([^"\\]+)\\?"[^}]*?dayType\\?":\\?"(WEEKDAY|SATURDAY|SUNDAY)\\?"[^}]*?firstTrain\\?":\\?"(\d\d:\d\d)\\?"[^}]*?lastTrain\\?":\\?"(\d\d:\d\d)\\?"/g;
  for (const m of html.matchAll(re)) {
    trains.push({ para: decode(m[1]), dia: DAY[m[2]], primeiro: m[3], ultimo: m[4] });
  }

  // Serviços: só os itens renderizados na lista (não as traduções do código).
  const services = [...new Set([...html.matchAll(/class="text-sm">([^<]+)<\/span>/g)].map(m => decode(m[1])))]
    .filter(s => SERVICES.includes(s));

  return { slug, nome: name, ramais, horario: hours, trens: trains, servicos: services };
}

(async () => {
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const indexHtml = await get(INDEX);
  let slugs = parseIndex(indexHtml);
  if (only.length) slugs = slugs.filter(s => only.includes(s));
  console.log(`${slugs.length} estações para coletar`);

  const stations = [], failed = [];
  for (const [i, slug] of slugs.entries()) {
    try {
      const st = parseStation(slug, await get(`${BASE}/pt/conheca-as-estacoes/${slug}`));
      stations.push(st);
      console.log(`[${i + 1}/${slugs.length}] ${st.nome}: ${st.ramais.join(', ') || '(sem ramal)'} · ${st.trens.length} horários`);
    } catch (err) {
      failed.push(slug);
      console.warn(`[${i + 1}/${slugs.length}] ${slug}: falhou (${err.message})`);
    }
    if (i < slugs.length - 1) await sleep(DELAY_MS);
  }

  const out = {
    fonte: 'TrensRJ — páginas públicas de estações (trensrj.com.br)',
    coletadoEm: new Date().toISOString(),
    observacao: 'Primeiro e último trem por sentido e tipo de dia, como publicados pela operadora. Não há grade trem a trem pública.',
    estacoes: stations,
    falharam: failed,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  // Versão para o site (carregada por <script>, igual ao gtfs-data.js).
  fs.writeFileSync(path.join(__dirname, '..', 'oficial-data.js'),
    `// Gerado por tools/fetch-trensrj.js em ${out.coletadoEm}. Fonte: ${out.fonte}. Não editar à mão.\nwindow.OFICIAL = ${JSON.stringify({ fonte: out.fonte, coletadoEm: out.coletadoEm, estacoes: stations })};\n`);
  console.log(`\nGravado em ${OUT} e oficial-data.js: ${stations.length} estações, ${failed.length} falhas.`);
})().catch(e => { console.error('Falhou:', e.message); process.exit(1); });
