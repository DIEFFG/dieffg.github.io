/* The Christian Sanctuary - service worker
   Scope: /church/  (set by where this file lives). Cache names all start with "church-" and we only ever
   touch caches with that prefix, because other apps share this web address. */
var SHELL = 'church-shell-v1';
var RUNTIME = 'church-runtime-v1';
var ASSETS = [
  './', './index.html', './install.html', './css/app.css', './css/brand.css',
  './js/config.js', './js/api.js', './js/splash.js', './js/app.js', './js/ui.js', './js/notify.js', './js/vendor/lucide.min.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/logo-256.png', './icons/favicon-48.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) {
    return Promise.all(ASSETS.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); });
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('church-') === 0 && k !== SHELL && k !== RUNTIME; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

function networkFirst(req, cacheName, fallbackUrl, timeoutMs) {
  return new Promise(function (resolve) {
    var done = false, timer = setTimeout(function () { fromCache(); }, timeoutMs || 4000);
    function fromCache() {
      caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || (fallbackUrl && caches.match(fallbackUrl)); }).then(function (hit) { if (hit && !done) { done = true; resolve(hit); } });
    }
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) { var copy = res.clone(); caches.open(cacheName).then(function (c) { c.put(req, copy); }); }
      if (!done) { done = true; resolve(res); }
    }).catch(function () { clearTimeout(timer); fromCache(); setTimeout(function () { if (!done) { done = true; resolve(new Response('Offline', { status: 503 })); } }, 300); });
  });
}
function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.hostname === 'script.google.com' || url.hostname.endsWith('googleusercontent.com')) return;      // the church API: never cached here
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf('/church/') !== 0) return;                                                         // not ours
    if (req.mode === 'navigate') { e.respondWith(networkFirst(req, SHELL, './index.html', 4000)); return; }
    e.respondWith(url.pathname.endsWith('/sw.js') ? fetch(req) : networkFirst(req, SHELL, null, 3000));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'drive.google.com' || url.hostname === 'lh3.googleusercontent.com') {
    e.respondWith(staleWhileRevalidate(req, RUNTIME));
  }
});

// ----- push: messages are data-only, so the text shown is always the generic one the server chose -----
self.addEventListener('push', function (e) {
  var d = {};
  try { var j = e.data ? e.data.json() : {}; d = j.data || j.notification || j || {}; } catch (x) { d = {}; }
  var title = d.title || 'The Christian Sanctuary', body = d.body || 'You have a new message';
  e.waitUntil(self.registration.showNotification(title, {
    body: body, icon: './icons/icon-192.png', badge: './icons/badge-96.png', tag: d.tag || 'church', renotify: true,
    data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) { list[i].postMessage({ type: 'OPEN', url: target }); return list[i].focus(); }
    }
    return self.clients.openWindow(target);
  }));
});
