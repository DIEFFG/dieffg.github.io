/* RECON Competitions: Judges score; Admins assign judges, watch standings, finalise. Phase 1: Platoon Records Review. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function role() { var s = window.reconApi && reconApi.getSession(); return s && s.user ? s.user.role : 'Guest'; }
  function isAdmin() { return role() === 'Admin' || role() === 'Super Admin'; }
  function allowed() { return isAdmin() || role() === 'Judge'; }
  window.reconCompAllowed = allowed;
  function api(a, args) { return reconApi.call(a, args || []); }
  function toast(m, t) { if (window.showToast) window.showToast(m, t || 'info'); }
  function err(e) { toast(e && e.message ? e.message : 'Something went wrong', 'error'); if (window.hideLoading) window.hideLoading(); }
  var injected = false, ov = null, rec = null;

  function modal(title, body, footer) {
    var old = $('cpModal'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'cpModal'; o.className = 'modal-overlay active';
    o.innerHTML = '<div class="modal modal-lg" role="dialog" aria-modal="true"><div class="modal-header"><h3>' + esc(title) + '</h3><button class="modal-close" aria-label="Close" id="cpX">&times;</button></div><div class="modal-body" id="cpBody">' + body + '</div><div class="modal-footer" id="cpFoot">' + (footer || '') + '</div></div>';
    document.body.appendChild(o); $('cpX').onclick = closeModal; return o;
  }
  function closeModal() { var o = $('cpModal'); if (o) o.remove(); }

  function inject() {
    if (injected || $('page-competitions')) return; var content = document.querySelector('.content'); if (!content) return; injected = true;
    var pg = document.createElement('div'); pg.id = 'page-competitions'; pg.className = 'page';
    pg.innerHTML = '<div class="section-header"><h2><i class="fas fa-clipboard-list"></i> Competitions</h2></div><div id="cpMain"></div>';
    content.appendChild(pg);
    var nav = document.querySelector('.nav-menu'), li = document.createElement('li'), after = document.querySelector('[data-page="shield"]');
    li.className = 'nav-item cp-nav'; li.setAttribute('data-page', 'competitions'); li.style.display = allowed() ? '' : 'none';
    li.innerHTML = '<i class="fas fa-clipboard-list"></i><span>Competitions</span>'; li.onclick = function () { window.navigateTo('competitions'); };
    if (nav) nav.insertBefore(li, after ? after.nextSibling : null);
  }
  var origRole = window.reconUiRole;
  window.reconUiRole = function () {
    if (origRole) origRole(); inject();
    var li = document.querySelector('.cp-nav'); if (li) li.style.display = allowed() ? '' : 'none';
    if (role() === 'Judge') Array.prototype.forEach.call(document.querySelectorAll('.nav-item[data-page]'), function (n) {   // judges see only what they use
      var p = n.getAttribute('data-page'); if (['dashboard', 'shield', 'competitions', 'calendar'].indexOf(p) < 0) n.style.display = 'none';
    });
  };

  function load() {
    inject(); if (window.hideLoading) window.hideLoading();
    if (!allowed()) { $('cpMain').innerHTML = '<p>Competitions is for Judges and Admins.</p>'; return; }
    $('cpMain').innerHTML = '<p class="muted">Loading...</p>';
    api('compOverview').then(function (d) { ov = d; render(); }).catch(err);
  }
  window.loadCompetitions = load;

  function badge(st) { return '<span class="rl-badge ' + (st === 'FINAL' ? 'rl-ok' : 'rl-warn') + '">' + (st === 'FINAL' ? 'Finalised' : 'Open') + '</span>'; }
  function render() {
    var h = '<p class="muted">School year ' + ov.year + '-' + (ov.year + 1) + '.</p>';
    if (!ov.competitions.length) h += '<div class="card"><div class="card-body"><p>' + (ov.isAdmin ? 'No competitions are set up.' : 'You have not been assigned to judge a competition yet. Ask an Admin to assign you.') + '</p></div></div>';
    ov.competitions.forEach(function (c) {
      h += '<div class="card cp-card"><div class="card-body"><div class="cp-top"><h3>' + esc(c.label) + '</h3>' + badge(c.status) + '</div>' +
        '<div class="shi-actions">' + (ov.canScore.indexOf(c.code) >= 0 ? '<button class="btn btn-primary" data-score="' + c.code + '"><i class="fas fa-pen"></i> Score platoons</button> ' : '') +
        (ov.isAdmin ? '<button class="btn btn-secondary" data-stand="' + c.code + '"><i class="fas fa-list-ol"></i> Standings and finalise</button>' : '') + '</div></div></div>';
    });
    if (ov.isAdmin) h += '<div class="card"><div class="card-header"><h3>Judges</h3></div><div class="card-body" id="cpJudges"></div></div>';
    $('cpMain').innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll('[data-score]'), function (b) { b.onclick = openScoring; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-stand]'), function (b) { b.onclick = openStandings; });
    if (ov.isAdmin) renderJudges();
  }

  // ---------- judges (Admin) ----------
  function renderJudges() {
    var el = $('cpJudges');
    var h = '<p class="muted">Create judge accounts in User Management (set the role to Judge), then tick what each judge scores. Judges see only the scoring screens, never cadet or roll details.</p>';
    h += ov.judges.length ? '<div class="rl-scroll"><table class="data-table"><thead><tr><th>Judge</th><th>Email</th>' + ov.live.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      ov.judges.map(function (j) { return '<tr><td>' + esc(j.name) + '</td><td>' + esc(j.email) + '</td>' + ov.live.map(function (c) { return '<td><input type="checkbox" class="cp-asg" data-e="' + esc(j.email) + '" data-c="' + c.code + '"' + (j.active && j.comps.indexOf(c.code) >= 0 ? ' checked' : '') + '></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'
      : '<p>No Judge accounts yet.</p>';
    h += '<label>Judges needed per platoon (Records Review) <input id="cpMin" type="number" min="0" max="20" class="form-control" style="width:90px;display:inline-block" value="' + esc(ov.settings.recordsMinJudges) + '"></label> <button class="btn btn-outline btn-sm" id="cpMinSave">Save</button>';
    el.innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll('.cp-asg'), function (cb) {
      cb.onchange = function () {
        var e = cb.getAttribute('data-e'), comps = Array.prototype.filter.call(document.querySelectorAll('.cp-asg[data-e="' + e + '"]'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-c'); });
        api('compJudgesSet', [{ email: e, competitions: comps }]).then(function (r) { if (!r.success) { toast(r.error, 'error'); cb.checked = !cb.checked; return; } toast('Saved', 'success'); }).catch(err);
      };
    });
    $('cpMinSave').onclick = function () { api('compSettingsSet', [{ recordsMinJudges: $('cpMin').value }]).then(function (r) { toast(r.success ? 'Saved' : r.error, r.success ? 'success' : 'error'); }).catch(err); };
  }

  // ---------- scoring (Judge) ----------
  function recTotal(p, code) { var s = (rec.mine[p] || {})[code]; if (!s) return null; var t = 0, n = 0; rec.criteria.forEach(function (c) { if (s[c.key] !== '' && s[c.key] !== undefined) { t += Number(s[c.key]); n++; } }); return n === rec.criteria.length ? t : (n ? -1 : null); }
  function openScoring() {
    if (window.showLoading) window.showLoading();
    api('compRecordsGet').then(function (d) {
      if (window.hideLoading) window.hideLoading();
      if (!d.success) { toast(d.error, 'error'); return; } rec = d; drawList();
    }).catch(err);
  }
  function drawList() {
    var rows = rec.platoons.map(function (p) {
      var done = rec.records.filter(function (r) { return recTotal(p.id, r.code) >= 0 && recTotal(p.id, r.code) !== null; }).length;
      return '<tr><td><b>' + esc(p.name) + '</b><div class="rl-sub">' + esc(p.battalion) + '</div></td><td><span class="rl-badge ' + (done === rec.records.length ? 'rl-ok' : done ? 'rl-warn' : 'rl-muted') + '">' + done + ' of ' + rec.records.length + ' records</span></td><td><button class="btn btn-' + (rec.canScore ? 'primary' : 'outline') + ' btn-sm" data-p="' + esc(p.id) + '">' + (rec.canScore ? 'Score' : 'View') + '</button></td></tr>';
    }).join('');
    modal('Platoon Records Review: your scoring', (rec.canScore ? '' : '<div class="rl-note rl-on"><i class="fas fa-lock"></i> This competition is finalised. Scores are locked.</div>') +
      (rec.platoons.length ? '<div class="rl-scroll"><table class="data-table"><thead><tr><th>Platoon</th><th>Your progress</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p>No platoons are open for scoring yet.</p>'),
      '<button class="btn btn-outline" id="cpClose">Close</button>');
    $('cpClose').onclick = closeModal;
    Array.prototype.forEach.call(document.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { drawForm(b.getAttribute('data-p')); }; });
  }
  function drawForm(pid) {
    var p = rec.platoons.filter(function (x) { return x.id === pid; })[0], cur = rec.mine[pid] || {};
    var h = '<p class="muted">Enter each mark from 0 up to the maximum shown. Leave a box empty if not yet marked. Maximum ' + rec.max + ' in total.</p>';
    rec.records.forEach(function (r) {
      var s = cur[r.code] || {};
      h += '<div class="cp-rec"><h4>' + esc(r.ser) + '. ' + esc(r.name) + ' <span class="cp-sub" id="cpT-' + r.code + '"></span></h4><div class="cp-grid">' +
        rec.criteria.map(function (c) { return '<label>' + esc(c.label) + ' <span class="muted">/' + c.max + '</span><input class="form-control cp-in" type="number" step="any" min="0" max="' + c.max + '" data-r="' + r.code + '" data-k="' + c.key + '" value="' + esc(s[c.key] === undefined ? '' : s[c.key]) + '"' + (rec.canScore ? '' : ' disabled') + '></label>'; }).join('') +
        '</div><input class="form-control cp-cm" placeholder="Comment (optional)" data-r="' + r.code + '" value="' + esc(s.comment || '') + '"' + (rec.canScore ? '' : ' disabled') + '></div>';
    });
    h += '<div class="cp-grand">Your total: <b id="cpG">0</b> / ' + rec.max + '</div>';
    modal(p.name, h, '<button class="btn btn-outline" id="cpBack">Back</button>' + (rec.canScore ? '<button class="btn btn-primary" id="cpSave"><i class="fas fa-save"></i> Save scores</button>' : ''));
    function recalc() {
      var g = 0; rec.records.forEach(function (r) { var t = 0; Array.prototype.forEach.call(document.querySelectorAll('.cp-in[data-r="' + r.code + '"]'), function (i) { t += Number(i.value) || 0; }); g += t; $('cpT-' + r.code).textContent = 'total ' + t + ' / ' + (rec.max / rec.records.length); }); $('cpG').textContent = g;
    }
    Array.prototype.forEach.call(document.querySelectorAll('.cp-in'), function (i) { i.oninput = recalc; }); recalc();
    $('cpBack').onclick = drawList;
    if (rec.canScore) $('cpSave').onclick = function () {
      var scores = {}, bad = '';
      rec.records.forEach(function (r) { var o = {}; rec.criteria.forEach(function (c) { var el = document.querySelector('.cp-in[data-r="' + r.code + '"][data-k="' + c.key + '"]'); if (el.value !== '' && (Number(el.value) < 0 || Number(el.value) > c.max)) bad = r.name + ' - ' + c.label + ' must be 0 to ' + c.max + '.'; o[c.key] = el.value; }); o.comment = document.querySelector('.cp-cm[data-r="' + r.code + '"]').value; scores[r.code] = o; });
      if (bad) { toast(bad, 'error'); return; }
      this.disabled = true; var btn = this;
      api('compRecordsSave', [{ platoonId: pid, scores: scores }]).then(function (r) {
        btn.disabled = false; if (!r.success) { toast(r.error, 'error'); return; }
        rec.mine[pid] = r.mine; toast('Scores saved', 'success'); drawList();
      }).catch(function (e) { btn.disabled = false; err(e); });
    };
  }

  // ---------- standings and finalise (Admin) ----------
  function openStandings() {
    if (window.showLoading) window.showLoading();
    api('compRecordsStandings').then(function (d) {
      if (window.hideLoading) window.hideLoading(); if (!d.success) { toast(d.error, 'error'); return; }
      var final = d.status === 'FINAL', codes = ['RB', 'TP', 'C15', 'C19'];
      var rows = d.rows.slice().sort(function (a, b) { return (a.rank || 999) - (b.rank || 999); }).map(function (r) {
        return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + r.judgesDone + ' of ' + r.judgesStarted + (r.ready ? '' : ' <span class="rl-badge rl-warn">needs ' + Math.max(1, d.min) + '</span>') + '</td>' + codes.map(function (c) { return '<td>' + (r.recs[c] === null ? '-' : esc(r.recs[c])) + '</td>'; }).join('') + '<td><b>' + (r.total === null ? '-' : esc(r.total)) + '</b></td><td>' + (r.rank || '-') + '</td></tr>'; }).join('');
      var body = '<p class="muted">Each platoon\'s score is the average of its judges\' totals (a judge counts when all four records are fully marked). Maximum ' + d.max + '. Finalising locks scoring; then open <b>Import results</b> to preview and confirm it into the Shield.</p>' +
        '<div class="rl-scroll"><table class="data-table"><thead><tr><th>Platoon</th><th>Judges done</th><th>Roll book</th><th>Training Prog.</th><th>C15</th><th>C19</th><th>Total /' + d.max + '</th><th>Rank</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8">No platoons open for scoring.</td></tr>') + '</tbody></table></div>';
      modal('Records Review standings ' + badge(d.status).replace(/<[^>]+>/g, ' '), body, '<button class="btn btn-outline" id="cpClose">Close</button>' + (final ? '<button class="btn btn-outline" id="cpRe"><i class="fas fa-unlock"></i> Reopen scoring</button>' : '<button class="btn btn-primary" id="cpFin"><i class="fas fa-lock"></i> Finalise</button>'));
      $('cpClose').onclick = function () { closeModal(); load(); };
      if (final) $('cpRe').onclick = function () { if (!window.confirm('Reopen scoring? Judges can change scores until you finalise again.')) return; api('compReopen', [{ competition: 'RECORDS' }]).then(function (r) { if (!r.success) { toast(r.error, 'error'); return; } toast('Reopened', 'success'); closeModal(); load(); }).catch(err); };
      else $('cpFin').onclick = function () {
        if (!window.confirm('Finalise Records Review? Scoring will be locked.')) return;
        api('compFinalize', [{ competition: 'RECORDS' }]).then(function (r) {
          if (!r.success) { toast(r.error + (r.missing ? ' ' + r.missing.slice(0, 5).join('; ') : ''), 'error'); return; }
          toast('Finalised. Now open Import results to send it to the Shield.', 'success'); closeModal(); load();
        }).catch(err);
      };
    }).catch(err);
  }
})();
