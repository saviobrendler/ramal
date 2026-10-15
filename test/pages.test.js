// Testes das páginas por estação (SEO). Rodar: npm test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildStationPage, buildSitemap, BASE } = require('../tools/build-pages');

const ST = {
  slug: 'madureira', nome: 'Madureira', ramais: ['Deodoro', 'Santa Cruz'],
  horario: { util: ['04:30', '23:15'], sab: ['05:00', '21:45'] },
  trens: [{ para: 'Japeri', dia: 'util', primeiro: '04:39', ultimo: '23:32' }],
  servicos: ['Elevador', 'Banheiro'],
};

test('página da estação traz o horário escrito no texto e a canônica', () => {
  const html = buildStationPage(ST, '2026-10-15T12:00:00Z');
  assert.match(html, /<h1>Horário do trem em Madureira<\/h1>/);
  assert.match(html, /<td>Para Japeri<\/td><td>04:39<\/td><td>23:32<\/td>/);
  assert.match(html, /rel="canonical" href="https:\/\/ramal-l9ye\.onrender\.com\/estacao\/madureira\.html"/);
  assert.match(html, /Elevador, Banheiro/);
});

test('escapa caracteres perigosos do nome da estação', () => {
  const html = buildStationPage({ ...ST, nome: 'X <script>alert(1)</script>' }, '2026-10-15T12:00:00Z');
  assert.ok(!html.includes('<script>alert'));
});

test('sitemap lista a home e cada estação', () => {
  const xml = buildSitemap([ST, { ...ST, slug: 'deodoro' }]);
  assert.equal((xml.match(/<loc>/g) || []).length, 3);
  assert.ok(xml.includes(`${BASE}/estacao/deodoro.html`));
});
