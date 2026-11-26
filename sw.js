/* RECON service worker: app-shell cache, Firebase push (data-only), notification clicks. */
importScripts('js/config.js');
var CACHE = 'recon-shell-v32';
var SHELL = ['./', 'index.html', 'login.html', 'css/styles.css', 'css/modern.css', 'css/brand.css', 'js/splash.js', 'js/config.js', 'js/api.js', 'js/app.js', 'js/notify.js', 'js/ui.js', 'js/shield-import.js', 'js/roll-parse.js', 'js/roll.js', 'js/roll-export.js', 'js/competitions.js',
             'manifest.webmanifest', 'img/icon-192.png', 'img/icon-512.png'];

self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE && k.indexOf('recon-shell') === 0; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});

// Network-first for same-origin shell files (so updates arrive), cache fallback offline. API calls are never cached here (api.js uses IndexedDB).
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(function (res) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); return res; })
      .catch(function () { return caches.match(req).then(function (h) { return h || (req.mode === 'navigate' ? caches.match('index.html') : undefined); }); }));
  } else if (/cdnjs\.cloudflare\.com|gstatic\.com\/firebasejs/.test(url.host + url.pathname)) {
    e.respondWith(caches.match(req).then(function (h) { return h || fetch(req).then(function (res) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); return res; }); }));
  }
});

// ---- Firebase Cloud Messaging (data-only messages; we display the notification ourselves) ----
var fb = self.RECON_CONFIG && self.RECON_CONFIG.FIREBASE;
if (fb && fb.projectId) {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp(fb);
  var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function (payload) {
    var d = payload.data || {};
    self.clients.matchAll({ type: 'window' }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ type: 'push' }); }); });
    return self.registration.showNotification(d.title || 'RECON', { body: d.body || '', icon: 'img/icon-192.png', badge: 'img/favicon-32.png', tag: d.id || undefined, data: { link: d.link || '' } });
  });
}
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var link = (e.notification.data && e.notification.data.link) || '';
  var target = new URL('index.html' + (link ? link : ''), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if (cs[i].url.indexOf('index.html') >= 0 || cs[i].url === self.registration.scope) { cs[i].focus(); if (link) cs[i].postMessage({ type: 'nav', page: link.replace('#', '') }); return; }
    return self.clients.openWindow(target);
  }));
});
