/* RECON Shield: Import results page (Admins). Competition apps export FINAL results; Admin previews, then confirms. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function role() { var s = window.reconApi && reconApi.getSession(); return s && s.user ? s.user.role : 'Guest'; }
  function isAdmin() { return role() === 'Admin' || role() === 'Super Admin'; }
  function api(a, args) { return reconApi.call(a, args || []); }
  function toast(m, t) { if (window.showToast) window.showToast(m, t || 'info'); }
  var year = null, sources = [], injected = false;
  var STATE = { 'not-imported': ['Not imported', 'muted'], 'preview': ['Preview ready', 'warn'], 'confirmed': ['Imported', 'ok'], 'source-updated': ['Source updated', 'warn'] };

  // ---------- centred modal ----------
  function modal(title, body, footer, wide) {
    closeModal();
    var o = document.createElement('div'); o.id = 'shImpModal'; o.className = 'modal-overlay active';
    o.innerHTML = '<div class="modal' + (wide ? ' modal-lg' : '') + '" role="dialog" aria-modal="true"><div class="modal-header"><h3>' + esc(title) + '</h3><button class="modal-close" aria-label="Close" id="shImpX">&times;</button></div>' +
      '<div class="modal-body">' + body + '</div><div class="modal-footer">' + (footer || '') + '</div></div>';
    document.body.appendChild(o); $('shImpX').onclick = closeModal;
    return o;
  }
  function closeModal() { var o = $('shImpModal'); if (o) o.remove(); }

  // ---------- page ----------
  function inject() {
    if (injected || $('page-shield-import')) return; var content = document.querySelector('.content'); if (!content) return; injected = true;
    var pg = document.createElement('div'); pg.id = 'page-shield-import'; pg.className = 'page';
    pg.innerHTML = '<div class="section-header"><h2><i class="fas fa-file-import"></i> Import Shield results</h2><div class="section-actions">' +
      '<select id="shiYear" class="form-control" aria-label="Competition year"></select>' +
      '<button class="btn btn-outline" id="shiRules"><i class="fas fa-sliders-h"></i> Scoring rules</button>' +
      '<button class="btn btn-outline" id="shiPlt"><i class="fas fa-list"></i> Platoons</button>' +
      '<button class="btn btn-secondary" id="shiCheck"><i class="fas fa-sync"></i> Check for new results</button></div></div>' +
      '<p class="muted">Each competition app publishes its results when finalized. Preview them here, then confirm. The Shield standings change only when you confirm.</p>' +
      '<div id="shiCards" class="shi-cards"></div>' +
      '<div class="card"><div class="card-header"><h3>Import history</h3></div><div class="card-body" id="shiHist"></div></div>' +
      '<div class="card"><div class="card-header"><h3>Shield standings by platoon</h3></div><div class="card-body" id="shiStand"></div></div>';
    content.appendChild(pg);
    var y = new Date().getFullYear(), sel = $('shiYear'); for (var i = y + 1; i >= y - 3; i--) sel.innerHTML += '<option value="' + i + '">' + i + '-' + (i + 1) + '</option>';
    $('shiRules').onclick = rulesModal; $('shiPlt').onclick = platoonModal;
    $('shiYear').onchange = function () { year = parseInt(this.value, 10); load(); };
    $('shiCheck').onclick = function () { api('shieldSourcesCheck').then(function (d) { toast(d.ready && d.ready.length ? 'New results are ready: ' + d.ready.join(', ') : 'No new results.', 'info'); load(); }).catch(err); };
    var nav = document.querySelector('.nav-menu'), li = document.createElement('li'), after = document.querySelector('[data-page="shield"]');
    li.className = 'nav-item shi-nav'; li.setAttribute('data-page', 'shield-import'); li.style.display = isAdmin() ? '' : 'none';
    li.innerHTML = '<i class="fas fa-file-import"></i><span>Import results</span>'; li.onclick = function () { window.navigateTo('shield-import'); };
    if (nav) nav.insertBefore(li, after ? after.nextSibling : null);
  }
  function err(e) { toast(e && e.message ? e.message : 'Something went wrong', 'error'); if (window.hideLoading) window.hideLoading(); }

  function load() {
    inject(); if (window.hideLoading) window.hideLoading();
    if (!isAdmin()) { var c = $('shiCards'); if (c) c.innerHTML = '<p>Only Admins can import results.</p>'; return; }
    api('shieldSourcesGet', year ? [year] : []).then(function (d) {
      year = d.year; sources = d.sources; $('shiYear').value = String(year); renderCards();
    }).catch(err);
    api('shieldImportsList', year ? [year] : []).then(function (d) { renderHistory(d.imports); }).catch(function () {});
    api('shieldStandings', year ? [year] : []).then(renderStandings).catch(function () {});
  }
  window.loadShieldImport = load;
  var origRole = window.reconUiRole; window.reconUiRole = function () { if (origRole) origRole(); inject(); var li = document.querySelector('.shi-nav'); if (li) li.style.display = isAdmin() ? '' : 'none'; };

  function renderCards() {
    $('shiCards').innerHTML = sources.map(function (s) {
      var st = STATE[s.state] || STATE['not-imported'], ready = s.url && s.hasKey;
      return '<div class="card shi-card"><div class="card-body"><div class="shi-top"><h4>' + esc(s.label) + '</h4><span class="shi-badge shi-' + st[1] + '">' + st[0] + '</span></div>' +
        '<div class="muted">Points method: ' + esc(s.method === 'TO BE CONFIRMED' ? 'not set yet' : s.method.replace(/_/g, ' ').toLowerCase()) + '</div>' +
        '<div class="muted">' + (s.confirmedRevision !== '' ? 'Imported revision ' + esc(s.confirmedRevision) : 'Nothing imported for this year') + '</div>' +
        '<div class="shi-actions"><button class="btn btn-primary btn-sm" data-pv="' + esc(s.competition) + '"' + (ready ? '' : ' disabled title="Set the web address and key first"') + '><i class="fas fa-eye"></i> Preview</button> ' +
        '<button class="btn btn-outline btn-sm" data-src="' + esc(s.competition) + '"><i class="fas fa-link"></i> Connection</button></div></div></div>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-pv]'), function (b) { b.onclick = function () { preview(b.getAttribute('data-pv')); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-src]'), function (b) { b.onclick = function () { sourceModal(b.getAttribute('data-src')); }; });
  }

  // ---------- preview and confirm ----------
  function preview(comp) {
    if (window.showLoading) window.showLoading();
    api('shieldImportPreview', [comp, year]).then(function (d) {
      if (window.hideLoading) window.hideLoading();
      if (!d.success) { toast(d.error, 'error'); return; }
      showPreview(d);
    }).catch(err);
  }
  function showPreview(d) {
    var c = d.counts, rows = d.rows.map(function (r) {
      return '<tr class="shi-row-' + esc(r.change || '') + '"><td>' + esc(r.name) + '<div class="muted">' + esc(r.battalion) + '</div></td><td>' + esc(r.status) + '</td><td>' + (r.rank === null ? '-' : esc(r.rank)) + '</td><td>' +
        (r.rawPoints === null ? '-' : esc(r.rawPoints)) + (r.rawMax ? ' / ' + esc(r.rawMax) : '') + '</td><td><b>' + (r.points === null || r.points === undefined ? '-' : esc(r.points)) + '</b>' +
        (r.before ? '<div class="muted">was ' + esc(r.before.points) + '</div>' : '') + '</td><td>' + esc(r.change || '') + '</td></tr>';
    }).join('');
    var body = '<p><b>' + esc(d.label) + ' ' + esc(d.year) + '</b> &middot; revision ' + esc(d.revision) + ' &middot; method: ' + esc(d.method.replace(/_/g, ' ').toLowerCase()) + '</p>' +
      '<p class="muted">' + c.added + ' new &middot; ' + c.changed + ' changed &middot; ' + c.unchanged + ' unchanged' + (c.removed ? ' &middot; ' + c.removed + ' no longer in the results' : '') + '</p>' +
      (d.errors.length ? '<div class="alert alert-danger show"><b>Fix these before confirming:</b><ul>' + d.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>' : '') +
      (d.warnings.length ? '<div class="alert alert-warning show"><ul>' + d.warnings.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>' : '') +
      (d.alreadyImported ? '<div class="alert alert-info show">These results are already imported. Nothing to do.</div>' : '') +
      '<div class="table-wrap shi-scroll"><table class="data-table"><thead><tr><th>Platoon</th><th>Status</th><th>Rank</th><th>Raw points</th><th>Shield points</th><th>Change</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    modal('Preview: ' + d.label, body, '<button class="btn btn-outline" id="shiDiscard">Discard</button> <button class="btn btn-primary" id="shiConfirm"' + (d.canConfirm ? '' : ' disabled') + '>Confirm and update standings</button>', true);
    $('shiDiscard').onclick = function () { api('shieldImportDiscard', [d.importId]).then(function () { closeModal(); load(); }).catch(err); };
    $('shiConfirm').onclick = function () {
      if (!window.confirm('Confirm these ' + d.label + ' results? The Shield standings will update.')) return;
      this.disabled = true;
      api('shieldImportConfirm', [d.importId]).then(function (r) {
        if (!r.success) { toast(r.error, 'error'); $('shiConfirm').disabled = false; return; }
        toast(r.unchanged ? r.message : 'Imported. Standings updated.', 'success'); closeModal(); load();
      }).catch(err);
    };
  }

  // ---------- connection (address + key) ----------
  function sourceModal(comp) {
    var s = sources.filter(function (x) { return x.competition === comp; })[0] || {};
    modal('Connection: ' + s.label, '<p class="muted">Paste the competition app\'s web app address and the shared key you set in that app. The key is stored securely on the server and is never shown again.</p>' +
      '<label>Web app address</label><input id="shiUrl" class="form-control" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(s.url) + '">' +
      '<label>Shared key ' + (s.hasKey ? '(a key is already saved; leave blank to keep it)' : '') + '</label><div class="shi-pw"><input id="shiKey" type="password" class="form-control" autocomplete="off"><button class="btn btn-outline btn-sm" type="button" id="shiKeyShow">Show</button></div>',
      '<button class="btn btn-outline" id="shiCancel">Cancel</button> <button class="btn btn-primary" id="shiSave">Save</button>');
    $('shiCancel').onclick = closeModal;
    $('shiKeyShow').onclick = function () { var k = $('shiKey'); k.type = k.type === 'password' ? 'text' : 'password'; this.textContent = k.type === 'password' ? 'Show' : 'Hide'; };
    $('shiSave').onclick = function () {
      var d = { competition: comp, url: $('shiUrl').value.trim() }, k = $('shiKey').value.trim(); if (k) d.key = k;
      api('shieldSourcesSet', [d]).then(function (r) { if (!r.success) { toast(r.error, 'error'); return; } toast('Saved', 'success'); closeModal(); load(); }).catch(err);
    };
  }

  // ---------- scoring rules ----------
  function rulesModal() {
    api('shieldPointsTableGet').then(function (d) {
      var rp = {}; d.rankPoints.forEach(function (x) { (rp[x.competition] = rp[x.competition] || []).push(x); });
      var body = '<p class="muted">Choose how each competition becomes Shield points. <b>Raw points</b> uses the competition\'s own points. <b>Percent weighted</b> is points divided by the maximum, times a weight. <b>Rank table</b> awards points by finishing position. Imports cannot be confirmed until a method is set.</p>' +
        d.rules.map(function (r) {
          return '<div class="shi-rule" data-c="' + esc(r.competition) + '"><h4>' + esc(r.label) + (r.confirmed ? '' : ' <span class="shi-badge shi-warn">not set</span>') + '</h4>' +
            '<select class="form-control shi-m"><option value="TO BE CONFIRMED"' + (r.confirmed ? '' : ' selected') + '>Not set yet</option>' + d.methods.map(function (m) { return '<option value="' + m + '"' + (r.method === m ? ' selected' : '') + '>' + m.replace(/_/g, ' ').toLowerCase() + '</option>'; }).join('') + '</select> ' +
            '<label>Weight <input class="form-control shi-w" type="number" step="any" min="0" value="' + esc(r.weight) + '"></label> ' +
            '<label>Points for DQ / did not start <input class="form-control shi-nf" type="number" step="any" min="0" value="' + esc(r.nonFinisherPoints) + '"></label>' +
            '<label>Rank table (rank:points, one per line)<textarea class="form-control shi-rp" rows="3" placeholder="1:10&#10;2:8">' + esc((rp[r.competition] || []).map(function (x) { return x.rank + ':' + x.points; }).join('\n')) + '</textarea></label></div>';
        }).join('') +
        '<h4>When totals are tied</h4><select id="shiTb" class="form-control"><option value="SHOW_TIED"' + (d.settings.tieBreak === 'SHOW_TIED' ? ' selected' : '') + '>Show them tied (no automatic tie-break)</option><option value="COMPETITION_ORDER"' + (d.settings.tieBreak === 'COMPETITION_ORDER' ? ' selected' : '') + '>Break ties by competition order</option></select>' +
        '<label>Order (codes, e.g. ORIENT,RECORDS,DRILL)<input id="shiTbo" class="form-control" value="' + esc(d.settings.tieBreakOrder) + '"></label>' +
        '<h4>Public speaking age limit</h4><p class="muted">Cadets may be this age or younger on the competition date. The date is the second Saturday of December (' + esc(d.pubspeak.date) + ' for ' + d.pubspeak.year + ')' + (d.pubspeak.isDefault ? '' : ', set by an Admin') + '. Change it only if the competition moves.</p>' +
        '<label>Oldest age allowed <input id="shiPsAge" class="form-control" type="number" min="8" max="30" value="' + esc(d.pubspeak.maxAge) + '"></label> ' +
        '<label>Competition date (leave empty for the second Saturday of December)<input id="shiPsDate" class="form-control" type="date" value="' + (d.pubspeak.isDefault ? '' : esc(d.pubspeak.date)) + '"></label>';
      modal('Scoring rules', body, '<button class="btn btn-outline" id="shiCancel">Cancel</button> <button class="btn btn-primary" id="shiSave">Save rules</button>', true);
      $('shiCancel').onclick = closeModal;
      $('shiSave').onclick = function () {
        var rules = [], ranks = [], bad = '';
        Array.prototype.forEach.call(document.querySelectorAll('.shi-rule'), function (el) {
          var c = el.getAttribute('data-c');
          rules.push({ competition: c, method: el.querySelector('.shi-m').value, weight: el.querySelector('.shi-w').value, nonFinisherPoints: el.querySelector('.shi-nf').value });
          el.querySelector('.shi-rp').value.split(/\n+/).forEach(function (ln) { ln = ln.trim(); if (!ln) return; var m = /^(\d+)\s*[:=,]\s*(\d+(\.\d+)?)$/.exec(ln); if (!m) bad = c + ': "' + ln + '" is not rank:points'; else ranks.push({ competition: c, rank: parseInt(m[1], 10), points: parseFloat(m[2]) }); });
        });
        if (bad) { toast(bad, 'error'); return; }
        api('shieldPointsTableSet', [{ rules: rules, rankPoints: ranks, settings: { tieBreak: $('shiTb').value, tieBreakOrder: $('shiTbo').value, pubspeakMaxAge: $('shiPsAge').value, pubspeakDate: $('shiPsDate').value } }]).then(function (r) {
          if (!r.success) { toast(r.error, 'error'); return; } toast('Rules saved', 'success'); closeModal(); load();
        }).catch(err);
      };
    }).catch(err);
  }

  // ---------- platoon master list ----------
  function platoonModal() {
    api('shieldPlatoonsGet').then(function (d) {
      var body = '<p class="muted">Every platoon has a fixed ID. Give this list to each competition app so its Platoon Map uses the same IDs.</p>' +
        '<div class="shi-actions"><button class="btn btn-secondary btn-sm" id="shiSeed"><i class="fas fa-magic"></i> Add platoons found in cadet, Shield and orienteering data</button> <button class="btn btn-outline btn-sm" id="shiCsv"><i class="fas fa-file-csv"></i> Download list (CSV)</button></div><div id="shiSeedOut"></div>' +
        '<div class="table-wrap shi-scroll"><table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Battalion</th><th>Unit</th><th>Plt</th><th>Active</th></tr></thead><tbody>' +
        (d.platoons.length ? d.platoons.map(function (p) { return '<tr><td><code>' + esc(p.id) + '</code></td><td>' + esc(p.name) + '</td><td>' + esc(p.battalion) + '</td><td>' + esc(p.unit) + '</td><td>' + esc(p.platoonNumber) + '</td><td>' + (p.active ? 'Yes' : 'No') + '</td></tr>'; }).join('') : '<tr><td colspan="6">No platoons yet. Use the button above to add them.</td></tr>') + '</tbody></table></div>';
      modal('Platoons (' + d.platoons.length + ')', body, '<button class="btn btn-primary" id="shiDone">Done</button>', true);
      $('shiDone').onclick = closeModal;
      $('shiCsv').onclick = function () {
        function q(v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
        var csv = ['platoonId,name,battalion,unit,platoonNumber,active'].concat(d.platoons.map(function (p) { return [p.id, p.name, p.battalion, p.unit, p.platoonNumber, p.active].map(q).join(','); })).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'recon_platoons.csv'; a.click();
      };
      $('shiSeed').onclick = function () {
        api('shieldPlatoonsSet', [{ op: 'seed' }]).then(function (r) {
          if (!r.success) { toast(r.error, 'error'); return; }
          $('shiSeedOut').innerHTML = '<div class="alert alert-info show">Added ' + r.added + ' platoon(s). Total ' + r.total + '.' + (r.unmatched.length ? '<br><b>Check these:</b><ul>' + r.unmatched.slice(0, 30).map(function (u) { return '<li>' + esc(u.unit) + ': ' + esc(u.problem) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
        }).catch(err);
      };
    }).catch(err);
  }

  // ---------- history + standings ----------
  function renderHistory(list) {
    $('shiHist').innerHTML = list.length ? '<div class="table-wrap shi-scroll"><table class="data-table"><thead><tr><th>When</th><th>Competition</th><th>Revision</th><th>Status</th><th>By</th><th>Rows</th></tr></thead><tbody>' +
      list.map(function (i) { return '<tr><td>' + esc(new Date(i.importedAt).toLocaleString()) + '</td><td>' + esc(i.competition) + '</td><td>' + esc(i.revision) + '</td><td>' + esc(i.status) + '</td><td>' + esc(i.importedBy) + '</td><td>' + esc(i.rowCount) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No imports yet for this year.</p>';
  }
  function renderStandings(d) {
    if (!d.rows.length) { $('shiStand').innerHTML = '<p class="muted">No Shield results yet for this year.</p>'; return; }
    $('shiStand').innerHTML = '<div class="table-wrap shi-scroll"><table class="data-table"><thead><tr><th>Rank</th><th>Unit</th><th>Plt</th><th>Bn</th>' + d.categories.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '<th>Total</th></tr></thead><tbody>' +
      d.rows.map(function (r) { return '<tr><td>' + (r.tied ? 'T' : '') + esc(r.rank) + '</td><td>' + esc(r.unit) + '</td><td>' + esc(r.platoonNumber) + '</td><td>' + esc(r.battalion) + '</td>' + d.categories.map(function (c) { return '<td>' + (r.scores[c] === undefined ? '-' : esc(r.scores[c])) + '</td>'; }).join('') + '<td><b>' + esc(r.total) + '</b></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h4 style="margin-top:16px">Battalion subtotals</h4><div class="table-wrap"><table class="data-table"><thead><tr><th>Battalion</th><th>Platoons</th><th>Total</th></tr></thead><tbody>' +
      d.battalions.map(function (b) { return '<tr><td>' + esc(b.battalion) + '</td><td>' + esc(b.platoons) + '</td><td>' + esc(b.total) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
})();
