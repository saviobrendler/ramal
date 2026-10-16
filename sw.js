// Ramal — service worker.
// Estratégia: rede primeiro (sempre pega a versão nova); cache só quando não há internet.
// Assim o celular não fica preso em uma versão antiga depois de uma atualização.

const CACHE = 'ramal-v42';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/community.js', '/data.js', '/holidays.js', '/schedule.js', '/gtfs-data.js',
  '/oficial-data.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon.svg'];

self.addEventListener('install', e => {
  // Pré-carrega o app. Um arquivo que falhar não impede a instalação.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Dados de moderação nunca vão para o cache do aparelho.
  if (url.pathname.startsWith('/api/admin/')) return;

  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('/index.html');
      return new Response('{"offline":true}', { status: 503, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
