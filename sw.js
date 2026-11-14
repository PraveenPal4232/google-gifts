// Google Gifts service worker. Bump VERSION when shell files change.
const VERSION = 'v2-2026-11-14';
const SHELL = `shell-${VERSION}`;
const IMAGES = 'images-v1';
const PRECACHE = ['./', 'index.html', 'css/style.css', 'js/main.js', 'data/tools.json', 'manifest.json', 'img/favicon.png', 'img/info/android-chrome-192x192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== IMAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Images: cache-first (they rarely change).
  if (req.destination === 'image') {
    e.respondWith(caches.open(IMAGES).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Everything else (HTML, CSS, JS, JSON): network-first so data stays fresh, cache as offline fallback.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: req.mode === 'navigate' })) ?? caches.match('index.html'))
  );
});
