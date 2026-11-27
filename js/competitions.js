/* RECON Competitions: Judges score; Admins assign judges, watch standings, finalise. Phase 1: Platoon Records Review. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function role() { var s = window.reconApi && reconApi.getSession(); return s && s.user ? s.user.role : 'Guest'; }
  function isAdmin() { return role() === 'Admin' || role() === 'Super Admin'; }
  function allowed() { var s = window.reconApi && reconApi.getSession(); return isAdmin() || role() === 'Judge' || !!(s && s.user && s.user.judge); }
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
        '<div class="shi-actions">' + (ov.canScore.indexOf(c.code) >= 0 || (ov.isAdmin && (c.code === 'MILKNOW' || c.code === 'ORIENT' || c.code === 'DRILL')) ? '<button class="btn btn-primary" data-score="' + c.code + '"><i class="fas fa-' + (c.code === 'MILKNOW' ? 'dice' : c.code === 'ORIENT' ? 'compass' : c.code === 'DRILL' ? 'flag' : 'pen') + '"></i> ' + (c.code === 'MILKNOW' ? (ov.canScore.indexOf(c.code) >= 0 ? 'Draw and score' : 'Draw a cadet') : c.code === 'ORIENT' ? (ov.canScore.indexOf(c.code) >= 0 ? 'Enter results' : 'View results') : c.code === 'DRILL' ? (ov.canScore.indexOf(c.code) >= 0 ? 'Score battalions' : 'View scores') : 'Score platoons') + '</button> ' : '') +
        (ov.isAdmin ? '<button class="btn btn-secondary" data-stand="' + c.code + '"><i class="fas fa-list-ol"></i> Standings and finalise</button> ' : '') +
        (ov.isAdmin && c.code === 'MILKNOW' ? '<button class="btn btn-outline" id="cpBank"><i class="fas fa-book"></i> Question bank</button>' : '') + '</div></div></div>';
    });
    if (ov.isAdmin) h += '<div class="card"><div class="card-header"><h3>Judges</h3></div><div class="card-body" id="cpJudges"></div></div>';
    $('cpMain').innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll('[data-score]'), function (b) { b.onclick = function () { var cc = b.getAttribute('data-score'); if (cc === 'MILKNOW') { if (window.reconMkScore) window.reconMkScore(); } else if (cc === 'ORIENT') { if (window.reconOrScore) window.reconOrScore(); } else if (cc === 'DRILL') { if (window.reconDrScore) window.reconDrScore(); } else openScoring(); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-stand]'), function (b) { b.onclick = function () { var sc = b.getAttribute('data-stand'); if (sc === 'MILKNOW') { if (window.reconMkStand) window.reconMkStand(); } else if (sc === 'ORIENT') { if (window.reconOrStand) window.reconOrStand(); } else if (sc === 'DRILL') { if (window.reconDrStand) window.reconDrStand(); } else openStandings(); }; });
    var bk = $('cpBank'); if (bk) bk.onclick = function () { if (window.reconMkBank) window.reconMkBank(); };
    if (ov.isAdmin) renderJudges();
  }

  // ---------- judges (Admin) ----------
  function renderJudges() {
    var el = $('cpJudges');
    var h = '<p class="muted">Tick what each judge scores. A person whose role is Judge sees only the scoring screens. Any other adult (Instructor, Unit Officer and so on) keeps their normal role and also gets Competitions: add them below. They sign in with the same account.</p>';
    h += ov.judges.length ? '<div class="rl-scroll"><table class="data-table"><thead><tr><th>Judge</th><th>Email</th>' + ov.live.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      ov.judges.map(function (j) { return '<tr><td>' + esc(j.name) + (j.role && j.role !== 'Judge' ? ' <span class="muted">(' + esc(j.role) + ')</span>' : '') + '</td><td>' + esc(j.email) + '</td>' + ov.live.map(function (c) { return '<td><input type="checkbox" class="cp-asg" data-e="' + esc(j.email) + '" data-c="' + c.code + '"' + (j.active && j.comps.indexOf(c.code) >= 0 ? ' checked' : '') + '></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'
      : '<p>No judges yet. Create an account with the Judge role, or add an existing adult below.</p>';
    h += '<div class="form-group" style="margin-top:10px"><label>Add an adult who has another role as a judge</label><div class="shi-pw"><select id="cpCand" class="form-control"><option value="">Select a person...</option>' + (ov.candidates || []).map(function (c) { return '<option value="' + esc(c.email) + '">' + esc(c.name) + ' (' + esc(c.role) + ')</option>'; }).join('') + '</select><button class="btn btn-outline btn-sm" type="button" id="cpCandAdd">Add</button></div></div>';
    h += '<label>Judges needed per platoon (Records Review) <input id="cpMin" type="number" min="0" max="20" class="form-control" style="width:90px;display:inline-block" value="' + esc(ov.settings.recordsMinJudges) + '"></label><br><label>Judges needed per platoon (Military Knowledge) <input id="cpMkMin" type="number" min="0" max="20" class="form-control" style="width:90px;display:inline-block" value="' + esc(ov.settings.mkMinJudges) + '"></label><br><label>Orienteering ties <select id="cpTie" class="form-control" style="width:auto;display:inline-block"><option value="SHARE"' + (ov.settings.orientTieBreak === 'SHARE' ? ' selected' : '') + '>Equal totals share the rank</option><option value="TIME"' + (ov.settings.orientTieBreak === 'TIME' ? ' selected' : '') + '>Faster time wins the tie</option></select></label><br><label>Drill: required strength per battalion (cadets) <input id="cpDrStr" type="number" min="1" max="300" class="form-control" style="width:90px;display:inline-block" value="' + esc(ov.settings.drillStrength) + '"></label><br><label>Judges needed per battalion (Drill) <input id="cpDrMin" type="number" min="0" max="20" class="form-control" style="width:90px;display:inline-block" value="' + esc(ov.settings.drillMinJudges) + '"></label> <button class="btn btn-outline btn-sm" id="cpMinSave">Save</button>';
    el.innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll('.cp-asg'), function (cb) {
      cb.onchange = function () {
        var e = cb.getAttribute('data-e'), comps = Array.prototype.filter.call(document.querySelectorAll('.cp-asg[data-e="' + e + '"]'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-c'); });
        api('compJudgesSet', [{ email: e, competitions: comps }]).then(function (r) { if (!r.success) { toast(r.error, 'error'); cb.checked = !cb.checked; return; } toast('Saved', 'success'); }).catch(err);
      };
    });
    $('cpCandAdd').onclick = function () {
      var e = $('cpCand').value; if (!e) { toast('Pick a person first', 'error'); return; }
      var c = (ov.candidates || []).filter(function (x) { return x.email === e; })[0]; if (!c) return;
      ov.candidates = ov.candidates.filter(function (x) { return x.email !== e; });
      ov.judges.push({ email: c.email, name: c.name, role: c.role, status: 'Active', comps: [], active: false });
      renderJudges(); toast('Now tick the competitions ' + c.name + ' will judge', 'info');
    };
    $('cpMinSave').onclick = function () { api('compSettingsSet', [{ recordsMinJudges: $('cpMin').value, mkMinJudges: $('cpMkMin').value, orientTieBreak: $('cpTie').value, drillStrength: $('cpDrStr').value, drillMinJudges: $('cpDrMin').value }]).then(function (r) { toast(r.success ? 'Saved' : r.error, r.success ? 'success' : 'error'); }).catch(err); };
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
  function progressOf(p) { return rec.records.filter(function (r) { var t = recTotal(p.id, r.code); return t !== null && t >= 0; }).length; }
  function drawList() {
    var byBn = {}; rec.platoons.forEach(function (p) { (byBn[p.battalion || 'Other'] = byBn[p.battalion || 'Other'] || []).push(p); });
    var sel = '<option value="">Select a platoon...</option>' + Object.keys(byBn).sort().map(function (b) {
      return '<optgroup label="' + esc(b) + '">' + byBn[b].map(function (p) { var n = progressOf(p); return '<option value="' + esc(p.id) + '">' + esc(p.name) + (n ? ' (' + n + ' of ' + rec.records.length + ' scored)' : '') + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    var scored = rec.platoons.filter(function (p) { return progressOf(p) > 0; });
    modal('Platoon Records Review: your scoring', (rec.canScore ? '' : '<div class="rl-note rl-on"><i class="fas fa-lock"></i> This competition is finalised. Scores are locked.</div>') +
      (rec.platoons.length ? '<div class="form-group"><label>Platoon</label><select id="cpPick" class="form-control">' + sel + '</select></div><p class="muted">No nominal roll is needed. Pick the platoon and score its records.</p>' +
        (scored.length ? '<h4>Your progress</h4><div class="rl-scroll"><table class="data-table"><tbody>' + scored.map(function (p) { var n = progressOf(p); return '<tr><td><b>' + esc(p.name) + '</b><div class="rl-sub">' + esc(p.battalion) + '</div></td><td><span class="rl-badge ' + (n === rec.records.length ? 'rl-ok' : 'rl-warn') + '">' + n + ' of ' + rec.records.length + ' records</span></td><td><button class="btn btn-outline btn-sm" data-p="' + esc(p.id) + '">' + (rec.canScore ? 'Continue' : 'View') + '</button></td></tr>'; }).join('') + '</tbody></table></div>' : '')
        : '<p>No platoons are set up yet. An Admin can add them under Import results > Platoons.</p>'),
      '<button class="btn btn-outline" id="cpClose">Close</button>');
    $('cpClose').onclick = closeModal;
    var pick = $('cpPick'); if (pick) pick.onchange = function () { if (pick.value) drawForm(pick.value); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { drawForm(b.getAttribute('data-p')); }; });
  }
  function drawForm(pid) {
    var p = rec.platoons.filter(function (x) { return x.id === pid; })[0], cur = rec.mine[pid] || {};
    var stamps = rec.records.map(function (r) { return (cur[r.code] || {}).updated || ''; }).filter(Boolean).sort(function (x, y) { return new Date(y) - new Date(x); });
    var h = (stamps.length ? '<p class="muted"><i class="fas fa-clock"></i> Last saved ' + esc(stamps[0]) + '</p>' : '') + '<p class="muted">Enter each mark from 0 up to the maximum shown. Leave a box empty if not yet marked. Maximum ' + rec.max + ' in total.</p>';
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
      modal('Records Review standings ' + badge(d.status).replace(/<[^>]+>/g, ' '), body, '<button class="btn btn-outline" id="cpClose">Close</button><button class="btn btn-outline" id="cpPdfS"><i class="fas fa-file-pdf"></i> Standings PDF</button><button class="btn btn-outline" id="cpPdfD"><i class="fas fa-file-pdf"></i> Score sheets PDF</button>' + (final ? '<button class="btn btn-outline" id="cpRe"><i class="fas fa-unlock"></i> Reopen scoring</button>' : '<button class="btn btn-primary" id="cpFin"><i class="fas fa-lock"></i> Finalise</button>'));
      $('cpClose').onclick = function () { closeModal(); load(); };
      $('cpPdfS').onclick = function () { printDoc(standingsHtml(d)); };
      $('cpPdfD').onclick = function () { api('compRecordsDetail').then(function (x) { if (!x.success) { toast(x.error, 'error'); return; } printDoc(sheetsHtml(x, d)); }).catch(err); };
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
  // ---------- printable PDFs (browser print window: choose "Save as PDF") ----------
  function css() {
    return '@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#17231c;font-size:10px;margin:0}' +
      '.top{display:flex;align-items:center;gap:12px;border-bottom:3px solid #c9a227;padding-bottom:6px;margin-bottom:8px}.top img{height:56px}.top h1{margin:0;font-size:16px;color:#154b12}.top h2{margin:2px 0 0;font-size:12px}' +
      'p.meta{color:#555;margin:2px 0 8px}table{width:100%;border-collapse:collapse;margin-bottom:10px}th{background:#154b12;color:#fff;padding:5px 4px;font-size:9px}td{padding:4px;border:1px solid #bbb}' +
      '.l{text-align:left}.n{text-align:right}h3{color:#154b12;margin:10px 0 2px;font-size:12px}.pg+.pg{page-break-before:always}tr{page-break-inside:avoid}' +
      '.sig{display:flex;justify-content:space-between;margin-top:26px;font-size:10px}.note{margin-top:12px;font-size:8px;color:#666;font-style:italic}';
  }
  function docHtml(title, meta, body) {
    var logo = new URL('img/ttcf-logo.png', document.baseURI).href;
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + css() + '</style></head><body>' +
      '<div class="top"><img src="' + esc(logo) + '" alt="TTCF"><div><h1>TRINIDAD AND TOBAGO CADET FORCE</h1><h2>' + esc(title) + '</h2></div></div><p class="meta">' + meta + '</p>' + body +
      '<script>window.onload=function(){setTimeout(function(){window.print();},400)}<\/script></body></html>';
  }
  function metaLine(d) { return 'School year ' + d.year + '-' + (d.year + 1) + ' &middot; ' + (d.status === 'FINAL' ? 'Finalised' + (d.finalizedAt ? ' ' + esc(d.finalizedAt) : '') + (d.finalizedBy ? ' by ' + esc(d.finalizedBy) : '') : 'Scoring still open (provisional)') + ' &middot; Generated ' + esc(d.generated); }
  function standingsHtml(d) {
    var codes = ['RB', 'TP', 'C15', 'C19'];
    var rows = d.rows.slice().sort(function (a, b) { return (a.rank || 999) - (b.rank || 999); }).map(function (r) {
      return '<tr><td class="n">' + (r.rank || '-') + '</td><td class="l">' + esc(r.name) + '</td><td class="l">' + esc(r.battalion) + '</td><td class="n">' + r.judgesDone + '</td>' + codes.map(function (c) { return '<td class="n">' + (r.recs[c] === null ? '-' : esc(r.recs[c])) + '</td>'; }).join('') + '<td class="n"><b>' + (r.total === null ? '-' : esc(r.total)) + '</b></td></tr>'; }).join('');
    return docHtml('Review of Platoon Records: standings', metaLine(d),
      '<p>Average of the judges\' totals out of ' + d.max + '. RB = Roll book, TP = Training Programme, C15 = Training Report, C19 = Nominal Roll Report.</p>' +
      '<table><thead><tr><th>#</th><th class="l">Platoon</th><th class="l">Bn</th><th>Judges</th><th>RB</th><th>TP</th><th>C15</th><th>C19</th><th>Total /' + d.max + '</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9">No scores recorded yet.</td></tr>') + '</tbody></table>' +
      '<div class="sig"><div>Chief Judge: ______________________</div><div>Date: ______________</div></div>');
  }
  function sheetsHtml(x, st) {
    var by = {}; x.rows.forEach(function (r) { (by[r.platoonId] = by[r.platoonId] || { name: r.platoonName, bn: r.battalion, judges: {} }); var j = by[r.platoonId].judges; (j[r.judge] = j[r.judge] || {})[r.record] = r; });
    var avg = {}; st.rows.forEach(function (r) { avg[r.id] = r; });
    var body = Object.keys(by).sort(function (a, b) { return by[a].name.localeCompare(by[b].name); }).map(function (pid) {
      var p = by[pid], s = avg[pid] || {};
      var judges = Object.keys(p.judges).sort().map(function (jn) {
        var recs = p.judges[jn], tot = 0, last = '';
        var rows = x.records.map(function (rc) {
          var r = recs[rc.code]; if (!r) return '<tr><td class="l">' + esc(rc.name) + '</td><td class="n" colspan="5">not marked</td><td></td></tr>';
          tot += r.total; if (r.updated) last = r.updated;
          return '<tr><td class="l">' + esc(rc.name) + '</td>' + x.criteria.map(function (c) { return '<td class="n">' + (r[c.key] === '' ? '-' : esc(r[c.key])) + '</td>'; }).join('') + '<td class="n"><b>' + esc(r.total) + '</b></td><td class="l">' + esc(r.comment) + ' <i>' + esc(r.updated) + '</i></td></tr>';
        }).join('');
        return '<h3>Judge: ' + esc(jn) + ' &mdash; total ' + tot + ' / ' + x.max + (last ? ' &middot; last saved ' + esc(last) : '') + '</h3><table><thead><tr><th class="l">Record</th>' + x.criteria.map(function (c) { return '<th>' + esc(c.label) + ' /' + c.max + '</th>'; }).join('') + '<th>Total</th><th class="l">Comment and time saved</th></tr></thead><tbody>' + rows + '</tbody></table>';
      }).join('');
      return '<div class="pg"><h2 style="color:#154b12;margin:0 0 2px">' + esc(p.name) + '</h2><p class="meta">' + esc(p.bn) + ' &middot; Platoon score (average of complete judges): <b>' + (s.total === null || s.total === undefined ? '-' : esc(s.total)) + ' / ' + x.max + '</b>' + (s.rank ? ' &middot; Rank ' + s.rank : '') + '</p>' + judges + '</div>';
    }).join('');
    return docHtml('Review of Platoon Records: score sheets', metaLine(x), body || '<p>No scores recorded yet.</p>');
  }
  function printDoc(html) {
    var w = window.open('', '_blank');
    if (!w) { toast('Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  window.reconCp = { modal: modal, closeModal: closeModal, api: api, esc: esc, toast: toast, err: err, printDoc: printDoc, docHtml: docHtml, metaLine: metaLine, reload: load };
  window.reconCompStandingsHtml = standingsHtml; window.reconCompSheetsHtml = sheetsHtml;
})();
