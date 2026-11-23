/* RECON modern UI layer: dark mode, offline banner, install prompt, bottom nav, reports page, role-aware extras. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function role() { var s = reconApi.getSession(); return s && s.user ? s.user.role : 'Guest'; }
  function isStaff() { return ['Unit Officer', 'Battalion Commander', 'Instructor', 'Admin', 'Super Admin'].indexOf(role()) >= 0; }

  // ----- theme -----
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('reconTheme', t); } catch (e) {} var b = $('themeBtn'); if (b) b.innerHTML = '<i class="fas fa-' + (t === 'dark' ? 'sun' : 'moon') + '"></i>'; var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#0b1a0a' : '#154b12'; }
  var saved = null; try { saved = localStorage.getItem('reconTheme'); } catch (e) {}
  applyTheme(saved || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  // ----- offline banner -----
  function offlineState() {
    var el = $('offlineBanner'); if (!el) return;
    var pend = parseInt(el.dataset.pending || '0', 10), off = !navigator.onLine;
    el.style.display = (off || pend) ? 'flex' : 'none';
    el.innerHTML = off ? '<i class="fas fa-wifi-slash"></i> Offline — showing saved data' + (pend ? ' · ' + pend + ' change(s) waiting to sync' : '')
                       : '<i class="fas fa-sync"></i> ' + pend + ' change(s) waiting to sync <button class="btn btn-sm btn-outline" onclick="reconApi.flushQueue()">Sync now</button>';
  }
  window.reconUiOffline = offlineState;

  // ----- install prompt (Android/desktop Chromium) -----
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; var b = $('installBtn'); if (b) b.style.display = ''; });
  function installApp() {
    if (deferred) { deferred.prompt(); deferred = null; $('installBtn').style.display = 'none'; return; }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(ios ? 'To install on iPhone/iPad: tap the Share button in Safari, then "Add to Home Screen".' : 'Use your browser menu > "Install RECON" (or "Add to Home screen").');
  }

  // ----- reports -----
  var REPORTS = [['cadetsByUnit', 'Cadets by unit'], ['starExamPass', 'Star Exam pass rates'], ['shieldStandings', 'Shield standings'], ['courseRegistrations', 'Course registrations']];
  var lastReport = null;
  function injectReports() {
    if ($('page-reports')) return;
    var content = document.querySelector('.content'); if (!content) return;
    var pg = document.createElement('div'); pg.id = 'page-reports'; pg.className = 'page';
    pg.innerHTML = '<div class="card"><div class="card-header"><h3><i class="fas fa-chart-bar"></i> Reports</h3></div><div class="card-body">' +
      '<div class="report-bar"><select id="repType" class="form-control">' + REPORTS.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('') + '</select>' +
      '<select id="repBn" class="form-control"><option value="">All battalions</option><option>1TTCF</option><option>2TTCF</option><option>3TTCF</option><option>4TTCF</option><option>5TTCF</option><option>6TTCF</option><option>MTTCF</option><option>SSB</option><option>FHQ</option></select>' +
      '<button class="btn btn-primary" id="repRun"><i class="fas fa-play"></i> Run</button><button class="btn btn-outline" id="repCsv"><i class="fas fa-file-csv"></i> CSV</button><button class="btn btn-outline" id="repPrint"><i class="fas fa-print"></i> Print / PDF</button></div>' +
      '<div id="repOut" class="report-out"></div></div></div>';
    content.appendChild(pg);
    $('repRun').onclick = runReport; $('repPrint').onclick = function () { window.print(); };
    $('repCsv').onclick = function () {
      if (!lastReport) return;
      function q(v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
      var csv = [lastReport.columns.map(q).join(',')].concat(lastReport.rows.map(function (r) { return r.map(q).join(','); })).join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = (lastReport.title || 'report').replace(/\W+/g, '_') + '.csv'; a.click();
    };
    var nav = document.querySelector('.nav-menu'), li = document.createElement('li');
    li.className = 'nav-item staff-only'; li.setAttribute('data-page', 'reports'); li.style.display = 'none'; li.innerHTML = '<i class="fas fa-chart-bar"></i><span>Reports</span>';
    li.onclick = function () { window.navigateTo('reports'); };
    var users = document.querySelector('[data-page="users"]'); nav.insertBefore(li, users);
  }
  function runReport() {
    var out = $('repOut'); out.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    reconApi.call('reportsData', [$('repType').value, { battalion: $('repBn').value }]).then(function (d) {
      lastReport = d;
      out.innerHTML = '<h4>' + esc(d.title) + '</h4><p class="muted">Generated ' + new Date(d.generated).toLocaleString() + '</p><div class="table-wrap"><table class="data-table"><thead><tr>' +
        d.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        (d.rows.length ? d.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + d.columns.length + '">No data</td></tr>') + '</tbody></table></div>';
    }).catch(function (e) { out.innerHTML = '<div class="alert alert-danger show">' + esc(e.message) + '</div>'; });
  }
  window.loadReports = function () { if (window.hideLoading) window.hideLoading(); };

  // ----- bottom nav (mobile) -----
  function injectBottomNav() {
    if ($('bottomNav')) return;
    var n = document.createElement('nav'); n.id = 'bottomNav'; n.className = 'bottom-nav';
    n.innerHTML = [['dashboard', 'home', 'Home'], ['shield', 'trophy', 'Shield'], ['courses', 'graduation-cap', 'Courses'], ['announcements', 'bullhorn', 'News']].map(function (i) {
      return '<button data-go="' + i[0] + '"><i class="fas fa-' + i[1] + '"></i><span>' + i[2] + '</span></button>'; }).join('') + '<button data-go="__menu"><i class="fas fa-bars"></i><span>More</span></button>';
    document.body.appendChild(n);
    n.onclick = function (e) { var b = e.target.closest('button'); if (!b) return; var g = b.dataset.go; if (g === '__menu') window.toggleSidebar(); else window.navigateTo(g); };
  }

  function injectChrome() {
    var ha = document.querySelector('.header-actions'); if (!ha || $('themeBtn')) return;
    var t = document.createElement('button'); t.id = 'themeBtn'; t.className = 'btn btn-outline btn-sm'; t.title = 'Light / dark';
    t.onclick = function () { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }; ha.appendChild(t);
    applyTheme(document.documentElement.getAttribute('data-theme'));
    var off = document.createElement('div'); off.id = 'offlineBanner'; off.className = 'offline-banner'; off.style.display = 'none'; document.body.appendChild(off);
    window.addEventListener('online', offlineState); window.addEventListener('offline', offlineState); offlineState(); reconApi.queueCount().then(function (n) { off.dataset.pending = n; offlineState(); });
    var f = document.querySelector('.sidebar-footer');
    if (f) {
      f.insertAdjacentHTML('afterbegin', '<button id="settingsBtn" class="btn btn-outline btn-block" style="display:none"><i class="fas fa-cog"></i> Settings &amp; alerts</button><button id="installBtn" class="btn btn-outline btn-block" style="display:none"><i class="fas fa-download"></i> Install app</button>');
      $('settingsBtn').onclick = function () { reconNotify.openSettings(); }; $('installBtn').onclick = installApp;
      if (!window.matchMedia('(display-mode: standalone)').matches) $('installBtn').style.display = '';
    }
    injectReports(); injectBottomNav();
  }

  // called from patched updateUIForRole()
  window.reconUiRole = function () {
    injectChrome();
    var s = isStaff();
    Array.prototype.forEach.call(document.querySelectorAll('.staff-only'), function (el) { el.style.display = s ? '' : 'none'; });
    var lg = role() !== 'Guest' && !!reconApi.getSession(); var sb = $('settingsBtn'); if (sb) sb.style.display = lg ? '' : 'none';
    reconNotify.start();
    if (!window.__hashDone) { window.__hashDone = true; var h = (location.hash || '').replace('#', ''); if (h && document.querySelector('[data-page="' + h + '"]')) setTimeout(function () { window.navigateTo(h); }, 400); }
  };
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'nav' && window.navigateTo) window.navigateTo(e.data.page); });
  document.addEventListener('DOMContentLoaded', injectChrome);
})();
