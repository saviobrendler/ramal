// Ramal — interface v2. Cinco telas, sempre a um toque da barra inferior:
//   Início (busca + próximos trens da sua estação) · Rotas · Linhas · Avisos
// Telas de detalhe: Estação (Próximos, Horários, Serviços) e Linha.

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const store = {
  get(k, d) { try { const v = localStorage.getItem('ramal.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ramal.' + k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
};

const svg = (d, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  home: svg('<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>'),
  route: svg('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>'),
  lines: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  star: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  chev: svg('<path d="m9 6 6 6-6 6"/>'),
  chevDown: svg('<path d="m6 9 6 6 6-6"/>', 'ico route-chev'),
  back: svg('<path d="m15 6-6 6 6 6"/>'),
  transfer: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  megaphone: svg('<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  stop: svg('<circle cx="12" cy="12" r="9"/><path d="M9 9v6M15 9v6"/>'),
  shield: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M12 9v4M12 16h.01"/>'),
  alert: svg('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'),
  people: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>'),
  snow: svg('<path d="M12 2v20M4 7l16 10M20 7 4 17"/>'),
  elevator: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 9 3-3 3 3M9 15l3 3 3-3"/>'),
  stairs: svg('<path d="M3 20h5v-5h5v-5h5V5h3"/>'),
  ramp: svg('<path d="M3 19h18L3 9z"/>'),
  gap: svg('<path d="M3 15h7M14 15h7M10 11v8M14 11v8"/>'),
  wifiOff: svg('<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.8M19 13a10 10 0 0 0-2.4-1.8M2 8.8a15 15 0 0 1 4.3-2.6M22 8.8A15 15 0 0 0 10.7 5"/><circle cx="12" cy="20" r="1"/>'),
  swap: svg('<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/>'),
  people2: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'),
};

// As cinco telas da barra. "estacao" e "linha" são detalhes: destacam a aba de onde vieram.
const TABS = [
  { id: 'inicio', label: 'Início', icon: ICON.home, hash: '#/' },
  { id: 'rota', label: 'Rotas', icon: ICON.route, hash: '#/rota' },
  { id: 'linhas', label: 'Linhas', icon: ICON.lines, hash: '#/linhas' },
  { id: 'avisos', label: 'Avisos', icon: ICON.bell, hash: '#/avisos' },
];

const ALL_STATIONS = [...new Set(LINES.flatMap(l => l.stops.map(s => s[0])))].sort((a, b) => a.localeCompare(b, 'pt'));
const STATION_LINES = new Map(ALL_STATIONS.map(n => [n, LINES.filter(l => l.stops.some(s => s[0] === n))]));
const linesAt = name => STATION_LINES.get(name) || [];
const isStation = name => STATION_LINES.has(name);
const lineById = id => LINES.find(l => l.id === id);
const badge = line => `<span class="badge" style="--c:${line.color}">${esc(line.name)}</span>`;
const dots = name => linesAt(name).map(l => `<i style="--c:${l.color}" title="${esc(l.name)}"></i>`).join('');
const dur = m => { m = Math.round(m); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };
const inText = d => (d < 1 ? 'agora' : d < 60 ? `em ${Math.floor(d)} min` : `em ${dur(d)}`);
const DIA_LABEL = { util: 'dias úteis', sab: 'sábado', dom: 'domingo e feriados' };
const DIA_SHORT = { util: 'Dias úteis', sab: 'Sábado', dom: 'Domingo' };
const ACESS = [
  { item: 'elevador', icon: ICON.elevator, name: 'Elevador', yes: 'Funcionando', no: 'Quebrado' },
  { item: 'escada', icon: ICON.stairs, name: 'Escada rolante', yes: 'Funcionando', no: 'Quebrada' },
  { item: 'rampa', icon: ICON.ramp, name: 'Rampa de acesso', yes: 'Tem', no: 'Não tem' },
  { item: 'vao', icon: ICON.gap, name: 'Vão entre trem e plataforma', yes: 'Pequeno', no: 'Grande' },
];
const ALERT_KIND = {
  seguranca: { icon: ICON.shield, cls: 'danger', label: 'Segurança' },
  paralisacao: { icon: ICON.stop, cls: 'warn', label: 'Circulação' },
  aviso: { icon: ICON.alert, cls: 'info', label: 'Aviso' },
};
const ZONE = { frente: 'Frente', meio: 'Meio', fundo: 'Fundo' };

// ---------- Estado (salvo no aparelho) ----------

const state = {
  station: isStation(store.get('station', '')) ? store.get('station') : 'Central do Brasil',
  favs: store.get('favs', []).filter(isStation),
  recents: store.get('recents', []).filter(isStation),
  plan: { from: store.get('from', null), to: store.get('to', null), when: 'now', open: -1 },
  line: null,          // tela de linha
  lineDir: 0,
  lineDay: null,
  stTab: 'proximos',   // aba da tela de estação
  times: { line: null, dir: 0, day: null, showPast: false },
  punctDays: 30,
};

function remember(name) {
  state.recents = [name, ...state.recents.filter(n => n !== name)].slice(0, 8);
  store.set('recents', state.recents);
}

// ---------- Roteamento ----------

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [seg, ...rest] = path.split('/');
  return { seg: seg || 'inicio', arg: decodeURIComponent(rest.join('/') || ''), params: new URLSearchParams(query) };
}

const VIEWS = ['inicio', 'rota', 'linhas', 'linha', 'estacao', 'avisos'];
const NAV_OF = { inicio: 'inicio', rota: 'rota', linhas: 'linhas', linha: 'linhas', estacao: 'inicio', avisos: 'avisos' };
let lastSeg = null;

function go(hash) { location.hash = hash; }

function route() {
  const { seg, arg } = parseHash();
  const view = VIEWS.includes(seg) ? seg : 'inicio';
  if (view === 'linha') { const l = lineById(arg); if (!l) return go('#/linhas'); state.line = l.id; }
  if (view === 'estacao') { if (!isStation(arg)) return go('#/'); state.station = arg; store.set('station', arg); remember(arg); }
  if (view !== lastSeg) window.scrollTo(0, 0);
  lastSeg = view;
  for (const v of VIEWS) $(`#v-${v}`).hidden = v !== view;
  $$('[data-tab]').forEach(a => {
    const on = a.dataset.tab === NAV_OF[view];
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  render();
}
window.addEventListener('hashchange', route);

for (const nav of $$('[data-nav]')) {
  nav.innerHTML = TABS.map(t => `<a href="${t.hash}" data-tab="${t.id}">${t.icon}<span>${t.label}</span></a>`).join('');
}

function render() {
  renderStatus();
  const { seg, arg } = parseHash();
  const view = VIEWS.includes(seg) ? seg : 'inicio';
  if (view === 'inicio') renderInicio();
  if (view === 'rota') renderRota();
  if (view === 'linhas') renderLinhas();
  if (view === 'linha') renderLinha();
  if (view === 'estacao') renderEstacao();
  if (view === 'avisos') renderAvisos();
  renderAlertBadge();
}

function renderAlertBadge() {
  const n = (COMM.overview?.alerts || []).length;
  $$('[data-tab="avisos"]').forEach(a => {
    let b = $('.tab-badge', a);
    if (!n) { b && b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'tab-badge'; a.appendChild(b); }
    b.textContent = n;
  });
}

// ---------- Status dos dados ----------

function dataStatus() {
  if (!navigator.onLine) return { cls: 'plain', text: 'Offline' };
  if (REALTIME.active) return { cls: 'live', text: 'Ao vivo' };
  if (DATA_MODE === 'gtfs') return { cls: 'plain', text: 'Programado' };
  return { cls: '', text: 'Horários oficiais' };
}

function renderStatus() {
  const s = dataStatus();
  $('#status').className = 'status ' + s.cls;
  $('#status-text').textContent = s.text;
}

$('#status').addEventListener('click', () => {
  const rows = [];
  if (!navigator.onLine) rows.push(['plain', 'Você está sem internet', 'Horários e rotas continuam funcionando. Relatos ficam guardados e são enviados depois.']);
  if (window.OFICIAL) rows.push(['ok', 'Estações e primeiro/último trem', `Vêm do site da TrensRJ (coletados em ${new Date(window.OFICIAL.coletadoEm).toLocaleDateString('pt-BR')}).`]);
  rows.push(REALTIME.active
    ? ['ok', 'Tempo real ativo', `${REALTIME.source ? esc(REALTIME.source) + '. ' : ''}Atualizado às ${new Date(REALTIME.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`]
    : ['plain', 'Sem tempo real', 'A operadora não publica posição dos trens. Os intervalos entre trens são estimados.']);
  rows.push(['plain', 'Relatos de passageiros', 'Lotação, vagão, acessibilidade e atrasos vêm de relatos anônimos feitos no próprio app.']);
  $('#info-body').innerHTML = rows.map(([c, t, d]) => `<div class="info-row ${c}"><span class="status-dot"></span><div><b>${t}</b>${d}</div></div>`).join('') +
    '<p>Ramal é um projeto independente, sem vínculo com a operadora dos trens nem com o Governo do Estado.</p>';
  $('#info').showModal();
});

// ---------- Folhas e aviso rápido ----------

for (const d of $$('dialog')) {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

let actionHandler = null;
function openAction(title, html, onAction) {
  $('#action-title').textContent = title;
  $('#action-body').innerHTML = html;
  actionHandler = onAction;
  $('#action').showModal();
}
$('#action-body').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b || !actionHandler) return;
  b.disabled = true;
  await actionHandler(b.dataset.act, b);
  b.disabled = false;
});

// Escolha de estação (usada no início, na rota e na busca).
const picker = $('#picker');
let onPick = null;

function openPicker(title, cb) {
  onPick = cb;
  $('#picker-title').textContent = title;
  $('#picker-q').value = '';
  renderPicker();
  picker.showModal();
  if (matchMedia('(pointer: fine)').matches) $('#picker-q').focus();
}

function highlight(name, q) {
  if (!q) return esc(name);
  const i = norm(name).indexOf(q);
  if (i < 0) return esc(name);
  return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
}

function renderPicker() {
  const q = norm($('#picker-q').value.trim());
  const item = (n, cls = '') => `<button class="pick ${cls}" type="button" data-st="${esc(n)}">
    <span class="pick-name">${highlight(n, q)}</span><span class="dots">${dots(n)}</span></button>`;
  let html = '';
  if (!q) {
    const section = (title, names) => (names.length ? `<h3>${title}</h3>` + names.map(n => item(n)).join('') : '');
    html += section('Favoritas', state.favs);
    html += section('Recentes', state.recents.filter(n => !state.favs.includes(n)).slice(0, 5));
    html += section('Todas as estações', ALL_STATIONS);
  } else {
    const hits = ALL_STATIONS.filter(n => norm(n).includes(q))
      .sort((a, b) => (norm(a).startsWith(q) ? 0 : 1) - (norm(b).startsWith(q) ? 0 : 1) || a.localeCompare(b, 'pt'));
    html = hits.length ? hits.map((n, i) => item(n, i === 0 ? 'first-hit' : '')).join('') : '<p class="empty-sm">Nenhuma estação encontrada.</p>';
  }
  $('#picker-list').innerHTML = html;
}

$('#picker-q').addEventListener('input', renderPicker);
$('#picker-q').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const first = $('.pick', $('#picker-list')); if (first) { e.preventDefault(); first.click(); } }
  if (e.key === 'ArrowDown') { e.preventDefault(); $('.pick', $('#picker-list'))?.focus(); }
});
$('#picker-list').addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = $$('.pick', $('#picker-list')), i = items.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const next = items[i + (e.key === 'ArrowDown' ? 1 : -1)];
  next ? next.focus() : $('#picker-q').focus();
});
$('#picker-list').addEventListener('click', e => {
  const b = e.target.closest('[data-st]');
  if (!b) return;
  const name = b.dataset.st;
  remember(name);
  picker.close();
  onPick && onPick(name);
});

async function submit(report, okMsg = 'Obrigado! Seu relato ajuda outros passageiros.') {
  const r = await sendReport(report);
  $('#action').close();
  if (!r.ok) return toast(r.error);
  toast(r.queued ? 'Sem internet: o relato será enviado quando a conexão voltar.' : okMsg);
  if (!r.queued) { await loadStation(report.station, dayTypeOf(spNow()), true); render(); }
}

// Relatar: primeiro escolhe a linha e o sentido na estação; depois o tipo de relato.
function openReportPicker(station) {
  const opts = linesAt(station).flatMap(l => arrivingDirs(l, station).map(d => ({ l, d })));
  if (!opts.length) return toast('Nenhum ramal para relatar nesta estação.');
  openAction(`Relatar em ${station}`, `
    <p class="action-sub">Escolha o trem que você viu</p>
    ${opts.map(({ l, d }) => `<button class="action-row" type="button" data-act="${l.id}|${d}">${badge(l)}<span><b>para ${esc(destOf(l, d))}</b></span></button>`).join('')}`,
  async act => { const [id, d] = act.split('|'); $('#action').close(); openReport(lineById(id), Number(d), station); });
}

function openReport(line, dir, station) {
  const st = station || state.station;
  openAction(`${line.name} para ${destOf(line, dir)}`, `
    <p class="action-sub">Em ${esc(st)}, agora</p>
    <button class="action-row" type="button" data-act="passou">${ICON.check}<span><b>O trem passou agora</b><small>Ajuda a medir atrasos</small></span></button>
    <div class="action-label">Como está a lotação?</div>
    <div class="crowd-pick">${[1, 2, 3, 4].map(v => `<button type="button" data-act="lot${v}">${meter(v)}<span>${CROWD_NOW[v]}</span></button>`).join('')}</div>
    <button class="action-row" type="button" data-act="parado">${ICON.stop}<span><b>Trem parado</b><small>Parado entre estações ou sem circular</small></span></button>
    <button class="action-row" type="button" data-act="ar">${ICON.snow}<span><b>Ar-condicionado quebrado</b></span></button>`,
  async act => {
    const base = { station: st, line: line.id, dir };
    if (act === 'passou') {
      const now = spNow();
      const delay = estimateDelay(line.id, dir, st, minutesOf(now), dayTypeOf(now));
      if (delay == null) { $('#action').close(); return toast('Não há trem programado para agora neste sentido.'); }
      return submit({ ...base, type: 'passou', value: Math.max(-5, Math.min(90, delay)) });
    }
    if (act.startsWith('lot')) return submit({ ...base, type: 'lotacao', value: Number(act.slice(3)) });
    return submit({ ...base, type: act });
  });
}

// ---------- Horários e rotas (helpers) ----------

// Primeiro e último trem oficiais desta estação para o destino, no tipo de dia.
function officialLine(station, dest, dayType) {
  const st = officialStation(station);
  if (!st) return null;
  const rows = st.trens.filter(t => t.para === dest && t.dia === dayType);
  return rows.length ? { first: rows.map(r => r.primeiro).sort()[0], last: rows.map(r => r.ultimo).sort().at(-1) } : null;
}

function statusTag(it) {
  if (it.trip.delay) return `<span class="tag late">+${it.trip.delay} min</span>`;
  if (it.trip.rt || DATA_MODE === 'simulado') return '<span class="tag ok">No horário</span>';
  return '<span class="tag plain">Programado</span>';
}

function lineSummary(line, dt) {
  const deps = tripsFor(dt).filter(t => t.line === line && t.dir === 0).map(t => t.stops[0].time).sort((a, b) => a - b);
  if (!deps.length) return null;
  return { first: deps[0], last: deps[deps.length - 1], count: deps.length };
}

function alertsFor2({ lines = [], stations = [] }) {
  return (COMM.overview?.alerts || []).filter(a =>
    (a.stations || []).some(s => stations.includes(s)) || (a.lines || []).some(l => lines.includes(l)));
}

const ago = iso => {
  if (!iso) return '';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60e3);
  return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.floor(min / 60)} h` : `há ${Math.floor(min / 1440)} d`;
};

function alertCard(a) {
  const k = ALERT_KIND[a.kind] || ALERT_KIND.aviso;
  const lines = (a.lines || []).map(lineById).filter(Boolean);
  return `<article class="alert ${k.cls}">
    <span class="alert-ico">${k.icon}</span>
    <div><b>${esc(a.title)}</b><p>${esc(a.detail || '')}</p>
      <span class="alert-meta">${lines.map(badge).join('')}<span>${esc(a.source || '')}${a.at ? ` · ${ago(a.at)}` : ''}</span></span></div>
  </article>`;
}

// ---------- Tela: Início ----------

function renderInicio() {
  const el = $('#v-inicio');
  const now = spNow(), m = minutesOf(now), dt = dayTypeOf(now);
  const st = state.station;
  const next = departures(st, m, dt, 4)
    .flatMap(g => g.items.map(it => ({ ...it, g })))
    .sort((a, b) => a.eta - b.eta).slice(0, 5);
  const alerts = (COMM.overview?.alerts || []).slice(0, 2);
  const fav = state.favs.includes(st);

  el.innerHTML = `
    <h1 class="sr-only">Início</h1>
    <button class="hero-search" id="go-rota" type="button">${ICON.search}<span>Para onde você vai?</span></button>

    <section class="card station-card" aria-labelledby="st-title">
      <div class="station-card-head">
        <button class="station-pick" id="home-pick" type="button" aria-haspopup="dialog">
          <span class="eyebrow">Sua estação</span>
          <span class="station-name">${esc(st)}</span>
          <span class="dots">${dots(st)}</span>
        </button>
        <button class="icon-btn" id="home-fav" type="button" aria-pressed="${fav}" aria-label="${fav ? 'Remover dos favoritos' : 'Salvar como favorita'}">${fav ? ICON.star : ICON.star}</button>
      </div>
      ${next.length ? `<ol class="next-list">${next.map(it => nextRow(it, m, st, dt)).join('')}</ol>`
        : `<div class="empty-inline">${ICON.clock}<span>Sem mais trens hoje nesta estação.</span></div>`}
      <a class="card-link" href="#/estacao/${encodeURIComponent(st)}">Ver tudo desta estação ${ICON.chev}</a>
    </section>

    ${alerts.length ? `<section class="block">
      <div class="section-head"><h2>Avisos agora</h2><a href="#/avisos">Ver todos</a></div>
      <div class="alert-list">${alerts.map(alertCard).join('')}</div></section>` : ''}

    <section class="block">
      <div class="section-head"><h2>Linhas</h2><a href="#/linhas">Ver todas</a></div>
      <div class="chips-scroll">${LINES.map(l => `<a class="lchip" href="#/linha/${l.id}" style="--c:${l.color}"><i></i>${esc(l.name)}</a>`).join('')}</div>
    </section>`;

  $('#go-rota', el).onclick = () => go('#/rota');
  $('#home-pick', el).onclick = () => openPicker('Sua estação', n => { state.station = n; store.set('station', n); remember(n); renderInicio(); });
  $('#home-fav', el).onclick = () => toggleFav(st);
}

// Texto do tempo até o trem: "agora", "em 3 min" ou o horário. Atualiza sozinho (ver tickEtas).
function etaWhen(eta, m) {
  const diff = eta - m;
  if (diff < 1) return '<span class="when-now">Chegando</span>';
  if (diff < 60) return `<span class="when-min">${Math.floor(diff)}<small>min</small></span>`;
  return `<span class="when-clock">${fmt(eta)}</span>`;
}

// Atraso em destaque: "+4 min" com o horário previsto por baixo.
function delayBadge(trip, sched) {
  if (!trip.delay) return '';
  return `<span class="delay-badge" title="Previsto ${fmt(sched)}">+${trip.delay} min<small>atrasado</small></span>`;
}

function nextRow(it, m, st, dt) {
  const diff = it.eta - m;
  const crowd = crowdForecast(it.g.line.id, it.trip.dir, it.sched, st);
  const soon = diff < 2 ? ' imminent' : '';
  return `<li class="next-row${soon}" style="--c:${it.g.line.color}" data-eta="${it.eta}">
    <span class="next-bar"></span>
    <span class="next-main">${badge(it.g.line)}<span class="next-dest">para <b>${esc(it.g.dest)}</b></span></span>
    <span class="next-when" data-eta-when="${it.eta}"><span class="when-slot">${etaWhen(it.eta, m)}</span>${it.trip.delay ? `<span class="late-sm">+${it.trip.delay} min</span>` : ''}</span>
    ${crowd ? `<span class="next-crowd ${crowd.cls}" title="Lotação prevista">${meter(crowd.level)}</span>` : ''}
  </li>`;
}

// Atualiza o contador a cada segundo sem redesenhar a tela inteira.
function tickEtas() {
  const m = minutesOf(spNow());
  for (const row of $$('[data-eta-when]')) {
    const eta = Number(row.dataset.etaWhen);
    const diff = eta - m;
    const slot = row.querySelector('.when-slot');
    if (slot) slot.innerHTML = etaWhen(eta, m);
    const box = row.closest('[data-eta]');
    if (box) box.classList.toggle('imminent', diff < 2 && diff >= -0.5);
  }
}
setInterval(tickEtas, 1000);

function toggleFav(st) {
  state.favs = state.favs.includes(st) ? state.favs.filter(n => n !== st) : [...state.favs, st];
  store.set('favs', state.favs);
  render();
}

// ---------- Tela: Rotas ----------

function renderRota() {
  const el = $('#v-rota');
  const p = state.plan;
  el.innerHTML = `
    <h1 class="page-title">Rotas</h1>
    <div class="planner card">
      <div class="od">
        <div class="od-rail" aria-hidden="true"><i class="od-dot"></i><i class="od-line"></i><i class="od-dot end"></i></div>
        <div class="od-fields">
          <button class="od-field" id="plan-from" type="button" aria-haspopup="dialog"><span class="eyebrow">De</span><span class="od-val"></span></button>
          <button class="od-field" id="plan-to" type="button" aria-haspopup="dialog"><span class="eyebrow">Para</span><span class="od-val"></span></button>
        </div>
        <button class="icon-btn swap" id="plan-swap" type="button" aria-label="Inverter origem e destino">${ICON.swap}</button>
      </div>
      <div class="when">
        <div class="seg" role="group" aria-label="Quando">
          <button type="button" data-when="now" aria-pressed="${p.when === 'now'}">Sair agora</button>
          <button type="button" data-when="at" aria-pressed="${p.when === 'at'}">Escolher horário</button>
        </div>
        <div class="when-at" id="plan-at" ${p.when === 'at' ? '' : 'hidden'}>
          <label class="input"><span class="eyebrow">Data</span><input id="plan-date" type="date"></label>
          <label class="input"><span class="eyebrow">Horário</span><input id="plan-time" type="time"></label>
        </div>
      </div>
    </div>
    <div id="plan-results" class="results" aria-live="polite"></div>`;

  const setVal = (id, v, ph) => {
    const box = $(`#${id} .od-val`, el);
    box.textContent = v || ph;
    box.classList.toggle('placeholder', !v);
  };
  setVal('plan-from', p.from, 'Escolha a origem');
  setVal('plan-to', p.to, 'Escolha o destino');

  $('#plan-from', el).onclick = () => openPicker('De onde você sai?', n => setOD('from', n));
  $('#plan-to', el).onclick = () => openPicker('Para onde você vai?', n => setOD('to', n));
  $('#plan-swap', el).onclick = () => {
    [p.from, p.to] = [p.to, p.from];
    store.set('from', p.from); store.set('to', p.to);
    p.open = -1;
    renderRota();
  };
  $$('[data-when]', el).forEach(b => b.onclick = () => {
    p.when = b.dataset.when;
    if (p.when === 'at' && !$('#plan-time', el).value) {
      const now = spNow();
      $('#plan-date', el).value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      $('#plan-time', el).value = fmt(minutesOf(now));
    }
    renderRota();
  });
  $('#plan-date', el)?.addEventListener('change', renderPlanResults);
  $('#plan-time', el)?.addEventListener('change', renderPlanResults);
  $('#plan-results', el).addEventListener('click', e => {
    const b = e.target.closest('[data-route]');
    if (!b) return;
    const i = Number(b.dataset.route);
    p.open = p.open === i ? -1 : i;
    renderPlanResults();
  });
  renderPlanResults();
}

function setOD(key, name) {
  state.plan[key] = name;
  store.set(key, name);
  state.plan.open = -1;
  renderRota();
}

function renderPlanResults() {
  const p = state.plan;
  const out = $('#plan-results');
  if (!out) return;
  if (!p.from || !p.to) {
    out.innerHTML = `<div class="empty">${ICON.route}<b>Para onde vamos?</b>Escolha a origem e o destino para ver as opções de viagem.</div>`;
    return;
  }
  if (p.from === p.to) {
    out.innerHTML = `<div class="empty">${ICON.route}<b>Origem e destino iguais</b>Escolha estações diferentes.</div>`;
    return;
  }
  const now = spNow();
  let dt = dayTypeOf(now), dep = minutesOf(now), today = true;
  if (p.when === 'at' && $('#plan-date').value && $('#plan-time').value) {
    const [y, mo, d] = $('#plan-date').value.split('-').map(Number);
    const date = new Date(y, mo - 1, d);
    dt = dayTypeOf(date);
    dep = toMin($('#plan-time').value);
    today = date.toDateString() === now.toDateString();
  }
  const results = plan(p.from, p.to, dep, dt, 4);
  if (!results.length) {
    out.innerHTML = `<div class="empty">${ICON.clock}<b>Nenhuma viagem encontrada</b>Não há trens a partir desse horário (${DIA_LABEL[dt]}). Tente outro horário.</div>`;
    return;
  }
  const fastest = results.reduce((a, b) => (b.arr - b.dep < a.arr - a.dep ? b : a));
  out.innerHTML = `<div class="results-head"><span>${results.length} opções · ${DIA_SHORT[dt]}</span></div>` +
    results.map((r, i) => routeCard(r, i, r === results[0] ? 'Chega primeiro' : r === fastest ? 'Mais rápida' : '', today ? minutesOf(now) : null)).join('');

  const needed = [...new Set(results.flatMap(r => r.legs.flatMap(l => [l.from, l.to])))];
  Promise.all(needed.map(n => loadStation(n, dt))).then(fresh => {
    if (fresh.some(Boolean) && $('#v-rota') && !$('#v-rota').hidden) renderPlanResults();
  });
}

function routeCard(r, i, label, nowM) {
  const open = state.plan.open === i;
  const transfers = r.legs.length - 1;
  const bar = r.legs.map((l, k) =>
    (k ? `<i class="wait" style="flex:${Math.max(2, l.dep - r.legs[k - 1].arr)}"></i>` : '') +
    `<i style="flex:${l.arr - l.dep};--c:${l.trip.line.color}"></i>`).join('');
  const leave = nowM != null ? r.dep - nowM : null;
  const meta = [
    r.legs.map(l => badge(l.trip.line)).join('<span aria-hidden="true" class="arrow">›</span>'),
    transfers ? `${transfers} ${transfers > 1 ? 'baldeações' : 'baldeação'}` : 'Direto',
    leave != null && leave >= 0 && leave < 120 ? `<span class="go">Sai ${inText(leave)}</span>` : '',
  ].filter(Boolean).join('<span class="sep"></span>');
  const warn = alertsFor2({ lines: r.legs.map(l => l.trip.line.id), stations: r.legs.flatMap(l => [l.from, l.to]) });
  return `<article class="route ${i === 0 ? 'best' : ''}">
    <button class="route-sum" type="button" data-route="${i}" aria-expanded="${open}">
      <div class="route-top">
        <span class="route-when"><span class="route-time">${fmt(r.dep)} – ${fmt(r.arr)}</span>
        ${label ? `<span class="route-label">${label}</span>` : ''}</span>
        <span class="route-dur">${dur(r.arr - r.dep)}</span>
        ${ICON.chevDown}
      </div>
      <div class="route-bar" aria-hidden="true">${bar}</div>
      <div class="route-meta">${meta}</div>
      ${warn.length ? `<div class="route-alert">${ICON.alert}<span>${esc(warn[0].title)}${warn.length > 1 ? ` e mais ${warn.length - 1}` : ''}</span></div>` : ''}
    </button>
    ${open ? timeline(r) : ''}
  </article>`;
}

function timeline(r) {
  let html = '';
  r.legs.forEach((l, k) => {
    const c = l.trip.line.color;
    if (k) {
      const wait = Math.round(l.dep - r.legs[k - 1].arr);
      html += `<li class="transfer"><span></span><span class="rail"></span><div class="what">${ICON.transfer}Baldeação em ${esc(l.from)} · ${wait} min de espera</div></li>`;
    }
    html += `<li class="stop ${k === 0 ? 'first' : ''}" style="--c:${c}"><time>${fmt(l.dep)}</time><span class="rail"></span>
      <div class="what"><b>${esc(l.from)}</b><span class="sub">Embarque · sentido ${esc(l.trip.dest)}</span></div></li>`;
    const last = k === r.legs.length - 1;
    const crowd = crowdForecast(l.trip.line.id, l.trip.dir, l.dep, l.from);
    const car = bestCar(l.to, l.trip.line.id, l.trip.dir, last ? 'saida' : 'baldeacao');
    const carHint = car && !car.weak
      ? `<span class="car-hint">${cars(car.zone)}Embarque no vagão do <b>${ZONE[car.zone].toLowerCase()}</b> para ${last ? 'sair mais rápido' : 'agilizar a baldeação'}</span>` : '';
    html += `<li class="ride" style="--c:${c}"><span></span><span class="rail"></span>
      <div class="what">${badge(l.trip.line)} ${l.count} ${l.count === 1 ? 'estação' : 'estações'} · ${dur(l.arr - l.dep)}${crowd ? crowdChip(crowd) : ''}${carHint}</div></li>`;
    html += `<li class="stop ${last ? 'last' : ''}" style="--c:${c}"><time>${fmt(l.arr)}</time><span class="rail"></span>
      <div class="what"><b>${esc(l.to)}</b><span class="sub">${last ? 'Chegada' : 'Desembarque'}</span></div></li>`;
  });
  return `<ol class="tl">${html}</ol>`;
}

// Abre a rota com "De" e "Para" preenchidos (ex.: a partir da tela de estação).
document.addEventListener('click', e => {
  const b = e.target.closest('[data-route-to]');
  if (!b) return;
  state.plan.to = b.dataset.routeTo; store.set('to', state.plan.to);
  if (!state.plan.from) { state.plan.from = state.station; store.set('from', state.plan.from); }
  state.plan.open = -1;
  go('#/rota');
});

// ---------- Tela: Linhas ----------

function renderLinhas() {
  const el = $('#v-linhas');
  const now = spNow(), m = minutesOf(now), dt = dayTypeOf(now);
  el.innerHTML = `
    <h1 class="page-title">Linhas</h1>
    <p class="lead">Toque numa linha para ver as estações e os horários.</p>
    <div class="line-list">${LINES.map(l => {
      const running = liveTrips(m, dt, l.id).length;
      const sum = lineSummary(l, dt);
      return `<a class="line-item" href="#/linha/${l.id}" style="--c:${l.color}">
        <span class="bar"></span>
        <span class="line-body"><h3>${esc(l.name)}</h3><p>${esc(l.from)} ↔ ${esc(l.to)}</p>
          <span class="line-meta">${sum ? `${fmt(sum.first)} – ${fmt(sum.last)}` : 'Sem operação'} · ${l.stops.length} estações</span>
          <span class="live-count ${running ? '' : 'off'}">${running ? `${running} ${running === 1 ? 'trem' : 'trens'} circulando agora` : 'Nenhum trem circulando agora'}</span></span>
        <span class="side">${ICON.chev}</span></a>`;
    }).join('')}</div>`;
}

// ---------- Tela: Linha ----------

function renderLinha() {
  const el = $('#v-linha');
  const line = lineById(state.line);
  const now = spNow(), m = minutesOf(now);
  if (!state.lineDay) state.lineDay = dayTypeOf(now);
  const dt = state.lineDay, dir = state.lineDir;
  const order = dir === 0 ? line.stops : [...line.stops].reverse();
  const running = liveTrips(m, dt, line.id);
  const sum = lineSummary(line, dt);

  el.innerHTML = `
    <a class="back" href="#/linhas">${ICON.back}Linhas</a>
    <div class="card line-hero" style="--c:${line.color}">
      ${badge(line)}
      <h1>${esc(line.from)} ↔ ${esc(line.to)}</h1>
      <p>${esc(line.kind)}</p>
      <div class="stats">
        <div class="stat"><b>${running.length}</b><span>trens agora</span></div>
        <div class="stat"><b>${order.length}</b><span>estações</span></div>
        <div class="stat"><b>${sum ? fmt(sum.first) : '—'}</b><span>primeiro</span></div>
        <div class="stat"><b>${sum ? fmt(sum.last) : '—'}</b><span>último</span></div>
      </div>
    </div>
    <div class="ctl">
      <div class="seg" role="group" aria-label="Sentido">
        <button type="button" data-ldir="0" aria-pressed="${dir === 0}">Para ${esc(line.to)}</button>
        <button type="button" data-ldir="1" aria-pressed="${dir === 1}">Para ${esc(line.from)}</button>
      </div>
      <div class="seg" role="group" aria-label="Dia">
        ${['util', 'sab', 'dom'].map(d => `<button type="button" data-lday="${d}" aria-pressed="${dt === d}">${d === 'util' ? 'Útil' : d === 'sab' ? 'Sábado' : 'Domingo'}</button>`).join('')}
      </div>
    </div>
    <ol class="stop-list">${order.map(([name]) => {
      const next = departures(name, m, dt, 6).flatMap(g => g.items)
        .filter(it => it.trip.line.id === line.id && it.trip.dir === dir)
        .sort((a, b) => a.eta - b.eta)[0];
      const diff = next ? next.eta - m : null;
      return `<li><a href="#/estacao/${encodeURIComponent(name)}" class="stop-row">
        <span class="stop-dot" style="--c:${line.color}"></span>
        <span class="stop-name">${esc(name)}</span>
        <span class="stop-next">${next ? `<b>${diff < 1 ? 'Agora' : fmt(next.eta)}</b><small>${diff < 1 ? '' : inText(diff)}</small>` : '<small>—</small>'}</span>
      </a></li>`;
    }).join('')}</ol>
    <p class="fineprint">Próximo trem em cada estação, neste sentido e dia. Horários oficiais de início e fim; intervalos estimados.</p>`;

  $$('[data-ldir]', el).forEach(b => b.onclick = () => { state.lineDir = Number(b.dataset.ldir); renderLinha(); });
  $$('[data-lday]', el).forEach(b => b.onclick = () => { state.lineDay = b.dataset.lday; renderLinha(); });
}

// ---------- Tela: Estação ----------

function renderEstacao() {
  const el = $('#v-estacao');
  const st = state.station;
  const now = spNow(), m = minutesOf(now), dt = dayTypeOf(now);
  const fav = state.favs.includes(st);
  const tabs = [['proximos', 'Próximos'], ['horarios', 'Horários'], ['servicos', 'Serviços e relatos']];
  el.innerHTML = `
    <a class="back" href="#/">${ICON.back}Início</a>
    <div class="st-head">
      <div>
        <h1 class="st-title">${esc(st)}</h1>
        <div class="dots lines-row">${linesAt(st).map(l => badge(l)).join(' ')}</div>
      </div>
      <button class="icon-btn" id="st-fav" type="button" aria-pressed="${fav}" aria-label="${fav ? 'Remover dos favoritos' : 'Salvar como favorita'}">${ICON.star}</button>
    </div>
    <div class="subtabs" role="tablist">${tabs.map(([id, t]) => `<button type="button" role="tab" data-stab="${id}" aria-selected="${state.stTab === id}">${t}</button>`).join('')}</div>
    <div id="st-body"></div>
    <div class="bottom-action"><button class="btn primary-btn" id="st-report" type="button">${ICON.megaphone}Relatar trem aqui</button></div>`;

  $$('[data-stab]', el).forEach(b => b.onclick = () => { state.stTab = b.dataset.stab; renderEstacao(); });
  $('#st-fav', el).onclick = () => toggleFav(st);
  $('#st-report', el).onclick = () => openReportPicker(st);

  const body = $('#st-body', el);
  if (state.stTab === 'proximos') body.innerHTML = proximosHtml(st, m, dt);
  if (state.stTab === 'horarios') { body.innerHTML = horariosHtml(st, dt); bindHorarios(body, st); }
  if (state.stTab === 'servicos') { body.innerHTML = servicosHtml(st, dt); bindServicos(body, st); }
  loadStation(st, dt).then(fresh => { if (fresh && parseHash().seg === 'estacao' && parseHash().arg === st) renderEstacao(); });
}

function proximosHtml(st, m, dt) {
  const groups = departures(st, m, dt, 6);
  if (!groups.length) return `<div class="empty">${ICON.clock}<b>Sem mais trens hoje</b>Os horários de amanhã aparecem a partir da madrugada.</div>`;
  return groups.map(g => {
    const [first, ...rest] = g.items;
    const diff = first.eta - m;
    const dir = first.trip.dir;
    const crowd = crowdForecast(g.line.id, dir, first.sched, st);
    const car = bestCar(st, g.line.id, dir, 'saida');
    const carLine = car && !car.weak ? `<div class="car-line">${cars(car.zone)}<span>Vagão do <b>${ZONE[car.zone].toLowerCase()}</b> para sair mais perto da saída</span></div>` : '';
    return `<article class="dep${diff < 2 ? ' imminent' : ''}" style="--c:${g.line.color}" data-eta="${first.eta}">
      <header class="dep-head">${badge(g.line)}<span class="dep-dir">para <b>${esc(g.dest)}</b></span>
        <button class="report-btn" type="button" data-report="${g.line.id}|${dir}" aria-label="Relatar sobre ${esc(g.line.name)}">${ICON.megaphone}<span>Relatar</span></button></header>
      <div class="dep-hero">
        <div class="eta" data-eta-when="${first.eta}"><span class="when-slot">${etaWhen(first.eta, m)}</span></div>
        <div class="dep-meta">
          <span class="dep-time">${first.trip.delay ? `<s>${fmt(first.sched)}</s>` : ''}${fmt(first.eta)}</span>
          ${delayBadge(first.trip, first.sched) || statusTag(first)}
        </div>
      </div>
      ${crowd ? `<div class="dep-crowd">${crowdChip(crowd)}</div>` : ''}
      ${carLine}
      ${rest.length ? `<ol class="dep-next" aria-label="Trens seguintes">${rest.map(it => `<li>
        <time class="${it.trip.delay ? 'late-sm' : ''}">${fmt(it.eta)}</time><span class="in">${inText(it.eta - m).replace('em ', '')}</span></li>`).join('')}</ol>` : ''}
    </article>`;
  }).join('');
}

function horariosHtml(st, dt) {
  const lines = linesAt(st);
  const t = state.times;
  if (!t.line || !lines.some(l => l.id === t.line)) t.line = lines[0]?.id;
  if (!t.day) t.day = dt;
  const line = lineById(t.line);
  if (!line) return '<div class="empty">Sem ramais nesta estação.</div>';
  const order = t.dir === 0 ? line.stops : [...line.stops].reverse();
  const options = order.slice(0, -1).map(([n]) => n);
  const times = tripsFor(t.day)
    .filter(x => x.line.id === line.id && x.dir === t.dir)
    .map(x => ({ s: x.stops.find(s => s.name === st), dest: x.dest }))
    .filter(x => x.s && withinOfficial(st, x.dest, x.s.time, t.day))
    .map(x => x.s.time).sort((a, b) => a - b);
  const o = officialLine(st, destOf(line, t.dir), t.day);
  const head = o ? `<div class="official-note">${ICON.check}<span>Oficial (${DIA_LABEL[t.day]}): 1º trem <b>${o.first}</b> · último <b>${o.last}</b>. Os horários entre eles são estimados.</span></div>` : '';
  const chips = `<div class="chips-scroll lines-chips">${lines.map(l =>
    `<button class="lchip" type="button" style="--c:${l.color}" data-tl="${l.id}" aria-pressed="${l.id === line.id}"><i></i>${esc(l.name)}</button>`).join('')}</div>`;
  const ctl = `<div class="ctl">
      <div class="seg" role="group" aria-label="Sentido">${[0, 1].map(d => `<button type="button" data-td="${d}" aria-pressed="${t.dir === d}">Para ${esc(d === 0 ? line.to : line.from)}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Dia">${['util', 'sab', 'dom'].map(d => `<button type="button" data-tday="${d}" aria-pressed="${t.day === d}">${d === 'util' ? 'Útil' : d === 'sab' ? 'Sábado' : 'Domingo'}</button>`).join('')}</div>
    </div>`;
  if (!times.length) return `${chips}${ctl}${head}<div class="empty">${ICON.clock}<b>Sem operação</b>Este ramal não passa aqui neste sentido e dia.</div>`;
  const now = spNow(), isToday = t.day === dayTypeOf(now), mm = minutesOf(now);
  const nextT = isToday ? times.find(x => x >= mm) : undefined;
  const byHour = new Map();
  for (const x of times) { const h = Math.floor(x / 60); if (!byHour.has(h)) byHour.set(h, []); byHour.get(h).push(x); }
  const curHour = nextT !== undefined ? Math.floor(nextT / 60) : null;
  const hidden = curHour != null && !t.showPast ? [...byHour.keys()].filter(h => h < curHour).length : 0;
  const hours = [...byHour].filter(([h]) => !hidden || h >= curHour);
  return `${chips}${ctl}${head}
    <div class="times-summary"><span><b>${times.length}</b> partidas estimadas</span>
      ${nextT !== undefined ? `<span>Próximo: <b>${fmt(nextT)}</b> (${inText(nextT - mm)})</span>` : ''}</div>
    ${hidden ? `<button class="show-past" type="button" id="times-past">Mostrar ${hidden} ${hidden === 1 ? 'hora anterior' : 'horas anteriores'}</button>` : ''}
    <div class="hours">${hours.map(([h, xs]) => `
      <div class="hour ${nextT !== undefined && Math.floor(nextT / 60) === h ? 'current' : ''}"><b>${String(h % 24).padStart(2, '0')}h</b>
        <span class="mins">${xs.map(x => `<span class="${x === nextT ? 'next' : isToday && x < mm ? 'past' : ''}">${String(Math.round(x) % 60).padStart(2, '0')}</span>`).join('')}</span></div>`).join('')}
    </div>`;
}

function bindHorarios(body, st) {
  const t = state.times;
  $$('[data-tl]', body).forEach(b => b.onclick = () => { t.line = b.dataset.tl; t.showPast = false; t.dir = 0; renderEstacao(); });
  $$('[data-td]', body).forEach(b => b.onclick = () => { t.dir = Number(b.dataset.td); t.showPast = false; renderEstacao(); });
  $$('[data-tday]', body).forEach(b => b.onclick = () => { t.day = b.dataset.tday; t.showPast = false; renderEstacao(); });
  $('#times-past', body)?.addEventListener('click', () => { t.showPast = true; renderEstacao(); });
}

function servicosHtml(st, dt) {
  const off = officialStation(st);
  const data = COMM.stations.get(st);
  const lines = linesAt(st);
  const h = off && off.horario && off.horario[dt];
  const svc = off && off.servicos.length ? off.servicos.map(s => `<span class="svc">${esc(s)}</span>`).join('') : '<span class="muted small">Nenhum listado pela operadora</span>';
  const info = off ? `<section class="card panel">
      <div class="panel-head"><h2>Informações oficiais</h2><span class="panel-sub">publicadas pela TrensRJ</span></div>
      <div class="off-row"><span class="off-k">Funcionamento</span><span class="off-v">${h ? `${h[0]} às ${h[1]}` : 'Sem horário publicado'} <span class="muted small">(${DIA_LABEL[dt]})</span></span></div>
      <div class="off-row"><span class="off-k">Serviços</span><span class="off-v svcs">${svc}</span></div>
    </section>` : '';

  const vagao = lines.flatMap(l => arrivingDirs(l, st).map(d => {
    const b = bestCar(st, l.id, d, 'saida');
    const result = !b ? '<span class="muted">Ainda sem votos</span>'
      : b.weak ? `<span class="muted">Poucos votos (${b.total})</span>`
        : `${cars(b.zone)}<span><b>${ZONE[b.zone]}</b> <span class="muted">· ${b.pct}%</span></span>`;
    return `<button class="row-btn" type="button" data-vote="${l.id}|${d}">${badge(l)}<span class="row-main">para <b>${esc(destOf(l, d))}</b></span><span class="row-side">${result}</span></button>`;
  })).join('');

  const acess = ACESS.map(a => {
    const s = data?.acess?.[a.item];
    let val;
    if (s) val = `<span class="pill-status ${s.ok ? 'ok' : 'bad'}">${s.ok ? a.yes : a.no}</span><span class="muted small">${s.n} ${s.n === 1 ? 'relato' : 'relatos'} · ${ago(new Date(s.at).toISOString())}</span>`;
    else if (a.item === 'elevador' && off) val = off.servicos.includes('Elevador') ? '<span class="pill-status ok">Tem (oficial)</span><span class="muted small">não informa se funciona</span>' : '<span class="muted">Não consta na lista oficial</span>';
    else if (a.item === 'escada' && off) val = '<span class="muted">Não consta na lista oficial</span>';
    else val = '<span class="muted">Sem informação</span>';
    return `<button class="row-btn" type="button" data-acess="${a.item}"><span class="row-ico">${a.icon}</span><span class="row-main">${a.name}</span><span class="row-side col">${val}</span></button>`;
  }).join('');

  const recent = data?.recent || [];
  const feed = recent.length ? recent.map(r => {
    const l = lineById(r.line);
    const what = r.type === 'lotacao' ? `${ICON.people}${CROWD_NOW[r.value] || 'Lotação'}`
      : r.type === 'passou' ? `${ICON.check}Trem passou${r.value > 1 ? ` · +${Math.round(r.value)} min` : ''}`
        : r.type === 'parado' ? `${ICON.stop}Trem parado` : `${ICON.snow}Ar-condicionado quebrado`;
    return `<div class="feed-row"><span class="feed-what">${what}</span>${l ? badge(l) : ''}<span class="muted small">${r.ago < 1 ? 'agora' : `há ${r.ago} min`}</span></div>`;
  }).join('') : `<p class="panel-empty">Nenhum relato na última hora.</p>`;

  return `${info}
    <section class="card panel"><div class="panel-head"><h2>Vagão certo</h2><span class="panel-sub">para sair nesta estação, segundo passageiros</span></div>${vagao || '<p class="panel-empty">Sem ramais.</p>'}</section>
    <section class="card panel"><div class="panel-head"><h2>Acessibilidade</h2><span class="panel-sub">informada por passageiros e pela operadora</span></div>${acess}</section>
    <section class="card panel"><div class="panel-head"><h2>Última hora</h2></div>${feed}</section>`;
}

function bindServicos(body, st) {
  $$('[data-vote]', body).forEach(b => b.onclick = () => {
    const [lineId, dir] = b.dataset.vote.split('|');
    const line = lineById(lineId);
    let goal = 'saida';
    openAction('Qual o melhor vagão?', `
      <p class="action-sub">${badge(line)} para ${esc(destOf(line, Number(dir)))}, em ${esc(st)}</p>
      <div class="seg" role="group" aria-label="Objetivo">
        <button type="button" data-act="goal-saida" aria-pressed="true">Para sair da estação</button>
        <button type="button" data-act="goal-baldeacao" aria-pressed="false">Para fazer baldeação</button>
      </div>
      <div class="zone-pick">${['fundo', 'meio', 'frente'].map(z => `<button type="button" data-act="z-${z}">${cars(z)}<span>${ZONE[z]}</span></button>`).join('')}</div>
      <p class="panel-foot">A seta indica o sentido do trem. Frente é o primeiro vagão.</p>`,
    async (act, btn) => {
      if (act.startsWith('goal-')) { goal = act.slice(5); $$('[data-act^="goal-"]', $('#action-body')).forEach(x => x.setAttribute('aria-pressed', x === btn)); return; }
      return submit({ type: 'vagao', station: st, line: lineId, dir: Number(dir), goal, value: act.slice(2) }, 'Voto registrado. Obrigado!');
    });
  });
  $$('[data-acess]', body).forEach(b => b.onclick = () => {
    const a = ACESS.find(x => x.item === b.dataset.acess);
    openAction(a.name, `
      <p class="action-sub">Em ${esc(st)}, como está agora?</p>
      <div class="two-pick">
        <button type="button" data-act="yes" class="ok">${ICON.check}${a.yes}</button>
        <button type="button" data-act="no" class="bad">${ICON.alert}${a.no}</button>
      </div>`,
    act => submit({ type: 'acess', station: st, item: a.item, value: act === 'yes' }));
  });
}

// ---------- Tela: Avisos ----------

function renderAvisos() {
  const el = $('#v-avisos');
  const alerts = COMM.overview?.alerts || [];
  el.innerHTML = `
    <h1 class="page-title">Avisos</h1>
    <div class="alert-list">${alerts.length ? alerts.map(alertCard).join('')
      : !COMM.overview
        ? `<div class="empty">${ICON.wifiOff}<b>Avisos indisponíveis</b>Não foi possível falar com o servidor agora.</div>`
        : `<div class="ok-state">${ICON.check}<div><b>Nenhum aviso agora</b><span>Sem paralisações ou alertas de segurança perto das estações.</span></div></div>`}</div>
    <div class="section-head"><h2>Pontualidade por ramal</h2>
      <div class="seg seg-sm" role="group" aria-label="Período">
        ${[7, 30, 90].map(d => `<button type="button" data-days="${d}" aria-pressed="${state.punctDays === d}">${d} dias</button>`).join('')}
      </div></div>
    <div id="punct-list" class="punct-list"></div>
    <p class="fineprint">Calculado com os relatos “o trem passou” enviados por passageiros. Não é um dado oficial da operadora.</p>`;
  $$('[data-days]', el).forEach(b => b.onclick = () => { state.punctDays = Number(b.dataset.days); renderAvisos(); });
  fillPunctuality();
}

function fillPunctuality() {
  const box = $('#punct-list');
  if (!box) return;
  const data = COMM.punct.get(state.punctDays);
  if (!data) {
    box.innerHTML = '<div class="skeleton" style="height:200px"></div>';
    loadPunctuality(state.punctDays).then(ok => {
      if (ok && parseHash().seg === 'avisos') renderAvisos();
      else if (!ok && $('#punct-list')) $('#punct-list').innerHTML = `<div class="empty">${ICON.wifiOff}<b>Sem dados de pontualidade</b>Tente de novo quando estiver online.</div>`;
    });
    return;
  }
  const MIN = 20;
  const rows = data.lines.map(x => ({ ...x, line: lineById(x.line) })).filter(x => x.line)
    .sort((a, b) => (b.n >= MIN) - (a.n >= MIN) || (b.onTimePct ?? -1) - (a.onTimePct ?? -1));
  box.innerHTML = rows.map((x, i) => {
    if (x.n < MIN) return `<div class="punct few"><span class="rank">–</span>${badge(x.line)}<span class="muted small">Poucos relatos (${x.n}) para calcular</span></div>`;
    const tone = x.onTimePct >= 80 ? 'ok' : x.onTimePct >= 60 ? 'mid' : 'bad';
    return `<div class="punct">
      <span class="rank">${i + 1}</span>
      <div class="punct-main">
        <div class="punct-top">${badge(x.line)}<b class="pct ${tone}">${x.onTimePct}%</b><span class="muted small">no horário</span></div>
        <div class="punct-bar"><i class="${tone}" style="width:${x.onTimePct}%"></i></div>
        <div class="punct-meta muted small">Atraso médio ${x.avgDelay} min · ${x.n} relatos${x.worst ? ` · pior horário ${String(x.worst.hour).padStart(2, '0')}h` : ''}</div>
      </div></div>`;
  }).join('');
}

// ---------- Atualização ----------

function refreshAll() { render(); }
async function pollRealtime() { await refreshRealtime(); render(); }
async function pollOverview() {
  await loadOverview(dayTypeOf(spNow()));
  if (parseHash().seg === 'avisos') await loadPunctuality(state.punctDays);
  render();
}

route();
setInterval(() => { const s = parseHash().seg; if (s === 'inicio' || s === 'linha' || s === 'linhas' || s === 'estacao') render(); }, 15000);
pollRealtime();
setInterval(pollRealtime, 30000);
pollOverview();
setInterval(pollOverview, 60000);

flushQueue();
window.addEventListener('online', () => { toast('Conexão de volta.'); flushQueue(); pollOverview(); });
window.addEventListener('offline', () => { toast('Sem internet: horários e rotas continuam funcionando.'); render(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem modo offline */ });
}
