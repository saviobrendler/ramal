// Ramal — servidor: entrega o site e o endpoint /api/realtime.
//
//   node server.js                          → só o site (sem tempo real)
//   RT_URL=... RT_FORMAT=gtfs-rt node server.js
//
// Variáveis de ambiente:
//   PORT          porta (padrão 5173)
//   RT_URL        endereço do feed de tempo real (http/https ou caminho de arquivo local)
//   RT_FORMAT     gtfs-rt (TripUpdates em protobuf) ou json  (padrão gtfs-rt)
//   RT_HEADERS    cabeçalhos extras em JSON, ex.: {"x-api-key":"..."}
//   RT_SOURCE     nome da fonte exibido no site
//   RT_INTERVAL   segundos entre consultas à fonte (padrão 30)
//
// Formato json aceito: { "delays": { "<trip_id>": <atraso em segundos>, ... } }
//                   ou [ { "trip_id": "...", "delay": <segundos> }, ... ]

const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const root = __dirname;
// Argumentos --rt-url=..., --rt-format=... etc. também funcionam e têm prioridade sobre o ambiente.
const cli = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('=');
  return [k.toUpperCase().replace(/-/g, '_'), v.join('=')];
}));
const env = k => cli[k] ?? process.env[k];

const PORT = Number(env('PORT')) || 5173;
const RT = {
  url: env('RT_URL') || '',
  format: (env('RT_FORMAT') || 'gtfs-rt').toLowerCase(),
  headers: env('RT_HEADERS') ? JSON.parse(env('RT_HEADERS')) : {},
  source: env('RT_SOURCE') || '',
  interval: (Number(env('RT_INTERVAL')) || 30) * 1000,
};
const MAX_AGE_MS = 5 * 60 * 1000; // dados mais velhos que isso não contam como "ao vivo"

let snapshot = { active: false, source: null, updatedAt: null, delays: {}, error: RT.url ? null : 'RT_URL não configurado' };

async function readSource() {
  if (/^https?:\/\//.test(RT.url)) {
    const res = await fetch(RT.url, { headers: RT.headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.promises.readFile(path.resolve(root, RT.url));
}

function parseGtfsRt(buf) {
  let bindings;
  try { bindings = require('gtfs-realtime-bindings'); }
  catch { throw new Error('Pacote gtfs-realtime-bindings ausente. Rode: npm install'); }
  const feed = bindings.transit_realtime.FeedMessage.decode(buf);
  const delays = {};
  for (const e of feed.entity) {
    const tu = e.tripUpdate;
    if (!tu || !tu.trip || !tu.trip.tripId) continue;
    // Atraso: o da viagem, ou o primeiro informado nas paradas.
    // (protobufjs devolve 0 para campos ausentes, por isso o teste com hasOwnProperty.)
    const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);
    let d = has(tu, 'delay') ? tu.delay : null;
    if (d == null) {
      for (const u of tu.stopTimeUpdate || []) {
        const ev = has(u, 'arrival') ? u.arrival : has(u, 'departure') ? u.departure : null;
        if (has(ev, 'delay')) { d = ev.delay; break; }
      }
    }
    if (d != null) delays[tu.trip.tripId] = Number(d);
  }
  return delays;
}

function parseJson(buf) {
  const j = JSON.parse(buf.toString('utf8'));
  if (Array.isArray(j)) return Object.fromEntries(j.map(x => [x.trip_id, Number(x.delay)]));
  return j.delays || {};
}

async function poll() {
  if (!RT.url) return;
  try {
    const buf = await readSource();
    const secs = RT.format === 'json' ? parseJson(buf) : parseGtfsRt(buf);
    const delays = Object.fromEntries(Object.entries(secs).map(([id, s]) => [id, Math.round(s / 6) / 10]));
    snapshot = { active: true, source: RT.source || null, updatedAt: new Date().toISOString(), delays, error: null };
    console.log(`[tempo real] ${Object.keys(delays).length} viagens atualizadas`);
  } catch (err) {
    snapshot = { ...snapshot, error: String(err.message || err) };
    console.error(`[tempo real] falha: ${snapshot.error}`);
  }
}

function realtimeResponse() {
  const fresh = snapshot.updatedAt && Date.now() - Date.parse(snapshot.updatedAt) < MAX_AGE_MS;
  return { ...snapshot, active: Boolean(snapshot.active && fresh) };
}

// ---------- Relatos e alertas ----------

const { Community, HttpError, migrateJson } = require('./server/community');
const { Safety } = require('./server/safety');
const dbFile = path.resolve(root, env('COMMUNITY_FILE') || 'data/community.db');
const community = new Community({ root, file: dbFile });
const migrated = migrateJson(community, path.resolve(root, 'data/community.json'));
if (migrated) console.log(`Relatos antigos importados do JSON: ${migrated}`);
const safety = new Safety({ root, net: community.net, env });
const ADMIN_TOKEN = env('ADMIN_TOKEN') || '';
const shutdown = () => { try { community.close(); } catch { /* já fechado */ } process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const dayParam = d => (['util', 'sab', 'dom'].includes(d) ? d : 'util');

function sendJson(res, status, body, cache = 'no-store') {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 4096) { reject(new HttpError(413, 'Corpo muito grande')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new HttpError(400, 'JSON inválido')); }
    });
  });
}

async function api(req, res, url, q) {
  if (url === '/api/realtime') return sendJson(res, 200, realtimeResponse());
  if (url === '/api/overview') {
    return sendJson(res, 200, {
      alerts: [...safety.alerts(), ...community.stoppedAlerts()].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))),
      crowdLine: community.crowd(dayParam(q.get('day'))),
      updatedAt: new Date().toISOString(),
    });
  }
  if (url === '/api/station') return sendJson(res, 200, community.station(q.get('name') || '', dayParam(q.get('day'))));
  if (url === '/api/punctuality') {
    const days = [7, 30, 90].includes(Number(q.get('days'))) ? Number(q.get('days')) : 30;
    return sendJson(res, 200, community.punctuality(days));
  }
  if (url === '/api/reports' && req.method === 'POST') {
    const body = await readBody(req);
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
    return sendJson(res, 201, community.add(body, { ip }));
  }
  if (url === '/api/health') return sendJson(res, 200, { ok: true, fogoCruzado: safety.fcStatus, reports: community.count() });
  if (url.startsWith('/api/admin/')) return adminApi(req, res, url, q);
  throw new HttpError(404, 'Rota não encontrada');
}

// Moderação. Exige ADMIN_TOKEN no cabeçalho "Authorization: Bearer <token>". Sem ADMIN_TOKEN, fica desligada.
async function adminApi(req, res, url, q) {
  if (!ADMIN_TOKEN) throw new HttpError(404, 'Rota não encontrada');
  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given), b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Não autorizado');

  if (url === '/api/admin/reports' && req.method === 'GET') {
    return sendJson(res, 200, { reports: community.listRecent(Number(q.get('limit')) || 100), total: community.count() });
  }
  if (url === '/api/admin/hide' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, 200, community.hide(body.id));
  }
  if (url === '/api/admin/block' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, 200, community.block(body.dev, body.reason));
  }
  if (url === '/api/admin/unblock' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, 200, community.unblock(body.dev));
  }
  throw new HttpError(404, 'Rota não encontrada');
}

// ---------- Arquivos do site ----------

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};
const PUBLIC = new Set(['/index.html', '/styles.css', '/app.js', '/community.js', '/data.js', '/schedule.js', '/gtfs-data.js', '/oficial-data.js',
  '/sw.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/icon.svg']);

http.createServer(async (req, res) => {
  const [rawPath, qs = ''] = req.url.split('?');
  const url = decodeURIComponent(rawPath);

    if (url.startsWith('/api/')) {
    // CORS: o plugin do WordPress (outro domínio) chama a API. RAMAL_CORS_ORIGIN limita a origem; padrão: qualquer uma.
    res.setHeader('Access-Control-Allow-Origin', env('RAMAL_CORS_ORIGIN') || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    try { await api(req, res, url, new URLSearchParams(qs)); }
    catch (e) { sendJson(res, e.status || 500, { error: e.status ? e.message : 'Erro interno' }); if (!e.status) console.error(e); }
    return;
  }

  const rel = url === '/' ? '/index.html' : url;
  if (!PUBLIC.has(rel)) { res.writeHead(404); return res.end('Não encontrado'); }
  const file = path.join(root, rel);
  fs.readFile(file, (err, data) => {
    if (err && rel === '/gtfs-data.js') data = '/* Nenhum GTFS importado: o site usa os dados de demonstração. */';
    else if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    const head = { 'Content-Type': types[path.extname(file)] + (/\.(png)$/.test(file) ? '' : '; charset=utf-8'), 'Cache-Control': 'no-cache' };
    if (rel === '/sw.js') head['Service-Worker-Allowed'] = '/';
    res.writeHead(200, head);
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Ramal em http://localhost:${PORT}`);
  console.log(RT.url ? `Tempo real: ${RT.format} de ${RT.url} a cada ${RT.interval / 1000}s` : 'Tempo real: desligado (defina RT_URL)');
  console.log(`Relatos: ${community.count()} em ${community.file}`);
  console.log(ADMIN_TOKEN ? 'Moderação: ligada (ADMIN_TOKEN definido)' : 'Moderação: desligada (defina ADMIN_TOKEN)');
  console.log(`Fogo Cruzado: ${safety.fcStatus}`);
});

poll();
setInterval(poll, RT.interval);
