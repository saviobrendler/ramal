// Ramal — interface.

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
  live: svg('<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>'),
  plan: svg('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>'),
  lines: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>'),
  times: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  star: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  chev: svg('<path d="m9 6 6 6-6 6"/>'),
  chevDown: svg('<path d="m6 9 6 6 6-6"/>', 'ico route-chev'),
  back: svg('<path d="m15 6-6 6 6 6"/>'),
  transfer: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  train: svg('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>'),
  route: svg('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  alert: svg('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'),
  shield: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M12 9v4M12 16h.01"/>'),
  stop: svg('<circle cx="12" cy="12" r="9"/><path d="M9 9v6M15 9v6"/>'),
  megaphone: svg('<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  people: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>'),
  snow: svg('<path d="M12 2v20M4 7l16 10M20 7 4 17"/>'),
  elevator: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 9 3-3 3 3M9 15l3 3 3-3"/>'),
  stairs: svg('<path d="M3 20h5v-5h5v-5h5V5h3"/>'),
  ramp: svg('<path d="M3 19h18L3 9z"/>'),
  gap: svg('<path d="M3 15h7M14 15h7M10 11v8M14 11v8"/>'),
  wifiOff: svg('<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.8M19 13a10 10 0 0 0-2.4-1.8M2 8.8a15 15 0 0 1 4.3-2.6M22 8.8A15 15 0 0 0 10.7 5"/><circle cx="12" cy="20" r="1"/>'),
};

const TABS = [
  { id: 'live', label: 'Ao vivo', icon: ICON.live },
  { id: 'plan', label: 'Planejar', icon: ICON.plan },
  { id: 'lines', label: 'Ramais', icon: ICON.lines },
  { id: 'times', label: 'Horários', icon: ICON.times },
  { id: 'status', label: 'Avisos', icon: ICON.bell },
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

const state = {
  tab: 'live',
  station: isStation(store.get('station', '')) ? store.get('station') : 'Central do Brasil',
  filter: null,
  favs: store.get('favs', []).filter(isStation),
  recents: store.get('recents', []).filter(isStation),
  plan: { from: store.get('from', null), to: store.get('to', null), when: 'now', open: 0 },
  lineId: null,
  times: { line: LINES[0].id, dir: 0, station: null, day: null },
};

function remember(name) {
  state.recents = [name, ...state.recents.filter(n => n !== name)].slice(0, 8);
  store.set('recents', state.recents);
}

// ---------- Navegação ----------

for (const nav of $$('[data-nav]')) {
  nav.innerHTML = TABS.map(t => `<a href="#${t.id}" data-tab="${t.id}">${t.icon}<span>${t.label}</span></a>`).join('');
}

function setTab(tab) {
  if (!TABS.some(t => t.id === tab)) tab = 'live';
  const changed = state.tab !== tab;
  state.tab = tab;
  $$('[data-tab]').forEach(a => (a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  $$('.view').forEach(v => (v.hidden = v.id !== 'view-' + tab));
  if (changed) window.scrollTo(0, 0);
  render();
}
window.addEventListener('hashchange', () => setTab(location.hash.slice(1)));

function render() {
  renderStatus();
  if (state.tab === 'live') renderLive();
  if (state.tab === 'plan') renderPlan();
  if (state.tab === 'lines') renderLines();
  if (state.tab === 'times') renderTimes();
  if (state.tab === 'status') renderStatusView();
  renderAlertBadge();
}

function renderAlertBadge() {
  const n = (COMM.overview?.alerts || []).length;
  $$('[data-tab="status"]').forEach(a => {
    let b = $('.tab-badge', a);
    if (!n) { b && b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'tab-badge'; a.appendChild(b); }
    b.textContent = n;
  });
}

// ---------- Folha de ações e aviso rápido ----------

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

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

async function submit(report, okMsg = 'Obrigado! Seu relato ajuda outros passageiros.') {
  const r = await sendReport(report);
  $('#action').close();
  if (!r.ok) return toast(r.error);
  toast(r.queued ? 'Sem internet: o relato será enviado quando a conexão voltar.' : okMsg);
  if (!r.queued) { await loadStation(report.station, dayTypeOf(spNow()), true); render(); }
}

// ---------- Status dos dados ----------

function dataStatus() {
  if (!navigator.onLine) return { cls: 'plain', text: 'Offline' };
  if (REALTIME.active) return { cls: 'live', text: 'Ao vivo' };
  if (DATA_MODE === 'gtfs') return { cls: 'plain', text: 'Programado' };
  return { cls: '', text: 'Demonstração' };
}

function renderStatus() {
  const s = dataStatus();
  $('#status').className = 'status ' + s.cls;
  $('#status-text').textContent = s.text;
}

$('#status').addEventListener('click', () => {
  const rows = [];
  if (DATA_MODE === 'gtfs') {
    const g = window.GTFS_DATA;
    rows.push(['ok', 'Horários oficiais', `Fonte: ${esc(g.source)}. Importado em ${new Date(g.generatedAt).toLocaleDateString('pt-BR')}.`]);
  } else if (window.OFICIAL) {
    rows.push(['ok', 'Estações e horários de início e fim oficiais', `Ramais, estações, funcionamento, serviços e primeiro/último trem vêm do site da TrensRJ (coletados em ${new Date(window.OFICIAL.coletadoEm).toLocaleDateString('pt-BR')}).`]);
    rows.push(['warn', 'Partidas trem a trem estimadas', 'A operadora não publica a grade completa. Os intervalos entre trens são estimados e os atrasos são simulados.']);
  } else {
    rows.push(['warn', 'Horários de demonstração', 'Estações, tempos e intervalos são aproximados. Não use para decidir uma viagem real.']);
  }
  rows.push(REALTIME.active
    ? ['ok', 'Tempo real ativo', `${REALTIME.source ? esc(REALTIME.source) + '. ' : ''}Atualizado às ${new Date(REALTIME.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`]
    : DATA_MODE === 'gtfs'
      ? ['plain', 'Sem tempo real', 'Os horários mostrados são os programados.']
      : ['warn', 'Atrasos simulados', 'Os atrasos exibidos são gerados apenas para demonstrar a tela.']);
  if (!navigator.onLine) {
    const q = queueGet().length;
    rows.unshift(['plain', 'Você está sem internet', `Horários, rotas e o último estado dos avisos continuam funcionando.${q ? ` ${q} ${q === 1 ? 'relato será enviado' : 'relatos serão enviados'} quando a conexão voltar.` : ''}`]);
  }
  rows.push(['plain', 'Relatos de passageiros', 'Lotação, vagão certo, acessibilidade e pontualidade vêm de relatos anônimos enviados no Ramal.']);
  $('#info-body').innerHTML = rows.map(([c, t, d]) =>
    `<div class="info-row ${c}"><span class="status-dot"></span><div><b>${t}</b>${d}</div></div>`).join('') +
    '<p>Ramal é um projeto independente, sem vínculo com a operadora dos trens nem com o Governo do Estado.</p>';
  $('#info').showModal();
});

// ---------- Folhas (diálogos) ----------

for (const d of $$('dialog')) {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
}

const picker = $('#picker');
let onPick = null;

function openPicker(title, cb) {
  onPick = cb;
  $('#picker-title').textContent = title;
  $('#picker-q').value = '';
  renderPicker();
  picker.showModal();
  $('#picker-list').scrollTop = 0;
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

// ---------- Ao vivo ----------

function setStation(name) {
  state.station = name;
  state.filter = null;
  store.set('station', name);
  remember(name);
  renderLive();
}

$('#live-pick').addEventListener('click', () => openPicker('Escolher estação', setStation));
$('#live-fav').addEventListener('click', () => {
  const s = state.station;
  state.favs = state.favs.includes(s) ? state.favs.filter(n => n !== s) : [...state.favs, s];
  store.set('favs', state.favs);
  renderLive();
});
$('#live-quick').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) setStation(b.dataset.st); });
$('#live-filter').addEventListener('click', e => {
  const b = e.target.closest('[data-f]');
  if (b) { state.filter = b.dataset.f || null; renderLive(); }
});

function statusTag(it) {
  if (it.trip.delay) return `<span class="tag late">${it.trip.rt ? '' : ''}+${it.trip.delay} min</span>`;
  if (it.trip.rt || DATA_MODE === 'simulado') return '<span class="tag ok">No horário</span>';
  return '<span class="tag plain">Programado</span>';
}

function depCard(g, m) {
  const [first, ...rest] = g.items;
  const diff = first.eta - m;
  const hero = diff < 1 ? '<span class="eta-num now">Agora</span>'
    : diff < 60 ? `<span class="eta-num">${Math.floor(diff)}</span><span class="eta-unit">min</span>`
      : `<span class="eta-num sm">${fmt(first.eta)}</span>`;
  const time = `${first.trip.delay ? `<s>${fmt(first.sched)}</s>` : ''}${fmt(first.eta)}`;
  const label = `${g.line.name}, sentido ${g.dest}: próximo trem ${diff < 1 ? 'chegando agora' : inText(diff)}, às ${fmt(first.eta)}`;
  const dir = first.trip.dir;
  const crowd = crowdForecast(g.line.id, dir, first.sched, state.station);
  return `<article class="dep" style="--c:${g.line.color}" aria-label="${esc(label)}">
    <header class="dep-head">${badge(g.line)}<span class="dep-dir">para <b>${esc(g.dest)}</b></span>
      <button class="report-btn" type="button" data-report="${g.line.id}|${dir}" aria-label="Relatar sobre ${esc(g.line.name)} para ${esc(g.dest)}">${ICON.megaphone}<span>Relatar</span></button></header>
    <div class="dep-hero">
      <div class="eta">${hero}</div>
      <div class="dep-meta">${diff < 60 ? `<span class="dep-time">${time}</span>` : `<span class="dep-time">${inText(diff)}</span>`}${statusTag(first)}</div>
    </div>
    ${crowd ? `<div class="dep-crowd">${crowdChip(crowd)}</div>` : ''}
    ${rest.length ? `<ol class="dep-next" aria-label="Trens seguintes">${rest.map(it => `<li>
      <time class="${it.trip.delay ? 'late-sm' : ''}" title="${it.trip.delay ? `Previsto ${fmt(it.sched)}, atraso de ${it.trip.delay} min` : ''}">${fmt(it.eta)}</time><span class="in">${inText(it.eta - m).replace('em ', '')}</span></li>`).join('')}</ol>` : ''}
  </article>`;
}

function renderLive() {
  const now = spNow(), m = minutesOf(now), dt = dayTypeOf(now), st = state.station;
  $('#live-name').textContent = st;
  $('#live-dots').innerHTML = dots(st);
  const fav = state.favs.includes(st);
  const favBtn = $('#live-fav');
  favBtn.setAttribute('aria-pressed', fav);
  favBtn.setAttribute('aria-label', fav ? 'Remover dos favoritos' : 'Favoritar estação');
  favBtn.innerHTML = ICON.star;

  const quick = [...state.favs, ...state.recents].filter((n, i, a) => a.indexOf(n) === i && n !== st).slice(0, 8);
  $('#live-quick').innerHTML = quick.map(n => `<button class="chip" type="button" data-st="${esc(n)}">${state.favs.includes(n) ? ICON.star : ''}${esc(n)}</button>`).join('');

  const lines = linesAt(st);
  if (state.filter && !lines.some(l => l.id === state.filter)) state.filter = null;
  $('#live-filter').innerHTML = lines.length > 1
    ? [`<button class="fchip" type="button" data-f="" aria-pressed="${!state.filter}">Todos</button>`,
      ...lines.map(l => `<button class="fchip" type="button" style="--c:${l.color}" data-f="${l.id}" aria-pressed="${state.filter === l.id}"><i></i>${esc(l.name)}</button>`)].join('')
    : '';

  let groups = departures(st, m, dt, 6);
  if (state.filter) groups = groups.filter(g => g.line.id === state.filter);
  $('#live-board').innerHTML = groups.length
    ? groups.map(g => depCard(g, m)).join('')
    : `<div class="empty">${ICON.clock}<b>Sem mais trens hoje</b>A operação nesta estação terminou. Os horários de amanhã aparecem a partir da madrugada.</div>`;
  $('#live-updated').textContent = `Atualizado às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · atualiza sozinho`;

  $('#live-alerts').innerHTML = alertsFor({ lines: lines.map(l => l.id), stations: [st] }).map(alertCard).join('');
  renderStationExtras(st, lines);
  renderOfficial(st, dt);
  loadStation(st, dt).then(fresh => { if (fresh && state.tab === 'live' && state.station === st) renderLive(); });
}

// ---------- Avisos, vagão certo, acessibilidade, relatos ----------

const ALERT_KIND = {
  seguranca: { icon: ICON.shield, cls: 'danger', label: 'Segurança' },
  paralisacao: { icon: ICON.stop, cls: 'warn', label: 'Circulação' },
  aviso: { icon: ICON.alert, cls: 'info', label: 'Aviso' },
};
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

const ACESS = [
  { item: 'elevador', icon: ICON.elevator, name: 'Elevador', yes: 'Funcionando', no: 'Quebrado' },
  { item: 'escada', icon: ICON.stairs, name: 'Escada rolante', yes: 'Funcionando', no: 'Quebrada' },
  { item: 'rampa', icon: ICON.ramp, name: 'Rampa de acesso', yes: 'Tem', no: 'Não tem' },
  { item: 'vao', icon: ICON.gap, name: 'Vão entre trem e plataforma', yes: 'Pequeno', no: 'Grande' },
];

function renderStationExtras(st, lines) {
  const data = COMM.stations.get(st);

  // Vagão certo
  const rows = [];
  for (const l of lines) {
    for (const d of arrivingDirs(l, st)) {
      const b = bestCar(st, l.id, d, 'saida');
      const result = !b ? '<span class="muted">Ainda sem votos</span>'
        : b.weak ? `<span class="muted">Poucos votos (${b.total})</span>`
          : `${cars(b.zone)}<span><b>${ZONE_LABEL[b.zone]}</b> <span class="muted">· ${b.pct}% de ${b.total}</span></span>`;
      rows.push(`<button class="row-btn" type="button" data-vote="${l.id}|${d}">
        ${badge(l)}<span class="row-main">trens para <b>${esc(destOf(l, d))}</b></span><span class="row-side">${result}</span></button>`);
    }
  }
  $('#vagao-rows').innerHTML = rows.join('') + '<p class="panel-foot">Frente = primeiro vagão no sentido da viagem. Toque numa linha para votar.</p>';

  // Acessibilidade
  // Oficial: a operadora lista quais estações têm elevador; não informa se estão funcionando.
  const off = officialStation(st);
  $('#acess-rows').innerHTML = ACESS.map(a => {
    const s = data?.acess?.[a.item];
    if (!s && a.item === 'elevador' && off) {
      const has = off.servicos.includes('Elevador');
      return `<button class="row-btn" type="button" data-acess="${a.item}"><span class="row-ico">${a.icon}</span><span class="row-main">${a.name}</span><span class="row-side col">${has
        ? '<span class="pill-status ok">Tem (oficial)</span><span class="muted small">não informa se funciona</span>'
        : '<span class="muted">Não consta na lista oficial</span>'}</span></button>`;
    }
    if (!s && a.item === 'escada' && off) {
      return `<button class="row-btn" type="button" data-acess="${a.item}"><span class="row-ico">${a.icon}</span><span class="row-main">${a.name}</span><span class="row-side col"><span class="muted">Não consta na lista oficial</span></span></button>`;
    }
    const val = !s ? '<span class="muted">Sem informação</span>'
      : `<span class="pill-status ${s.ok ? 'ok' : 'bad'}">${s.ok ? a.yes : a.no}</span><span class="muted small">${s.n} ${s.n === 1 ? 'relato' : 'relatos'} · ${ago(new Date(s.at).toISOString())}</span>`;
    return `<button class="row-btn" type="button" data-acess="${a.item}"><span class="row-ico">${a.icon}</span><span class="row-main">${a.name}</span><span class="row-side col">${val}</span></button>`;
  }).join('');

  // Relatos recentes
  const recent = data?.recent || [];
  $('#recent-rows').innerHTML = recent.length ? recent.map(r => {
    const l = lineById(r.line);
    const what = r.type === 'lotacao' ? `${ICON.people}${CROWD_NOW[r.value] || 'Lotação'}`
      : r.type === 'passou' ? `${ICON.check}Trem passou${r.value > 1 ? ` · +${Math.round(r.value)} min` : ''}`
        : r.type === 'parado' ? `${ICON.stop}Trem parado` : `${ICON.snow}Ar-condicionado quebrado`;
    return `<div class="feed-row"><span class="feed-what">${what}</span>${l ? badge(l) : ''}<span class="muted small">${r.ago < 1 ? 'agora' : `há ${r.ago} min`}</span></div>`;
  }).join('') : `<p class="panel-empty">Nenhum relato na última hora. Use <b>Relatar</b> num cartão de trem para avisar outros passageiros.</p>`;
}

$('#live-board').addEventListener('click', e => {
  const b = e.target.closest('[data-report]');
  if (!b) return;
  const [lineId, dir] = b.dataset.report.split('|');
  openReport(lineById(lineId), Number(dir));
});

function openReport(line, dir) {
  const st = state.station;
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

$('#vagao-rows').addEventListener('click', e => {
  const b = e.target.closest('[data-vote]');
  if (!b) return;
  const [lineId, dir] = b.dataset.vote.split('|');
  const line = lineById(lineId), st = state.station;
  let goal = 'saida';
  openAction('Qual o melhor vagão?', `
    <p class="action-sub">${badge(line)} trens para ${esc(destOf(line, Number(dir)))}, em ${esc(st)}</p>
    <div class="seg" role="group" aria-label="Objetivo">
      <button type="button" data-act="goal-saida" aria-pressed="true">Para sair da estação</button>
      <button type="button" data-act="goal-baldeacao" aria-pressed="false">Para fazer baldeação</button>
    </div>
    <div class="zone-pick">${['fundo', 'meio', 'frente'].map(z => `<button type="button" data-act="z-${z}">${cars(z)}<span>${ZONE_LABEL[z]}</span></button>`).join('')}</div>
    <p class="panel-foot">A seta indica o sentido do trem. Frente é o primeiro vagão.</p>`,
  async (act, btn) => {
    if (act.startsWith('goal-')) {
      goal = act.slice(5);
      $$('[data-act^="goal-"]', $('#action-body')).forEach(x => x.setAttribute('aria-pressed', x === btn));
      return;
    }
    return submit({ type: 'vagao', station: st, line: lineId, dir: Number(dir), goal, value: act.slice(2) }, 'Voto registrado. Obrigado!');
  });
});

$('#acess-rows').addEventListener('click', e => {
  const b = e.target.closest('[data-acess]');
  if (!b) return;
  const a = ACESS.find(x => x.item === b.dataset.acess);
  openAction(a.name, `
    <p class="action-sub">Em ${esc(state.station)}, como está agora?</p>
    <div class="two-pick">
      <button type="button" data-act="yes" class="ok">${ICON.check}${a.yes}</button>
      <button type="button" data-act="no" class="bad">${ICON.alert}${a.no}</button>
    </div>`,
  act => submit({ type: 'acess', station: state.station, item: a.item, value: act === 'yes' }));
});

// ---------- Planejar ----------

function setOD(key, name) {
  state.plan[key] = name;
  store.set(key, name);
  state.plan.open = 0;
  renderPlan();
}

$('#plan-from').addEventListener('click', () => openPicker('De onde você sai?', n => setOD('from', n)));
$('#plan-to').addEventListener('click', () => openPicker('Para onde você vai?', n => setOD('to', n)));
$('#plan-swap').addEventListener('click', () => {
  const p = state.plan;
  [p.from, p.to] = [p.to, p.from];
  store.set('from', p.from); store.set('to', p.to);
  p.open = 0;
  renderPlan();
});
$$('[data-when]').forEach(b => b.addEventListener('click', () => {
  state.plan.when = b.dataset.when;
  if (state.plan.when === 'at' && !$('#plan-time').value) {
    const now = spNow();
    $('#plan-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    $('#plan-time').value = fmt(minutesOf(now));
  }
  renderPlan();
}));
$('#plan-date').addEventListener('change', renderPlan);
$('#plan-time').addEventListener('change', renderPlan);
$('#plan-results').addEventListener('click', e => {
  const b = e.target.closest('[data-route]');
  if (!b) return;
  const i = Number(b.dataset.route);
  state.plan.open = state.plan.open === i ? -1 : i;
  renderPlan();
});

function renderPlan() {
  const p = state.plan;
  const setVal = (id, v, ph) => {
    const el = $(`#${id} .od-val`);
    el.textContent = v || ph;
    el.classList.toggle('placeholder', !v);
  };
  setVal('plan-from', p.from, 'Escolha a origem');
  setVal('plan-to', p.to, 'Escolha o destino');
  $$('[data-when]').forEach(b => b.setAttribute('aria-pressed', b.dataset.when === p.when));
  $('#plan-at').hidden = p.when !== 'at';

  const out = $('#plan-results');
  if (!p.from || !p.to) {
    out.innerHTML = `<div class="empty">${ICON.route}<b>Para onde vamos?</b>Escolha a origem e o destino para ver as melhores opções de viagem.</div>`;
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
    out.innerHTML = `<div class="empty">${ICON.clock}<b>Nenhuma viagem encontrada</b>Não há trens a partir desse horário (${DAY_LABELS[dt].toLowerCase()}). Tente outro horário.</div>`;
    return;
  }
  const fastest = results.reduce((a, b) => (b.arr - b.dep < a.arr - a.dep ? b : a));
  out.innerHTML = `<div class="results-head"><span>${results.length} opções · ${DAY_LABELS[dt]}</span></div>` +
    results.map((r, i) => routeCard(r, i, r === results[0] ? 'Chega primeiro' : r === fastest ? 'Mais rápida' : '', today ? minutesOf(now) : null)).join('');

  // Dados de lotação e vagão das estações de embarque, baldeação e destino.
  const needed = [...new Set(results.flatMap(r => r.legs.flatMap(l => [l.from, l.to])))];
  Promise.all(needed.map(n => loadStation(n, dt))).then(fresh => {
    if (fresh.some(Boolean) && state.tab === 'plan') renderPlan();
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
    r.legs.map(l => badge(l.trip.line)).join(`<span aria-hidden="true">›</span>`),
    transfers ? `${transfers} ${transfers > 1 ? 'baldeações' : 'baldeação'}` : 'Direto',
    leave != null && leave >= 0 && leave < 120 ? `<span class="go">Sai ${inText(leave)}</span>` : '',
  ].filter(Boolean).join('<span class="sep"></span>');
  const warn = alertsFor({ lines: r.legs.map(l => l.trip.line.id), stations: r.legs.flatMap(l => [l.from, l.to]) });

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
      ? `<span class="car-hint">${cars(car.zone)}Embarque no vagão do <b>${ZONE_LABEL[car.zone].toLowerCase()}</b> para ${last ? 'sair mais rápido' : 'agilizar a baldeação'}</span>` : '';
    html += `<li class="ride" style="--c:${c}"><span></span><span class="rail"></span>
      <div class="what">${badge(l.trip.line)} ${l.count} ${l.count === 1 ? 'estação' : 'estações'} · ${dur(l.arr - l.dep)}${crowd ? crowdChip(crowd) : ''}${carHint}</div></li>`;
    html += `<li class="stop ${last ? 'last' : ''}" style="--c:${c}"><time>${fmt(l.arr)}</time><span class="rail"></span>
      <div class="what"><b>${esc(l.to)}</b><span class="sub">${last ? 'Chegada' : 'Desembarque'}</span></div></li>`;
  });
  return `<ol class="tl">${html}</ol>`;
}

// ---------- Ramais ----------

function lineSummary(line, dt) {
  const deps = tripsFor(dt).filter(t => t.line === line && t.dir === 0).map(t => t.stops[0].time).sort((a, b) => a - b);
  if (!deps.length) return null;
  return { first: deps[0], last: deps[deps.length - 1], count: deps.length };
}

function freqText(line, dt) {
  const s = line.service[dt];
  if (DATA_MODE === 'simulado' && s && !s.times) return s.peak === s.off ? `a cada ${s.off} min` : `${s.peak}–${s.off} min`;
  const sum = lineSummary(line, dt);
  if (!sum) return '—';
  return sum.count > 1 ? `~${Math.round((sum.last - sum.first) / (sum.count - 1))} min` : '1 viagem';
}

$('#lines-items').addEventListener('click', e => {
  const b = e.target.closest('[data-line]');
  if (b) { state.lineId = b.dataset.line; renderLines(); window.scrollTo(0, 0); }
});

function renderLines() {
  const now = spNow(), m = minutesOf(now), dt = dayTypeOf(now);
  if (state.lineId) return renderLineDetail(lineById(state.lineId), m, dt);
  $('#line-detail').hidden = true;
  $('#lines-list').hidden = false;
  $('#lines-items').innerHTML = LINES.map(l => {
    const running = liveTrips(m, dt, l.id).length;
    return `<button class="line-item" type="button" style="--c:${l.color}" data-line="${l.id}">
      <span class="bar"></span>
      <span><h3>${esc(l.name)}</h3><p>${esc(l.from)} → ${esc(l.to)}</p>
        <span class="live-count ${running ? '' : 'off'}">${running ? `${running} ${running === 1 ? 'trem' : 'trens'} agora` : 'Sem trens agora'}</span></span>
      <span class="side">${ICON.chev}</span>
    </button>`;
  }).join('');
}

function renderLineDetail(line, m, dt) {
  $('#lines-list').hidden = true;
  const box = $('#line-detail');
  box.hidden = false;
  const n = line.stops.length, ROW = 48, PAD = 10;
  const live = liveTrips(m, dt, line.id);
  const sum = lineSummary(line, dt);
  const trains = live.map(t => {
    const p = tripPosition(t, m);
    const idx = t.dir === 0 ? p : n - 1 - p;
    const label = `Trem para ${t.dest}${t.delay ? `, ${t.delay} min de atraso` : ''}`;
    return `<div class="train d${t.dir}${t.delay ? ' late' : ''}" style="top:${PAD + idx * ROW + ROW / 2}px" title="${esc(label)}" role="img" aria-label="${esc(label)}">${t.dir ? ICON.up : ICON.down}</div>`;
  }).join('');

  box.innerHTML = `
    <button class="back" id="line-back" type="button">${ICON.back}Ramais</button>
    <div class="card line-hero" style="--c:${line.color}">
      ${badge(line)}
      <h1>${esc(line.from)} → ${esc(line.to)}</h1>
      <p>${esc(line.kind)} · ${DAY_LABELS[dt]}</p>
      <div class="stats">
        <div class="stat"><b>${live.length}</b><span>trens agora</span></div>
        <div class="stat"><b>${freqText(line, dt)}</b><span>intervalo</span></div>
        <div class="stat"><b>${sum ? `${fmt(sum.first)}` : '—'}</b><span>primeiro trem</span></div>
        <div class="stat"><b>${sum ? `${fmt(sum.last)}` : '—'}</b><span>último trem</span></div>
      </div>
      <div class="hero-actions">
        <a class="btn" href="#times" id="line-times">${ICON.times}Ver horários</a>
        <span class="hero-note">${n} estações · ${dur(line.stops[n - 1][1])} de ponta a ponta</span>
      </div>
    </div>
    <div class="legend">
      <span><span class="train d0">${ICON.down}</span>para ${esc(line.to)}</span>
      <span><span class="train d1">${ICON.up}</span>para ${esc(line.from)}</span>
      <span><span class="train late">${ICON.down}</span>atrasado</span>
    </div>
    <div class="card diagram" style="--c:${line.color}">
      <div class="track" style="top:${PAD + ROW / 2}px;height:${(n - 1) * ROW}px"></div>
      ${line.stops.map(([name, off], i) => `<div class="st ${i === 0 || i === n - 1 ? 'term' : ''}">
        <span class="st-name">${esc(name)}</span><span class="st-time">${off ? `+${off} min` : 'início'}</span></div>`).join('')}
      ${trains}
    </div>`;
  $('#line-back').onclick = () => { state.lineId = null; renderLines(); };
  $('#line-times').onclick = () => { state.times.line = line.id; state.times.station = null; };
}

// ---------- Horários ----------

// ---------- Dados oficiais da operadora ----------

const DIA_LABEL = { util: 'dias úteis', sab: 'sábado', dom: 'domingo e feriados' };

// Primeiro e último trem oficiais desta estação para o destino, no tipo de dia.
function officialLine(station, dest, dayType) {
  const st = officialStation(station);
  if (!st) return null;
  const rows = st.trens.filter(t => t.para === dest && t.dia === dayType);
  return rows.length ? { first: rows.map(r => r.primeiro).sort()[0], last: rows.map(r => r.ultimo).sort().at(-1) } : null;
}

function officialHeader(o) {
  if (!o) return '';
  return `<div class="official-note">${ICON.check}<span>Oficial (${DIA_LABEL[state.times.day] || ''}): 1º trem <b>${o.first}</b> · último <b>${o.last}</b>. Os horários entre eles são estimados.</span></div>`;
}

// Painel "Informações oficiais" da estação: ramais, funcionamento, serviços e destinos de hoje.
function renderOfficial(st, dt) {
  const off = officialStation(st);
  const box = $('#official-body');
  if (!off) {
    box.innerHTML = '<p class="panel-empty">Esta estação não tem dados publicados pela operadora.</p>';
    return;
  }
  const h = off.horario && off.horario[dt];
  const hoje = off.trens.filter(t => t.dia === dt);
  const dests = [...new Set(hoje.map(t => t.para))];
  const svc = off.servicos.length ? off.servicos.map(s => `<span class="svc">${esc(s)}</span>`).join('') : '<span class="muted small">Nenhum listado</span>';
  box.innerHTML = `
    <div class="off-row"><span class="off-k">Funcionamento</span><span class="off-v">${h ? `${h[0]} às ${h[1]}` : 'Sem horário publicado'} <span class="muted small">(${DIA_LABEL[dt]})</span></span></div>
    <div class="off-row"><span class="off-k">Ramais</span><span class="off-v badges">${off.ramais.map(r => { const l = LINES.find(x => x.name === r); return l ? badge(l) : esc(r); }).join(' ')}</span></div>
    <div class="off-row"><span class="off-k">Serviços</span><span class="off-v svcs">${svc}</span></div>
    ${dests.length ? `<div class="off-sub">Primeiro e último trem (${DIA_LABEL[dt]})</div>` +
      dests.map(d => { const o = officialLine(st, d, dt); return `<div class="off-row"><span class="off-k">Para ${esc(d)}</span><span class="off-v tnum">${o.first} – ${o.last}</span></div>`; }).join('') : ''}
    <p class="panel-foot">Fonte: <a href="https://trensrj.com.br/pt/conheca-as-estacoes/${off.slug}" target="_blank" rel="noopener">página da estação no site da TrensRJ</a> · coletado em ${new Date(window.OFICIAL.coletadoEm).toLocaleDateString('pt-BR')}</p>`;
}

function renderTimes() {
  const t = state.times;
  if (!t.day) t.day = dayTypeOf(spNow());
  const line = lineById(t.line) || LINES[0];
  const order = t.dir === 0 ? line.stops : [...line.stops].reverse();
  const options = order.slice(0, -1).map(([n]) => n);
  if (!options.includes(t.station)) t.station = options.includes(state.station) ? state.station : options[0];

  $('#times-lines').innerHTML = LINES.map(l =>
    `<button class="lchip" type="button" style="--c:${l.color}" data-tl="${l.id}" aria-pressed="${l.id === line.id}"><i></i>${esc(l.name)}</button>`).join('');
  $('#times-dir').innerHTML = [0, 1].map(d =>
    `<button type="button" data-td="${d}" aria-pressed="${t.dir === d}">para ${esc(d === 0 ? line.to : line.from)}</button>`).join('');
  $('#times-day').innerHTML = [['util', 'Dia útil'], ['sab', 'Sábado'], ['dom', 'Domingo']].map(([k, v]) =>
    `<button type="button" data-tday="${k}" aria-pressed="${t.day === k}">${v}</button>`).join('');
  $('#times-station').innerHTML = options.map(n => `<option ${n === t.station ? 'selected' : ''}>${esc(n)}</option>`).join('');

  const times = tripsFor(t.day)
    .filter(x => x.line.id === line.id && x.dir === t.dir)
    .map(x => ({ s: x.stops.find(s => s.name === t.station), dest: x.dest }))
    .filter(x => x.s && withinOfficial(t.station, x.dest, x.s.time, t.day))
    .map(x => x.s.time).sort((a, b) => a - b);
  const official = officialLine(t.station, destOf(line, t.dir), t.day);
  if (!times.length) {
    $('#times-table').innerHTML = `${officialHeader(official)}<div class="empty">${ICON.clock}<b>Sem operação</b>Este ramal não opera neste dia.</div>`;
    return;
  }
  const now = spNow();
  const isToday = t.day === dayTypeOf(now), m = minutesOf(now);
  const nextT = isToday ? times.find(x => x >= m) : undefined;
  const byHour = new Map();
  for (const x of times) {
    const h = Math.floor(x / 60);
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h).push(x);
  }
  const curHour = nextT !== undefined ? Math.floor(nextT / 60) : null;
  const hidden = curHour != null && !t.showPast ? [...byHour.keys()].filter(h => h < curHour).length : 0;
  const hours = [...byHour].filter(([h]) => !hidden || h >= curHour);
  $('#times-table').innerHTML = `
    ${officialHeader(official)}
    <div class="times-summary"><span><b>${times.length}</b> partidas estimadas de ${esc(t.station)}</span>
      ${nextT !== undefined ? `<span>Próximo: <b>${fmt(nextT)}</b> (${inText(nextT - m)})</span>` : ''}</div>
    ${hidden ? `<button class="show-past" type="button" id="times-past">Mostrar ${hidden} ${hidden === 1 ? 'hora anterior' : 'horas anteriores'}</button>` : ''}
    <div class="hours">${hours.map(([h, xs]) => `
      <div class="hour ${nextT !== undefined && Math.floor(nextT / 60) === h ? 'current' : ''}"><b>${String(h % 24).padStart(2, '0')}h</b>
        <span class="mins">${xs.map(x => `<span class="${x === nextT ? 'next' : isToday && x < m ? 'past' : ''}">${String(Math.round(x) % 60).padStart(2, '0')}</span>`).join('')}</span></div>`).join('')}
    </div>`;
  const past = $('#times-past');
  if (past) past.onclick = () => { t.showPast = true; renderTimes(); };
}

$('#times-lines').addEventListener('click', e => { const b = e.target.closest('[data-tl]'); if (b) { state.times.line = b.dataset.tl; state.times.showPast = false; renderTimes(); } });
$('#times-dir').addEventListener('click', e => { const b = e.target.closest('[data-td]'); if (b) { state.times.dir = Number(b.dataset.td); renderTimes(); } });
$('#times-day').addEventListener('click', e => { const b = e.target.closest('[data-tday]'); if (b) { state.times.day = b.dataset.tday; renderTimes(); } });
$('#times-station').addEventListener('change', e => { state.times.station = e.target.value; renderTimes(); });

// ---------- Avisos e pontualidade ----------

state.punctDays = 30;

function renderStatusView() {
  const alerts = COMM.overview?.alerts || [];
  $('#status-alerts').innerHTML = alerts.length ? alerts.map(alertCard).join('')
    : !COMM.overview
      ? `<div class="empty">${ICON.wifiOff}<b>Avisos indisponíveis</b>Não foi possível falar com o servidor agora.</div>`
      : `<div class="ok-state">${ICON.check}<div><b>Nenhum aviso agora</b><span>Sem paralisações ou alertas de segurança perto das estações.</span></div></div>`;

  $$('[data-days]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.days) === state.punctDays));
  const data = COMM.punct.get(state.punctDays);
  if (!data) {
    $('#punct-list').innerHTML = '<div class="skeleton" style="height:240px"></div>';
    loadPunctuality(state.punctDays).then(ok => {
      if (ok && state.tab === 'status') renderStatusView();
      else if (!ok) $('#punct-list').innerHTML = `<div class="empty">${ICON.wifiOff}<b>Sem dados de pontualidade</b>Tente de novo quando estiver online.</div>`;
    });
    return;
  }
  const MIN = 20;
  const rows = data.lines.map(x => ({ ...x, line: lineById(x.line) })).filter(x => x.line)
    .sort((a, b) => (b.n >= MIN) - (a.n >= MIN) || (b.onTimePct ?? -1) - (a.onTimePct ?? -1));
  $('#punct-list').innerHTML = rows.map((x, i) => {
    if (x.n < MIN) {
      return `<div class="punct few"><span class="rank">–</span>${badge(x.line)}<span class="muted small">Poucos relatos (${x.n}) para calcular</span></div>`;
    }
    const tone = x.onTimePct >= 80 ? 'ok' : x.onTimePct >= 60 ? 'mid' : 'bad';
    return `<div class="punct">
      <span class="rank">${i + 1}</span>
      <div class="punct-main">
        <div class="punct-top">${badge(x.line)}<b class="pct ${tone}">${x.onTimePct}%</b><span class="muted small">no horário</span></div>
        <div class="punct-bar"><i class="${tone}" style="width:${x.onTimePct}%"></i></div>
        <div class="punct-meta muted small">Atraso médio ${x.avgDelay} min · ${x.stops} ${x.stops === 1 ? 'paralisação relatada' : 'paralisações relatadas'}${x.worst ? ` · pior horário ${String(x.worst.hour).padStart(2, '0')}h (+${x.worst.avg} min)` : ''} · ${x.n} relatos</div>
      </div>
    </div>`;
  }).join('');
}

$('#punct-days').addEventListener('click', e => {
  const b = e.target.closest('[data-days]');
  if (b) { state.punctDays = Number(b.dataset.days); renderStatusView(); }
});

// ---------- Início ----------

setTab(location.hash.slice(1) || 'live');
setInterval(() => { if (state.tab === 'live' || state.tab === 'lines') render(); }, 15000);

async function pollRealtime() { await refreshRealtime(); render(); }
pollRealtime();
setInterval(pollRealtime, 30000);

async function pollOverview() {
  await loadOverview(dayTypeOf(spNow()));
  if (state.tab === 'status') await loadPunctuality(state.punctDays);
  render();
}
pollOverview();
setInterval(pollOverview, 60000);

flushQueue();
window.addEventListener('online', () => { toast('Conexão de volta.'); pollOverview(); });
window.addEventListener('offline', () => { toast('Sem internet: horários e rotas continuam funcionando.'); render(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Quando uma versão nova do app assume, recarrega uma vez para não misturar arquivos antigos e novos.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem modo offline */ });
}
