// Ramal — service worker: o app abre e funciona sem internet.
// Arquivos do site: serve do cache e atualiza em segundo plano.
// API (GET): tenta a rede; sem rede, usa a última resposta guardada.

const VERSION = 'ramal-v40';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/community.js', '/data.js', '/schedule.js', '/gtfs-data.js', '/oficial-data.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(r => r || new Response('{"offline":true}', { status: 503, headers: { 'Content-Type': 'application/json' } }))),
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const net = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached || caches.match('/index.html'));
      return cached || net;
    }),
  );
});
