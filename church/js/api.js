/* api.js - talks to the Apps Script backend, remembers the last good data, and queues RSVPs when offline.
   Everything stored on the device is prefixed "church_" (this web address is shared with other apps). */
(function () {
  'use strict';
  var CFG = window.CHURCH_CONFIG || {};
  var API_URL = String(CFG.API_URL || '');
  var configured = /^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/.test(API_URL) || /^https:\/\/script\.google\.com\/a\/macros\/[^\/]+\/s\/[^\/]+\/exec$/.test(API_URL);
  var PFX = 'church_', DB_NAME = 'church_db';

  // ---------- small storage helper (falls back to memory if the browser blocks storage) ----------
  var mem = {};
  var store = {
    get: function (k) { try { return localStorage.getItem(PFX + k); } catch (e) { return mem[k] || null; } },
    set: function (k, v) { try { localStorage.setItem(PFX + k, v); } catch (e) { mem[k] = v; } },
    del: function (k) { try { localStorage.removeItem(PFX + k); } catch (e) { delete mem[k]; } }
  };

  // ---------- IndexedDB: church_db { cache, queue } ----------
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no idb'));
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('cache')) d.createObjectStore('cache', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'clientId' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function idb(storeName, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(storeName, mode), st = tx.objectStore(storeName), out = fn(st);
        tx.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  var Cache = {
    get: function (k) { return idb('cache', 'readonly', function (s) { return s.get(k); }).then(function (r) { return r ? r.value : null; }).catch(function () { return null; }); },
    set: function (k, v) { return idb('cache', 'readwrite', function (s) { s.put({ key: k, value: v, at: Date.now() }); }).catch(function () {}); },
    del: function (k) { return idb('cache', 'readwrite', function (s) { s.delete(k); }).catch(function () {}); }
  };
  var Queue = {
    add: function (item) { return idb('queue', 'readwrite', function (s) { s.put(item); }); },
    all: function () { return idb('queue', 'readonly', function (s) { return s.getAll(); }).then(function (r) { return r || []; }).catch(function () { return []; }); },
    del: function (id) { return idb('queue', 'readwrite', function (s) { s.delete(id); }).catch(function () {}); }
  };

  // ---------- session ----------
  function session() { var t = store.get('token'), u = null; try { u = JSON.parse(store.get('user') || 'null'); } catch (e) { /* ignore */ } return t && u ? { token: t, user: u } : null; }
  function setSession(token, user) { store.set('token', token); store.set('user', JSON.stringify(user)); }
  function clearSession() { store.del('token'); store.del('user'); Cache.del('pd_m'); }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function emit(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { /* ignore */ } }

  // ---------- network ----------
  function post(action, args, clientId) {
    if (!configured) return Promise.reject(Object.assign(new Error('The app is not connected to the church system yet.'), { code: 'noconfig' }));
    var s = session(), ctl = window.AbortController ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 30000) : null;
    var body = JSON.stringify({ action: action, args: args || [], token: s ? s.token : undefined, clientId: clientId || undefined });
    return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, redirect: 'follow', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (timer) clearTimeout(timer); return r.json(); })
      .catch(function (e) { if (timer) clearTimeout(timer); var er = new Error('You are offline or the church system cannot be reached.'); er.network = true; throw er; })
      .then(function (j) {
        if (j && j.ok) { setOnline(true); return j.data; }
        var er = new Error((j && j.error && j.error.message) || 'Something went wrong. Please try again.');
        er.code = j && j.error && j.error.code;
        if (er.code === 'auth' && s) { clearSession(); emit('church:signedout', { expired: true }); }
        throw er;
      });
  }

  // ---------- online / offline indicator ----------
  var online = navigator.onLine !== false;
  function setOnline(v) { if (v !== online) { online = v; emit('church:online', { online: v }); } if (v) flushQueue(); }
  window.addEventListener('online', function () { setOnline(true); });
  window.addEventListener('offline', function () { setOnline(false); });

  // ---------- offline queue (duplicate-safe: every item carries its own clientId) ----------
  var IDEMPOTENT = { rsvpEvent: 1, submitPrayerRequest: 1, submitContactMessage: 1, registerMember: 1 };
  var flushing = false;
  function pendingCount() { return Queue.all().then(function (a) { return a.length; }); }
  function announceQueue() { pendingCount().then(function (n) { emit('church:queue', { pending: n }); }); }
  function flushQueue() {
    if (flushing || !configured) return Promise.resolve();
    flushing = true;
    return Queue.all().then(function (items) {
      items.sort(function (a, b) { return a.at - b.at; });
      return items.reduce(function (p, it) {
        return p.then(function (stop) {
          if (stop) return true;
          if (Date.now() - it.at > 14 * 864e5) return Queue.del(it.clientId).then(function () { return false; });
          return post(it.action, it.args, it.clientId).then(function (r) {
            return Queue.del(it.clientId).then(function () { emit('church:queue-result', { item: it, result: r }); return false; });
          }).catch(function (e) {
            if (e.network) return true;                        // still offline: stop, keep everything
            return Queue.del(it.clientId).then(function () { emit('church:queue-result', { item: it, error: e.message }); return false; });
          });
        });
      }, Promise.resolve(false));
    }).catch(function () {}).then(function () { flushing = false; announceQueue(); });
  }

  // ---------- public calls ----------
  function call(action, args) {
    var cid = IDEMPOTENT[action] ? uuid() : undefined;
    return post(action, args, cid).catch(function (e) {
      if (e.network && IDEMPOTENT[action]) {
        setOnline(false);
        return Queue.add({ clientId: cid, action: action, args: args || [], at: Date.now() }).then(function () {
          announceQueue();
          return { success: true, queued: true, message: 'Saved on this phone. It will be sent automatically when you are back online.' };
        });
      }
      if (e.network) setOnline(false);
      throw e;
    });
  }

  // getPublicData: show the last good copy at once, then refresh from the network
  function publicData(onData, onFail) {
    var s = session(), key = s ? 'pd_m' : 'pd_p', gotCache = false;
    Cache.get(key).then(function (c) {
      if (c && c.data) { gotCache = true; onData(c.data, { cached: true, at: c.at }); }
    }).then(function () {
      return post('getPublicData', []).then(function (d) { Cache.set(key, { data: d, at: Date.now() }); onData(d, { cached: false }); })
        .catch(function (e) { if (e.network) { setOnline(false); if (!gotCache) onFail(e); } else onFail(e); });
    });
  }
  // ---------- google.script.run compatibility layer (so the existing page code keeps working) ----------
  var NO_TOKEN_ARG = { getPublicData: 1, authenticateUser: 1, requestPasswordReset: 1, resetPassword: 1, registerMember: 1, rsvpEvent: 1, submitPrayerRequest: 1, submitContactMessage: 1, searchSermons: 1, requestMemberCode: 1, verifyMemberCode: 1, registerDevice: 1, unregisterDevice: 1, ping: 1 };
  function runner(ok, bad) {
    var base = { withSuccessHandler: function (f) { return runner(f, bad); }, withFailureHandler: function (f) { return runner(ok, f); }, withUserObject: function () { return runner(ok, bad); } };
    return new Proxy(base, { get: function (t, name) {
      if (name in t) return t[name];
      return function () {
        var args = Array.prototype.slice.call(arguments);
        if (!NO_TOKEN_ARG[name]) args = args.slice(1);                        // old code passed the token first; the token now travels in the envelope
        if (name === 'getPublicData') { publicData(function (d) { if (ok) ok(d); }, function (e) { if (bad) bad(e); }); return; }
        call(name, args).then(function (r) { if (ok) ok(r); }, function (e) { if (bad) bad(e); });
      };
    } });
  }
  if (configured) window.google = { script: { run: runner(null, null) } };

  window.ChurchApi = { configured: configured, call: call, post: post, store: store, session: session, setSession: setSession, clearSession: clearSession, cache: Cache, queue: Queue, flushQueue: flushQueue, pendingCount: pendingCount, publicData: publicData, isOnline: function () { return online; }, uuid: uuid, announceQueue: announceQueue };
  window.addEventListener('load', function () { setTimeout(function () { announceQueue(); if (navigator.onLine !== false) flushQueue(); }, 1500); });
})();
