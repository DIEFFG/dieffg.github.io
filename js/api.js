/* RECON API client + google.script.run compatibility shim + offline queue. */
(function () {
  'use strict';
  var CFG = window.RECON_CONFIG, SKEY = 'reconSession';
  var NEVER_QUEUE = /^(login|register|guest|changePassword|resetUserPassword|createUser|notif)/;
  var MUTATION = /^(add|update|delete|approve|deny|import|register|process|sync|cleanup|standardize|normalize|set|reset|send)/;
  var ONLINE_ONLY = /^(shield(Import|Sources|PointsTable|Platoons|Pubspeak)|roll|comp)/;   // Shield import tools: never cached, never queued offline
  var ALIAS = { authenticateUser: 'login', registerUser: 'register', loginAsGuest: 'guest', changeUserPassword: 'changePassword' };

  // ---------- session ----------
  function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function setSession(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
  function clearSession() { try { localStorage.removeItem(SKEY); localStorage.removeItem('reconUser'); } catch (e) {} try { idb('cache', 'readwrite', function (st) { return st.clear(); }); } catch (e) {} }

  // ---------- tiny IndexedDB helper ----------
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no idb'));
      var r = indexedDB.open('recon', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('queue', { keyPath: 'clientId' }); d.createObjectStore('cache', { keyPath: 'key' }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function idb(store, mode, fn) {
    return db().then(function (d) { return new Promise(function (res, rej) {
      var tx = d.transaction(store, mode), st = tx.objectStore(store), out = fn(st);
      tx.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); }; tx.onerror = function () { rej(tx.error); };
    }); });
  }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : 'c' + Date.now() + Math.random().toString(16).slice(2)); }

  // ---------- core call ----------
  function post(action, args, clientId, tokenOverride) {
    var s = getSession();
    return fetch(CFG.API_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, args: args || [], token: tokenOverride || (s && s.token) || '', clientId: clientId || '' }) })
      .then(function (r) { return r.json(); });
  }
  function apiError(j) { var e = new Error(j.error || 'Request failed'); e.code = j.code; return e; }

  function call(action, args) {
    args = args || [];
    var online = ONLINE_ONLY.test(action);
    var mut = !online && MUTATION.test(action) && !NEVER_QUEUE.test(action), cid = (mut || (online && /(Preview|Confirm|Discard|Set|Check|Submit|Decide|Add|Entry|Save|Finalize|Reopen)$/.test(action))) ? uuid() : '';
    return post(action, args, cid).then(function (j) {
      if (j.ok) {
        if (!mut && !online && !/^(login|guest|me|notif|getUser)/.test(action)) cacheSet(action, args, j.data);
        return j.data;
      }
      if (j.code === 'AUTH') {
        var s = getSession();
        if (s && s.user && s.user.role === 'Guest') {            // silently renew guest token
          return post('guest', []).then(function (g) { if (g.ok) { setSession({ token: g.data.token, user: g.data.user }); return call(action, args); } throw apiError(j); });
        }
        clearSession(); if (!/login\.html/.test(location.pathname)) location.href = 'login.html?expired=1';
      }
      if (j.code === 'MUST_CHANGE') location.href = 'login.html?change=1';
      throw apiError(j);
    }, function (netErr) {
      // network failure -> queue writes, serve cached reads
      if (mut && cid) {
        return idb('queue', 'readwrite', function (st) { return st.put({ clientId: cid, action: action, args: args, ts: Date.now() }); })
          .then(function () { updateQueueBadge(); return { success: true, queued: true, message: 'You are offline. Saved on this device and will sync automatically.' }; });
      }
      if (online) throw new Error('You need to be online to use Import results.');
      return cacheGet(action, args).then(function (hit) { if (hit !== undefined) { window.__recon_stale = true; return hit; } throw new Error('You appear to be offline.'); });
    });
  }
  function ckey(a, args) { return (getSession() && getSession().user ? getSession().user.id : 'g') + '|' + a + '|' + JSON.stringify(args); }
  function cacheSet(a, args, data) { idb('cache', 'readwrite', function (st) { return st.put({ key: ckey(a, args), data: data, ts: Date.now() }); }).catch(function () {}); }
  function cacheGet(a, args) {
    return db().then(function (d) { return new Promise(function (res) { var r = d.transaction('cache').objectStore('cache').get(ckey(a, args)); r.onsuccess = function () { res(r.result ? r.result.data : undefined); }; r.onerror = function () { res(undefined); }; }); }).catch(function () { return undefined; });
  }

  // ---------- offline queue flush ----------
  var flushing = false;
  function flushQueue() {
    if (flushing || !navigator.onLine) return Promise.resolve(0);
    flushing = true;
    return db().then(function (d) { return new Promise(function (res) { var r = d.transaction('queue').objectStore('queue').getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { res([]); }; }); })
      .then(function (items) {
        items.sort(function (a, b) { return a.ts - b.ts; });
        var done = 0, p = Promise.resolve();
        items.forEach(function (it) {
          p = p.then(function () {
            return post(it.action, it.args, it.clientId).then(function (j) {
              if (j.ok || (j.code && j.code !== 'AUTH' && j.code !== 'BUSY' && j.code !== 'SERVER')) { done++; return idb('queue', 'readwrite', function (st) { return st.delete(it.clientId); }); }
            }).catch(function () {});
          });
        });
        return p.then(function () { return done; });
      }).then(function (n) { flushing = false; updateQueueBadge(); if (n && window.showToast) window.showToast(n + ' offline change(s) synced', 'success'); if (n && window.refreshCurrentPage) window.refreshCurrentPage(true); return n; })
      .catch(function () { flushing = false; return 0; });
  }
  function queueCount() { return db().then(function (d) { return new Promise(function (res) { var r = d.transaction('queue').objectStore('queue').count(); r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(0); }; }); }).catch(function () { return 0; }); }
  function updateQueueBadge() { queueCount().then(function (n) { var el = document.getElementById('offlineBanner'); if (el) { el.dataset.pending = n; if (window.reconUiOffline) window.reconUiOffline(); } }); }
  window.addEventListener('online', function () { flushQueue(); });
  setTimeout(flushQueue, 3000);

  // ---------- google.script.run shim ----------
  function runner(ok, fail) {
    return new Proxy({}, { get: function (_, name) {
      if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
      if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
      if (name === 'withUserObject') return function () { return runner(ok, fail); };
      if (typeof name !== 'string') return undefined;
      return function () {
        var args = Array.prototype.slice.call(arguments), action = ALIAS[name] || name;
        call(action, args).then(function (d) { if (ok) ok(d); }, function (e) { if (fail) fail(e); else console.error(name, e); });
      };
    } });
  }
  window.google = { script: { run: runner(null, null) } };

  window.reconApi = { call: call, post: post, getSession: getSession, setSession: setSession, clearSession: clearSession, flushQueue: flushQueue, queueCount: queueCount };
})();
