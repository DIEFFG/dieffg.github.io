/* RECON notifications UI: bell, panel, settings, Firebase web push registration. */
(function () {
  'use strict';
  var CFG = window.RECON_CONFIG, poll = null, messaging = null;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function logged() { var s = reconApi.getSession(); return s && s.user && s.user.role !== 'Guest'; }
  function ago(iso) { var m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; if (m < 1440) return Math.round(m / 60) + 'h'; return Math.round(m / 1440) + 'd'; }

  function ensureBell() {
    if ($('notifBell') || !document.querySelector('.header-actions')) return;
    var b = document.createElement('button');
    b.id = 'notifBell'; b.className = 'btn btn-outline btn-sm notif-bell'; b.title = 'Notifications'; b.style.display = 'none';
    b.innerHTML = '<i class="fas fa-bell"></i><span id="notifBadge" class="notif-badge" style="display:none">0</span>';
    b.onclick = togglePanel;
    document.querySelector('.header-actions').insertBefore(b, document.querySelector('.header-actions').firstChild);
    var p = document.createElement('div'); p.id = 'notifPanel'; p.className = 'notif-panel'; p.style.display = 'none';
    p.innerHTML = '<div class="notif-head"><strong>Notifications</strong><span><a href="#" id="notifAll">Mark all read</a> · <a href="#" id="notifSet">Settings</a></span></div><div id="notifList" class="notif-list"></div>';
    document.body.appendChild(p);
    $('notifAll').onclick = function (e) { e.preventDefault(); reconApi.call('notifMarkAllRead', []).then(refresh); };
    $('notifSet').onclick = function (e) { e.preventDefault(); openSettings(); };
    document.addEventListener('click', function (e) { if (!p.contains(e.target) && !b.contains(e.target)) p.style.display = 'none'; });
  }
  function togglePanel() { var p = $('notifPanel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; if (p.style.display === 'block') refresh(); }

  function refresh() {
    if (!logged()) return Promise.resolve();
    return reconApi.call('notifList', [40]).then(function (r) {
      var bd = $('notifBadge'); bd.textContent = r.unread > 99 ? '99+' : r.unread; bd.style.display = r.unread ? 'inline-block' : 'none';
      var l = $('notifList');
      l.innerHTML = r.items.length ? r.items.map(function (n) {
        return '<div class="notif-item ' + (n.read ? '' : 'unread') + ' pri-' + esc(n.priority) + '" data-id="' + esc(n.id) + '" data-link="' + esc(n.link) + '"><div class="nt">' + esc(n.title) + '</div><div class="nb">' + esc(n.body) + '</div><div class="nm">' + ago(n.created) + '</div></div>';
      }).join('') : '<div class="notif-empty">You\'re all caught up.</div>';
      Array.prototype.forEach.call(l.querySelectorAll('.notif-item'), function (el) {
        el.onclick = function () {
          var id = el.dataset.id, link = (el.dataset.link || '').replace('#', '');
          if (el.classList.contains('unread')) reconApi.call('notifMarkRead', [id]).then(refresh);
          $('notifPanel').style.display = 'none';
          if (link && window.navigateTo) window.navigateTo(link);
        };
      });
    }).catch(function () {});
  }

  // ---------- push ----------
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function pushSupported() { return 'serviceWorker' in navigator && 'Notification' in window && CFG.FIREBASE && CFG.FIREBASE.projectId && CFG.VAPID_KEY; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function standalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; }

  function enablePush() {
    if (!pushSupported()) return Promise.reject(new Error('Push is not configured for this deployment.'));
    if (isIOS() && !standalone()) return Promise.reject(new Error('On iPhone, first tap Share > Add to Home Screen, then open RECON from the home screen to enable alerts.'));
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('Notification permission was not granted.');
      return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
    }).then(function () { return loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'); })
      .then(function () { return navigator.serviceWorker.ready; })
      .then(function (reg) {
        if (!firebase.apps.length) firebase.initializeApp(CFG.FIREBASE);
        messaging = firebase.messaging();
        messaging.onMessage(function (m) { var d = m.data || {}; if (window.showToast) window.showToast((d.title || 'RECON') + (d.body ? ': ' + d.body : ''), 'info'); refresh(); });
        return messaging.getToken({ vapidKey: CFG.VAPID_KEY, serviceWorkerRegistration: reg });
      }).then(function (token) {
        if (!token) throw new Error('Could not get a device token.');
        localStorage.setItem('reconPushToken', token);
        return reconApi.call('notifRegisterDevice', [token, /android/i.test(navigator.userAgent) ? 'android' : isIOS() ? 'ios' : 'web']);
      });
  }
  function silentPushResume() { if (pushSupported() && Notification.permission === 'granted' && logged()) enablePush().catch(function () {}); }

  // ---------- settings modal (alerts + password) ----------
  function openSettings() {
    $('notifPanel').style.display = 'none';
    var ov = $('settingsModal'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'settingsModal'; ov.className = 'modal-overlay active';
    ov.innerHTML = '<div class="modal" style="max-width:460px"><div class="modal-header"><h3>Settings</h3><button class="btn btn-outline btn-sm" id="setClose">&times;</button></div><div style="padding:18px">' +
      '<h4 style="margin-bottom:8px">Alerts</h4>' +
      '<label class="set-row"><input type="checkbox" id="prefPush"> Push notifications on this device</label>' +
      '<label class="set-row"><input type="checkbox" id="prefEmail"> Email for critical items</label>' +
      '<div id="pushHint" class="set-hint"></div><button class="btn btn-primary btn-sm" id="setSave">Save alert settings</button>' +
      '<hr style="margin:16px 0;border:0;border-top:1px solid var(--border)"><h4 style="margin-bottom:8px">Change password</h4>' +
      '<input type="password" id="pwOld" class="form-control" placeholder="Current password" style="margin-bottom:8px">' +
      '<input type="password" id="pwNew" class="form-control" placeholder="New password (8+ chars, letters & numbers)" style="margin-bottom:8px">' +
      '<button class="btn btn-outline btn-sm" id="pwSave">Change password</button><div id="setMsg" class="set-hint"></div></div></div>';
    document.body.appendChild(ov);
    $('setClose').onclick = function () { ov.remove(); };
    var hint = $('pushHint');
    if (isIOS() && !standalone()) hint.textContent = 'iPhone/iPad: install RECON to your Home Screen (Share > Add to Home Screen) to receive push alerts.';
    else if (!pushSupported()) hint.textContent = 'Push is not configured yet — in-app alerts still work.';
    reconApi.call('notifGetPrefs', []).then(function (p) { $('prefPush').checked = p.push && Notification.permission === 'granted'; $('prefEmail').checked = p.email; });
    $('setSave').onclick = function () {
      var want = $('prefPush').checked, p = Promise.resolve();
      if (want) p = enablePush(); else { var t = localStorage.getItem('reconPushToken'); if (t) p = reconApi.call('notifUnregisterDevice', [t]); }
      p.then(function () { return reconApi.call('notifSetPrefs', [{ push: want, email: $('prefEmail').checked }]); })
        .then(function () { $('setMsg').textContent = 'Saved.'; }).catch(function (e) { $('setMsg').textContent = e.message; $('prefPush').checked = false; });
    };
    $('pwSave').onclick = function () {
      reconApi.call('changePassword', [$('pwOld').value, $('pwNew').value]).then(function (r) {
        if (r.success) { var s = reconApi.getSession(); s.token = r.token; reconApi.setSession(s); $('setMsg').textContent = 'Password changed.'; $('pwOld').value = $('pwNew').value = ''; }
        else $('setMsg').textContent = r.message;
      }).catch(function (e) { $('setMsg').textContent = e.message; });
    };
  }

  function start() {
    ensureBell();
    if (!logged()) { if ($('notifBell')) $('notifBell').style.display = 'none'; return; }
    $('notifBell').style.display = '';
    refresh(); silentPushResume();
    clearInterval(poll); poll = setInterval(function () { if (!document.hidden) refresh(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
    navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'push') refresh(); });
  }
  window.reconNotify = { start: start, refresh: refresh, openSettings: openSettings, enablePush: enablePush };
})();
