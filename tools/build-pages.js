// Gera uma página HTML por estação (estacao/<slug>.html) com o horário escrito no texto, para o
// Google e outros buscadores indexarem. Também gera sitemap.xml e robots.txt.
//
// Usa data/trensrj-oficial.json (coletado por tools/fetch-trensrj.js). Rode depois de atualizar os dados:
//   node tools/build-pages.js

const fs = require('fs');
const path = require('path');

const BASE = 'https://ramal-l9ye.onrender.com';
const DIA = { util: 'dias úteis', sab: 'sábado', dom: 'domingo e feriados' };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function tableFor(station, dia) {
  const rows = station.trens.filter(t => t.dia === dia);
  if (!rows.length) return '<p>Sem horário publicado para este tipo de dia.</p>';
  return `<table><thead><tr><th>Sentido</th><th>Primeiro trem</th><th>Último trem</th></tr></thead><tbody>${
    rows.map(r => `<tr><td>Para ${esc(r.para)}</td><td>${esc(r.primeiro)}</td><td>${esc(r.ultimo)}</td></tr>`).join('')
  }</tbody></table>`;
}

function buildStationPage(st, coletadoEm) {
  const h = st.horario || {};
  const hours = Object.keys(DIA).map(k => h[k] ? `<li><b>${DIA[k][0].toUpperCase() + DIA[k].slice(1)}:</b> ${esc(h[k][0])} às ${esc(h[k][1])}</li>` : '').join('');
  const ramais = st.ramais.length ? st.ramais.map(esc).join(', ') : 'não informado';
  const servicos = st.servicos.length ? st.servicos.map(esc).join(', ') : 'nenhum listado pela operadora';
  const title = `Horário do trem em ${st.nome} — próximos trens | Ramal`;
  const desc = `Primeiro e último trem em ${st.nome}, ramais ${ramais}, funcionamento e serviços. Dados publicados pela TrensRJ.`;
  const url = `${BASE}/estacao/${st.slug}.html`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <link rel="icon" href="../icons/icon.svg">
  <style>
    body { margin: 0; font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #14202b; background: #f5f6f8; }
    main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
    h1 { font-size: 28px; letter-spacing: -.02em; margin: 6px 0 8px; }
    h2 { font-size: 19px; margin: 26px 0 8px; }
    section { background: #fff; border: 1px solid #e4e7ec; border-radius: 16px; padding: 16px 18px; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 15px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eef1f5; }
    ul { padding-left: 20px; margin: 6px 0; }
    a { color: #1f4fe0; font-weight: 600; }
    .cta { display: inline-block; margin-top: 16px; padding: 12px 18px; border-radius: 12px; background: #1f4fe0; color: #fff; text-decoration: none; }
    .note { color: #566073; font-size: 14px; }
    @media (prefers-color-scheme: dark) { body { background: #0b0f17; color: #eef1f6; } section { background: #141a24; border-color: #232b3a; } th, td { border-color: #232b3a; } .note { color: #aab3c2; } }
  </style>
</head>
<body>
  <main>
    <a href="../index.html">← Ramal</a>
    <h1>Horário do trem em ${esc(st.nome)}</h1>
    <p>Ramais que atendem a estação: <b>${ramais}</b>.</p>

    <section>
      <h2>Funcionamento</h2>
      <ul>${hours || '<li>Sem horário de funcionamento publicado.</li>'}</ul>
    </section>

    <section>
      <h2>Primeiro e último trem — dias úteis</h2>
      ${tableFor(st, 'util')}
      <h2>Sábado</h2>
      ${tableFor(st, 'sab')}
      <h2>Domingo e feriados</h2>
      ${tableFor(st, 'dom')}
      <p class="note">Estes são os primeiro e último trem publicados pela operadora. Os horários entre eles não são publicados e aparecem como estimados no app.</p>
    </section>

    <section>
      <h2>Serviços</h2>
      <p>${servicos}.</p>
    </section>

    <a class="cta" href="../index.html#/estacao/${encodeURIComponent(st.nome)}">Ver os próximos trens nesta estação</a>

    <p class="note">Fonte: <a href="https://trensrj.com.br/pt/conheca-as-estacoes/${esc(st.slug)}" rel="nofollow noopener">página da estação no site da TrensRJ</a> (coletado em ${new Date(coletadoEm).toLocaleDateString('pt-BR')}). Ramal é um projeto independente, sem vínculo com a operadora dos trens nem com o Governo do Estado.</p>
  </main>
</body>
</html>
`;
}

function buildSitemap(stations) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`${BASE}/`, ...stations.map(s => `${BASE}/estacao/${s.slug}.html`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

const ROBOTS = `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`;

function main(root = path.join(__dirname, '..')) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'trensrj-oficial.json'), 'utf8'));
  const dir = path.join(root, 'estacao');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) fs.rmSync(path.join(dir, f));
  for (const st of data.estacoes) fs.writeFileSync(path.join(dir, `${st.slug}.html`), buildStationPage(st, data.coletadoEm));
  fs.writeFileSync(path.join(root, 'sitemap.xml'), buildSitemap(data.estacoes));
  fs.writeFileSync(path.join(root, 'robots.txt'), ROBOTS);
  console.log(`${data.estacoes.length} páginas em estacao/, sitemap.xml e robots.txt gerados.`);
}

module.exports = { buildStationPage, buildSitemap, ROBOTS, BASE };

if (require.main === module) main();
