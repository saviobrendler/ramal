// Endereço do servidor de dados. Vazio quando o site é servido pelo próprio Ramal; o plugin do WordPress
// passa ?api=https://seu-servidor/ na URL para usar o servidor externo.
const API_BASE = (() => { try { const u = new URLSearchParams(location.search).get('api'); return u ? u.replace(/\/?$/, '/') : ''; } catch { return ''; } })();
// Ramal — dados dos ramais.
// ATENÇÃO: estações, tempos de viagem e intervalos são APROXIMADOS, para demonstração.
// Antes de publicar, substituir pelo GTFS oficial da operadora / Governo do Estado do RJ.

const DAY_LABELS = { util: 'Dias úteis', sab: 'Sábado', dom: 'Domingo e feriado' };

function hashStr(s) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Gera [estação, minutos desde a origem] com passo médio e pequena variação por trecho.
function sequence(names, step, start = 0) {
  let t = start;
  return names.map((n, i) => {
    if (i > 0) t += step + ((hashStr(n) % 5) - 2) * 0.3;
    return [n, Math.round(t)];
  });
}

const TRONCO = [
  'Central do Brasil', 'São Cristóvão', 'Maracanã', 'Mangueira', 'São Francisco Xavier',
  'Riachuelo', 'Sampaio', 'Engenho Novo', 'Méier', 'Engenho de Dentro', 'Encantado',
  'Piedade', 'Quintino Bocaiúva', 'Cascadura', 'Madureira', 'Oswaldo Cruz',
  'Bento Ribeiro', 'Marechal Hermes', 'Deodoro',
];

// Semidireto Central → Deodoro usado pelos ramais Santa Cruz e Japeri.
const SEMIDIRETO = [
  ['Central do Brasil', 0], ['São Cristóvão', 6], ['Maracanã', 9],
  ['Engenho de Dentro', 18], ['Madureira', 27], ['Deodoro', 35],
];
const viaSemidireto = rest => [...SEMIDIRETO, ...sequence(['Deodoro', ...rest], 3.2, 35).slice(1)];

const LINES = [
  {
    id: 'deodoro', name: 'Deodoro', color: '#d93a2b', kind: 'Parador',
    stops: sequence(TRONCO, 2.7),
    service: {
      util: { first: '04:50', last: '22:40', peak: 10, off: 15 },
      sab: { first: '05:00', last: '22:00', peak: 20, off: 20 },
      dom: { first: '05:30', last: '21:30', peak: 30, off: 30 },
    },
  },
  {
    id: 'santacruz', name: 'Santa Cruz', color: '#1e9e57', kind: 'Semidireto até Deodoro',
    stops: viaSemidireto([
      'Vila Militar', 'Magalhães Bastos', 'Realengo', 'Padre Miguel', 'Guilherme da Silveira',
      'Bangu', 'Senador Camará', 'Santíssimo', 'Augusto Vasconcelos', 'Campo Grande',
      'Benjamin do Monte', 'Inhoaíba', 'Cosmos', 'Paciência', 'Tancredo Neves', 'Santa Cruz',
    ]),
    service: {
      util: { first: '04:30', last: '22:30', peak: 12, off: 20 },
      sab: { first: '04:40', last: '22:00', peak: 30, off: 30 },
      dom: { first: '05:00', last: '21:30', peak: 40, off: 40 },
    },
  },
  {
    id: 'japeri', name: 'Japeri', color: '#2563eb', kind: 'Semidireto até Deodoro',
    stops: viaSemidireto([
      'Ricardo de Albuquerque', 'Anchieta', 'Olinda', 'Nilópolis', 'Edson Passos', 'Mesquita',
      'Presidente Juscelino', 'Nova Iguaçu', 'Comendador Soares', 'Austin', 'Queimados',
      'Engenheiro Pedreira', 'Japeri',
    ]),
    service: {
      util: { first: '04:20', last: '22:30', peak: 12, off: 20 },
      sab: { first: '04:30', last: '22:00', peak: 30, off: 30 },
      dom: { first: '05:00', last: '21:30', peak: 40, off: 40 },
    },
  },
  {
    id: 'paracambi', name: 'Paracambi', color: '#0d9488', kind: 'Extensão a partir de Japeri',
    stops: [['Japeri', 0], ['Lages', 8], ['Paracambi', 15]],
    service: {
      util: { first: '05:00', last: '21:30', peak: 60, off: 60 },
      sab: { first: '06:00', last: '20:00', peak: 90, off: 90 },
      dom: { first: '06:30', last: '19:30', peak: 120, off: 120 },
    },
  },
  {
    id: 'belfordroxo', name: 'Belford Roxo', color: '#8b5cf6', kind: 'Parador',
    stops: sequence([
      'Central do Brasil', 'Triagem', 'Jacarezinho', 'Del Castilho', 'Pilares', 'Tomás Coelho',
      'Cavalcante', 'Magno', 'Mercadão de Madureira', 'Rocha Miranda', 'Honório Gurgel',
      'Barros Filho', 'Costa Barros', 'Pavuna', 'Engenheiro Belford', 'Agostinho Porto',
      'Coelho da Rocha', 'Belford Roxo',
    ], 2.8),
    service: {
      util: { first: '04:40', last: '22:00', peak: 20, off: 30 },
      sab: { first: '05:00', last: '21:00', peak: 40, off: 40 },
      dom: { first: '05:30', last: '20:30', peak: 60, off: 60 },
    },
  },
  {
    id: 'saracuruna', name: 'Saracuruna', color: '#ea7a12', kind: 'Parador',
    stops: sequence([
      'Central do Brasil', 'Manguinhos', 'Bonsucesso', 'Ramos', 'Olaria', 'Penha',
      'Penha Circular', 'Brás de Pina', 'Cordovil', 'Parada de Lucas', 'Vigário Geral',
      'Duque de Caxias', 'Corte Oito', 'Gramacho', 'Campos Elíseos', 'Jardim Primavera',
      'Saracuruna',
    ], 2.9),
    service: {
      util: { first: '04:30', last: '22:20', peak: 12, off: 20 },
      sab: { first: '04:45', last: '21:45', peak: 30, off: 30 },
      dom: { first: '05:15', last: '21:00', peak: 40, off: 40 },
    },
  },
  {
    id: 'inhomirim', name: 'Vila Inhomirim', color: '#b7791f', kind: 'Extensão a partir de Saracuruna',
    stops: sequence(['Saracuruna', 'Parada Angélica', 'Imbariê', 'Piabetá', 'Fragoso', 'Vila Inhomirim'], 4),
    service: {
      util: { first: '05:00', last: '21:00', peak: 60, off: 90 },
      sab: { first: '06:00', last: '19:00', peak: 120, off: 120 },
      dom: { first: '07:00', last: '18:00', peak: 180, off: 180 },
    },
  },
  {
    id: 'guapimirim', name: 'Guapimirim', color: '#db2777', kind: 'Extensão a partir de Saracuruna',
    stops: [['Saracuruna', 0], ['Citrolândia', 14], ['Guapimirim', 28]],
    service: {
      util: { times: ['05:10', '08:30', '16:00', '18:30'] },
      sab: { times: ['06:00', '15:00'] },
    },
  },
];

// Se houver um GTFS importado (gtfs-data.js), ele substitui os ramais de demonstração.
const DATA_MODE = window.GTFS_DATA && window.GTFS_DATA.lines.length ? 'gtfs' : 'simulado';
if (DATA_MODE === 'gtfs') LINES.splice(0, LINES.length, ...window.GTFS_DATA.lines.map(l => ({ ...l, service: {} })));

// Alinha a rede de demonstração aos nomes oficiais (oficial-data.js). Nomes que não existem no site
// da operadora são retirados; a ordem e os tempos continuam aproximados.
const OFFICIAL_ALIAS = {
  'Mangueira': 'Mangueira/Jamelão',
  'Engenho de Dentro': 'Olímpica de Engenho de Dentro',
  'Quintino Bocaiúva': 'Quintino',
  'Bento Ribeiro': 'Prefeito Bento Ribeiro',
  'Padre Miguel': 'Mocidade Padre Miguel',
  'Benjamin do Monte': 'Benjamim do Monte',
  'Cavalcante': 'Cavalcanti',
  'Pavuna': 'Pavuna/São João de Meriti',
  'Corte Oito': 'Corte 8',
};
if (DATA_MODE === 'simulado' && window.OFICIAL && window.OFICIAL.estacoes) {
  const official = new Set(window.OFICIAL.estacoes.map(e => e.nome));
  for (const l of LINES) {
    const seen = new Set();
    l.stops = l.stops
      .map(([n, t]) => [OFFICIAL_ALIAS[n] || n, t])
      .filter(([n]) => official.has(n) && !seen.has(n) && seen.add(n));
  }
  for (const l of LINES.filter(l => l.stops.length < 2)) LINES.splice(LINES.indexOf(l), 1);
}

for (const l of LINES) {
  l.from = l.stops[0][0];
  l.to = l.stops[l.stops.length - 1][0];
}
