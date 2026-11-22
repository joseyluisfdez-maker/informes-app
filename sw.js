// Service worker de Informes. Red primero para la página (siempre la versión nueva si hay conexión);
// si no hay red, usa la última copia. Nunca toca peticiones a GitHub ni al worker de IA.
const CACHE = 'informes-2.2.0';
const PAGE_KEY = 'index.html';
const STATIC = ["manifest.json", "icons/icon-192.png", "icons/icon-512.png", "fonts/lora-latin-400-normal.woff2", "fonts/lora-latin-600-normal.woff2", "fonts/lora-latin-400-italic.woff2", "fonts/mulish-latin-300-normal.woff2", "fonts/mulish-latin-400-normal.woff2", "fonts/mulish-latin-500-normal.woff2", "fonts/mulish-latin-600-normal.woff2", "fonts/mulish-latin-700-normal.woff2"];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    var page = fetch('./', { cache: 'no-store' }).then(function (r) { if (r && r.ok) return c.put(PAGE_KEY, r); }).catch(function () {});
    return Promise.all([page].concat(STATIC.map(function (u) { return c.add(u).catch(function () {}); })));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function withTimeout(p, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith((async function () {
      var cache = await caches.open(CACHE);
      try {
        var res = await withTimeout(fetch(req, { cache: 'no-store' }), 5000);
        if (res && res.ok) cache.put(PAGE_KEY, res.clone());
        return res;
      } catch (err) {
        var hit = await cache.match(PAGE_KEY);
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  e.respondWith((async function () {
    var cache = await caches.open(CACHE);
    var hit = await cache.match(req);
    if (hit) return hit;
    var res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  })());
});
