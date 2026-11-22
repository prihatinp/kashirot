/* KASHIROT service worker — app tetap terbuka tanpa internet */
const CACHE = 'kashirot-v1.2.0';
const FILES = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/config.js', 'js/data-awal.js', 'lib/xlsx.full.min.js', 'lib/chart.umd.min.js',
  'fonts/poppins-latin-400-normal.woff2', 'fonts/poppins-latin-600-normal.woff2', 'fonts/poppins-latin-700-normal.woff2',
  'icons/logo.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // sinkron ke Apps Script tidak di-cache
  // network-first agar update dari GitHub langsung terpakai, fallback cache saat offline
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
