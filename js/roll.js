/* RECON: Platoon registration by Nominal Roll (C19A). Unit Officers upload the roll, RECON shows every problem and how to fix it,
 * the Battalion Commander or an Admin approves. The Excel file is read in this browser; nothing is stored on the device. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function role() { var s = window.reconApi && reconApi.getSession(); return s && s.user ? s.user.role : 'Guest'; }
  function isAdmin() { return role() === 'Admin' || role() === 'Super Admin'; }
  function canUse() { var r = role(); return r === 'Unit Officer' || r === 'Battalion Commander' || isAdmin(); }
  window.reconRollAllowed = function () { return canUse(); };
  function api(a, args) { return reconApi.call(a, args || []); }
  function toast(m, t) { if (window.showToast) window.showToast(m, t || 'info'); }
  function err(e) { toast(e && e.message ? e.message : 'Something went wrong', 'error'); if (window.hideLoading) window.hideLoading(); }
  var COLS = [['reg', 'Reg. No.', 70], ['rank', 'Rank', 60], ['surname', 'Surname', 120], ['first', 'First Name', 110], ['sex', 'Sex', 70], ['dob', 'Date of Birth', 110], ['school', 'School Attending', 190],
              ['parent', 'Parent / Guardian', 150], ['address', 'Address', 200], ['parentEmail', 'Parent Email', 170], ['cadetEmail', 'Cadet Email', 170], ['parentTel', 'Parent Tel.', 95], ['cadetTel', 'Cadet Tel.', 95]];
  var STATE = { none: ['Not registered', 'muted'], pending: ['Waiting for approval', 'warn'], rejected: ['Returned: fix and resubmit', 'bad'], registered: ['Registered', 'ok'], 'registered-update': ['Registered (update waiting)', 'ok'] };
  var info = null, injected = false, W = null, xlsxLoading = null;

  function compLabel(code) { var c = (info && info.competitions || []).filter(function (x) { return x.code === code; })[0]; return c ? c.label : code; }
  function compList(codes) { if (!codes || !codes.length) return ''; if (info && info.competitions && codes.length === info.competitions.length) return 'All competitions'; return codes.map(compLabel).join(', '); }
  function compBoxes(selected) {
    return '<fieldset class="rl-comps"><legend><b>Which competitions is this roll for?</b></legend>' + (info.competitions || []).map(function (c) {
      return '<label class="rl-cb"><input type="checkbox" class="rl-comp" value="' + esc(c.code) + '"' + (selected.indexOf(c.code) >= 0 ? ' checked' : '') + '> ' + esc(c.label) + '</label>';
    }).join(' ') + '<div class="muted">A platoon can register for several competitions. The same cadets may appear in more than one.</div></fieldset>';
  }
  function pickedComps() { return Array.prototype.map.call(document.querySelectorAll('.rl-comp:checked'), function (x) { return x.value; }); }

  // ---------- modal ----------
  function modal(title, body, footer) {
    var old = $('rlModal'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'rlModal'; o.className = 'modal-overlay active';
    o.innerHTML = '<div class="modal modal-lg rl-modal" role="dialog" aria-modal="true"><div class="modal-header"><h3>' + esc(title) + '</h3><button class="modal-close" aria-label="Close" id="rlX">&times;</button></div>' +
      '<div class="modal-body" id="rlBody">' + body + '</div><div class="modal-footer" id="rlFoot">' + (footer || '') + '</div></div>';
    document.body.appendChild(o); $('rlX').onclick = closeModal; return o;
  }
  function closeModal() { var o = $('rlModal'); if (o) o.remove(); W = null; }

  // ---------- page ----------
  function inject() {
    if (injected || $('page-roll')) return; var content = document.querySelector('.content'); if (!content) return; injected = true;
    var pg = document.createElement('div'); pg.id = 'page-roll'; pg.className = 'page';
    pg.innerHTML = '<div class="section-header"><h2><i class="fas fa-clipboard-check"></i> Platoon registration</h2><div class="section-actions" id="rlTools"></div></div>' +
      '<p class="muted">Every platoon registers with its Nominal Roll (form C19A) to take part in Cadet Force activities. Upload the roll, fix anything RECON flags, then it goes to the Battalion Commander or an Admin for approval.</p>' +
      '<div id="rlBanner"></div><div id="rlSum" class="rl-sum"></div>' +
      '<div class="card"><div class="card-header"><h3>Platoons</h3></div><div class="card-body"><div class="rl-scroll"><table class="data-table"><thead><tr><th>Platoon</th><th>Battalion</th><th>Status</th><th>Registered for</th><th>Cadets</th><th></th></tr></thead><tbody id="rlRows"></tbody></table></div></div></div>' +
      '<div class="card"><div class="card-header"><h3>Roll history</h3></div><div class="card-body" id="rlHist"></div></div>';
    content.appendChild(pg);
    var nav = document.querySelector('.nav-menu'), li = document.createElement('li'), after = document.querySelector('[data-page="cadets"]');
    li.className = 'nav-item rl-nav'; li.setAttribute('data-page', 'roll'); li.style.display = canUse() ? '' : 'none';
    li.innerHTML = '<i class="fas fa-clipboard-check"></i><span>Registration</span>'; li.onclick = function () { window.navigateTo('roll'); };
    if (nav) nav.insertBefore(li, after ? after.nextSibling : null);
  }
  var origRole = window.reconUiRole; window.reconUiRole = function () { if (origRole) origRole(); inject(); var li = document.querySelector('.rl-nav'); if (li) li.style.display = canUse() ? '' : 'none'; };

  function load() {
    inject(); if (window.hideLoading) window.hideLoading();
    if (!canUse()) { $('rlRows').innerHTML = '<tr><td colspan="6">Registration is for Unit Officers, Battalion Commanders and Admins.</td></tr>'; return; }
    api('rollPlatoons').then(function (d) { info = d; render(); }).catch(err);
    api('rollList').then(function (d) { renderHist(d.rolls); }).catch(function () {});
  }
  window.loadRoll = load;

  function render() {
    var yr = info.year, s = info.summary;
    $('rlSum').innerHTML = '<div class="rl-stat"><b>' + s.registered + '</b> of <b>' + s.total + '</b> platoons registered for ' + yr + '-' + (yr + 1) + '</div>' + (s.pending ? '<div class="rl-stat rl-warn"><b>' + s.pending + '</b> waiting for approval</div>' : '');
    $('rlBanner').innerHTML = info.enforce ? '<div class="rl-note rl-on"><i class="fas fa-lock"></i> Platoons without an approved roll are <b>blocked</b> from competition entries and results.</div>'
      : '<div class="rl-note"><i class="fas fa-info-circle"></i> Blocking is <b>off</b>: unregistered platoons can still be entered. An Admin turns it on when the platoons have registered.</div>';
    var tools = '';
    if (info.canAdd) tools += '<button class="btn btn-outline" id="rlAdd"><i class="fas fa-plus"></i> Add platoon</button>';
    if (isAdmin()) tools += '<button class="btn btn-outline" id="rlSet"><i class="fas fa-sliders-h"></i> Settings</button>';
    $('rlTools').innerHTML = tools;
    if ($('rlAdd')) $('rlAdd').onclick = addPlatoon; if ($('rlSet')) $('rlSet').onclick = settings;
    $('rlRows').innerHTML = info.platoons.length ? info.platoons.map(function (p) {
      var st = STATE[p.state] || STATE.none, acts = '';
      if (p.state === 'pending' && info.canApprove) acts += '<button class="btn btn-primary btn-sm" data-rv="' + esc(p.rollId) + '"><i class="fas fa-check"></i> Review</button> ';
      else if (p.state !== 'none' && p.rollId) acts += '<button class="btn btn-outline btn-sm" data-rv="' + esc(p.rollId) + '"><i class="fas fa-eye"></i> View roll</button> ';
      if (p.state !== 'pending' || !info.canApprove) acts += '<button class="btn ' + (p.state === 'registered' ? 'btn-outline' : 'btn-secondary') + ' btn-sm" data-up="' + esc(p.id) + '"><i class="fas fa-upload"></i> ' + (p.state === 'none' || p.state === 'rejected' ? 'Upload roll' : 'Upload new roll') + '</button>';
      return '<tr><td><b>' + esc(p.name) + '</b>' + (p.note ? '<div class="rl-sub rl-bad-t">' + esc(p.note) + '</div>' : '') + '</td><td>' + esc(p.battalion || '') + '</td><td><span class="rl-badge rl-' + st[1] + '">' + st[0] + '</span></td><td>' + (p.registeredFor && p.registeredFor.length ? '<span class="rl-badge rl-ok">' + esc(compList(p.registeredFor)) + '</span>' : '<span class="muted">None yet</span>') + (p.pendingFor && p.pendingFor.length ? '<div class="rl-sub">Waiting: ' + esc(compList(p.pendingFor)) + '</div>' : '') + '</td><td>' + (p.cadetCount || '') + '</td><td class="rl-act">' + acts + '</td></tr>';
    }).join('') : '<tr><td colspan="6">No platoons yet. ' + (info.canAdd ? 'Use <b>Add platoon</b> to add your platoon number.' : 'An Admin needs to add the platoons.') + '</td></tr>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-up]'), function (b) { b.onclick = function () { startRegister(b.getAttribute('data-up')); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-rv]'), function (b) { b.onclick = function () { review(b.getAttribute('data-rv')); }; });
  }
  function renderHist(list) {
    var el = $('rlHist'); if (!el) return;
    el.innerHTML = list.length ? '<div class="rl-scroll"><table class="data-table"><thead><tr><th>Platoon</th><th>Submitted</th><th>By</th><th>Cadets</th><th>Competitions</th><th>Status</th><th>Note</th></tr></thead><tbody>' + list.map(function (r) {
      return '<tr><td>' + esc(r.platoonName) + '</td><td>' + esc((r.submittedAt || '').substr(0, 10)) + '</td><td>' + esc(r.submittedByName) + '</td><td>' + r.cadetCount + '</td><td>' + esc(compList(r.competitions)) + '</td><td>' + esc(r.status.toLowerCase()) + '</td><td>' + esc(r.decisionNote || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="muted">No rolls submitted yet.</p>';
  }

  // ---------- settings (Admin) ----------
  function settings() {
    modal('Registration settings', '<div class="rl-set"><label><b>Block unregistered platoons</b></label><select id="rlEnf" class="form-control"><option value="OFF">Off: unregistered platoons can still be entered</option><option value="ON">On: no approved roll means no competition entry or results</option></select>' +
      '<p class="muted">Turn this on once the platoons have registered. It blocks new Shield results, orienteering teams and imports for platoons with no approved roll.</p>' +
      '<label><b>Who approves a roll</b></label><select id="rlApr" class="form-control"><option value="ANY">Either the Battalion Commander or an Admin</option><option value="BOTH">Both: the Battalion Commander and an Admin</option></select></div>',
      '<button class="btn btn-outline" id="rlCancel">Cancel</button><button class="btn btn-primary" id="rlSave">Save</button>');
    $('rlEnf').value = info.enforce ? 'ON' : 'OFF'; $('rlApr').value = info.approvalMode || 'ANY'; $('rlCancel').onclick = closeModal;
    $('rlSave').onclick = function () { api('rollSettingsSet', [{ enforce: $('rlEnf').value, approvalMode: $('rlApr').value }]).then(function (d) { if (!d.success) { toast(d.error, 'error'); return; } closeModal(); toast('Saved', 'success'); load(); }).catch(err); };
  }
  function addPlatoon() {
    var admin = isAdmin();
    modal('Add platoon', '<p>' + (admin ? '' : 'This adds a platoon to <b>' + esc(info.unit || 'your unit') + '</b>. ') + 'Enter the platoon number.</p>' +
      (admin ? '<label>Unit (school name)</label><input id="rlPU" class="form-control"><label>Battalion</label><input id="rlPB" class="form-control" placeholder="e.g. 5TTCF">' : '') +
      '<label>Platoon number</label><input id="rlPN" class="form-control" inputmode="numeric" placeholder="1">', '<button class="btn btn-outline" id="rlCancel">Cancel</button><button class="btn btn-primary" id="rlOk">Add</button>');
    $('rlCancel').onclick = closeModal;
    $('rlOk').onclick = function () {
      var d = { platoonNumber: $('rlPN').value }; if (admin) { d.unit = $('rlPU').value; d.battalion = $('rlPB').value; }
      api('rollPlatoonAdd', [d]).then(function (r) { if (!r.success) { toast(r.error, 'error'); return; } closeModal(); toast('Platoon added', 'success'); load(); }).catch(err);
    };
  }

  // ---------- register: upload, check, fix, submit ----------
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxLoading) return xlsxLoading;
    xlsxLoading = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'js/vendor/xlsx.mini.min.js'; s.onload = res; s.onerror = function () { xlsxLoading = null; rej(new Error('The Excel reader could not load. Check your connection and try again.')); }; document.head.appendChild(s); });
    return xlsxLoading;
  }
  function startRegister(platoonId) {
    var p = info.platoons.filter(function (x) { return x.id === platoonId; })[0]; if (!p) return;
    W = { platoon: p, header: null, rows: [], issues: [], counts: null, matches: null, ok: false, fixed: [], file: '', dirty: false };
    modal('Register ' + p.name,
      compBoxes([]) + '<div class="rl-drop"><p><b>Step 1.</b> Choose the Excel file of the Nominal Roll (form C19A) for <b>' + esc(p.name) + '</b>.</p>' +
      '<input type="file" id="rlFile" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">' +
      '<p class="muted">RECON reads the <b>C19A (Cadets)</b> sheet. Other sheets, and the Recruits sheet, are ignored. The file is read on this device; only the roll details are sent for checking.</p></div><div id="rlRes"></div>',
      '<button class="btn btn-outline" id="rlCancel">Close</button>');
    $('rlCancel').onclick = closeModal;
    $('rlFile').onchange = function () { var f = this.files && this.files[0]; if (f) readFile(f); };
  }
  function readFile(f) {
    W.file = f.name; $('rlRes').innerHTML = '<p>Reading ' + esc(f.name) + '...</p>';
    loadXlsx().then(function () { return f.arrayBuffer ? f.arrayBuffer() : new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsArrayBuffer(f); }); })
      .then(function (buf) {
        var r = window.ReconRollParse.parse(window.XLSX, new Uint8Array(buf));
        if (!r.ok) { $('rlRes').innerHTML = '<div class="rl-note rl-on">' + esc(r.error) + '</div>'; return; }
        W.header = r.header; W.rows = r.rows; W.fixed = []; W.first = true; W.sheet = r.sheetName;
        check();
      }).catch(function (e) { $('rlRes').innerHTML = '<div class="rl-note rl-on">' + esc(e && e.message ? e.message : 'The file could not be read.') + '</div>'; });
  }
  function payload() { return { platoonId: W.platoon.id, competitions: pickedComps(), header: W.header, rows: W.rows.map(function (r) { return { n: r.n, dobIsDate: !!r.dobIsDate, cells: r.cells }; }) }; }
  function check() {
    $('rlRes').innerHTML = '<p>Checking the roll...</p>';
    api('rollCheck', [payload()]).then(function (d) {
      if (!d.success) { $('rlRes').innerHTML = '<div class="rl-note rl-on">' + esc(d.error) + '</div>'; return; }
      W.rows = d.rows.map(function (r) { return { n: r.n, dobIsDate: true, cells: r.cells }; });   // from here on the dates are clean ISO dates
      W.issues = d.issues; W.counts = d.counts; W.matches = d.matches; W.ok = d.ok; W.dirty = false;
      if (W.first) { W.fixed = d.issues.filter(function (i) { return i.level === 'fixed'; }); W.first = false; }
      showResult();
    }).catch(err);
  }
  function worst(n, col) { var w = ''; W.issues.forEach(function (i) { if (i.row === n && i.col === col) { if (i.level === 'error') w = 'error'; else if (i.level === 'warn' && w !== 'error') w = 'warn'; else if (i.level === 'fixed' && !w) w = 'fixed'; } }); return w; }
  function showResult() {
    var c = W.counts, errs = W.issues.filter(function (i) { return i.level === 'error'; }), warns = W.issues.filter(function (i) { return i.level === 'warn'; });
    var h = '<div class="rl-chips"><span class="rl-chip rl-c-err">' + c.errors + ' to fix</span><span class="rl-chip rl-c-warn">' + c.warnings + ' to check</span><span class="rl-chip rl-c-fix">' + W.fixed.length + ' fixed for you</span><span class="rl-chip">' + c.cadets + ' cadets</span></div>';
    h += W.edit ? '<p class="muted">Editing the roll for ' + esc(W.platoon.name) + '. Change any cell, press Check again, then Save changes.</p>' : '<p class="muted">' + esc(W.file) + ' &middot; sheet "' + esc(W.sheet) + '" &middot; ' + esc(W.header.unitLine || '') + '</p>';
    if (W.ok) h += '<div class="rl-note rl-good"><i class="fas fa-check-circle"></i> No problems that stop registration. ' + (warns.length ? 'Please look at the ' + warns.length + ' item(s) to check, then submit.' : 'You can submit this roll.') + '</div>';
    else h += '<div class="rl-note rl-on"><i class="fas fa-exclamation-circle"></i> Fix the red items below, in the table or in your Excel file, then press <b>Check again</b>. Row numbers match the rows in your Excel sheet.</div>';
    if (W.matches) h += '<p class="muted">If approved: <b>' + W.matches.added + '</b> new cadet(s) added, <b>' + W.matches.updated + '</b> updated' + (W.matches.moved.length ? ', <b>' + W.matches.moved.length + '</b> moved from another unit' : '') + (W.matches.missing.length ? '. <b>' + W.matches.missing.length + '</b> cadet(s) already listed for this platoon are not on the roll (they are not removed).' : '.') + '</p>';
    function list(arr, cls, title) {
      if (!arr.length) return '';
      return '<h4 class="rl-h ' + cls + '">' + title + ' (' + arr.length + ')</h4><ul class="rl-issues">' + arr.map(function (i) {
        return '<li class="rl-iss ' + cls + '"' + (i.row ? ' data-r="' + i.row + '" data-c="' + esc(i.col) + '"' : '') + '><b>' + (i.row ? 'Row ' + i.row + (i.colLabel ? ' &middot; ' + esc(i.colLabel) : '') : 'Top of the form') + '</b><div>' + esc(i.msg) + '</div>' +
          (i.fix ? '<div class="rl-fix"><b>How to fix:</b> ' + esc(i.fix) + (i.example ? ' <span class="rl-ex">Example: ' + esc(i.example) + '</span>' : '') + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    h += list(errs, 'rl-e', 'To fix before you can submit') + list(warns, 'rl-w', 'Please check');
    if (W.fixed.length) h += '<details class="rl-fixed"><summary>' + W.fixed.length + ' thing(s) RECON fixed for you</summary><ul class="rl-issues">' + W.fixed.map(function (i) { return '<li class="rl-iss rl-f"><b>Row ' + i.row + (i.colLabel ? ' &middot; ' + esc(i.colLabel) : '') + '</b><div>' + esc(i.msg) + '</div>' + (i.fix ? '<div class="rl-fix">' + esc(i.fix) + '</div>' : '') + '</li>'; }).join('') + '</ul></details>';
    h += '<h4 class="rl-h">The roll</h4><p class="muted">Red cells must be fixed, amber cells need a look, blue cells were fixed for you. You can type in any cell.</p><div class="rl-grid-wrap"><table class="rl-grid"><thead><tr><th>Row</th>' + COLS.map(function (k) { return '<th style="min-width:' + k[2] + 'px">' + k[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      W.rows.map(function (r, ri) {
        return '<tr><th>' + r.n + '</th>' + COLS.map(function (k) {
          var w = worst(r.n, k[0]), msg = ''; W.issues.forEach(function (i) { if (i.row === r.n && i.col === k[0]) msg += i.msg + ' '; });
          return '<td class="' + (w ? 'rl-g-' + w : '') + '" id="rlc-' + r.n + '-' + k[0] + '"><input data-ri="' + ri + '" data-k="' + k[0] + '" value="' + esc(r.cells[k[0]]) + '"' + (msg ? ' title="' + esc(msg.trim()) + '"' : '') + ' aria-label="' + k[1] + ' row ' + r.n + '"></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    $('rlRes').innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll('.rl-grid input'), function (inp) {
      inp.oninput = function () { W.rows[+inp.getAttribute('data-ri')].cells[inp.getAttribute('data-k')] = inp.value; W.dirty = true; var b = $('rlRecheck'); if (b) b.classList.add('btn-primary'); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('.rl-iss[data-r]'), function (li) {
      li.onclick = function () { var td = $('rlc-' + li.getAttribute('data-r') + '-' + li.getAttribute('data-c')); if (td) { td.scrollIntoView({ block: 'center', inline: 'center' }); var i = td.querySelector('input'); if (i) i.focus(); } };
    });
    $('rlFoot').innerHTML = '<button class="btn btn-outline" id="rlCancel">Close</button><button class="btn btn-outline" id="rlRep"><i class="fas fa-download"></i> Download problem list</button>' +
      '<button class="btn btn-secondary" id="rlRecheck"><i class="fas fa-sync"></i> Check again</button><button class="btn btn-primary" id="rlSubmit"' + (W.ok ? '' : ' disabled title="Fix the red items first"') + '>' + (W.edit ? '<i class="fas fa-save"></i> Save changes' : '<i class="fas fa-paper-plane"></i> Submit for approval') + '</button>';
    $('rlCancel').onclick = closeModal; $('rlRecheck').onclick = check; $('rlRep').onclick = downloadReport; $('rlSubmit').onclick = W.edit ? saveEdit : submit;
  }
  function downloadReport() {
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    var lines = [['Row', 'Column', 'Type', 'Problem', 'How to fix', 'Example'].map(q).join(',')];
    var order = { error: 0, warn: 1, fixed: 2 }, names = { error: 'Must fix', warn: 'Check', fixed: 'Fixed for you' };
    W.issues.concat(W.fixed.filter(function () { return !W.issues.some(function (i) { return i.level === 'fixed'; }); })).sort(function (a, b) { return order[a.level] - order[b.level] || a.row - b.row; })
      .forEach(function (i) { lines.push([i.row || 'Top of form', i.colLabel, names[i.level], i.msg, i.fix, i.example].map(q).join(',')); });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'roll-problems-' + W.platoon.name.replace(/[^a-z0-9]+/gi, '-') + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function submit() {
    if (W.dirty) { toast('You changed the table. Press Check again first.', 'error'); return; }
    if (!pickedComps().length) { toast('Tick at least one competition this roll is for.', 'error'); return; }
    if (!window.confirm('Submit this roll of ' + W.counts.cadets + ' cadets for approval?')) return;
    if (window.showLoading) window.showLoading();
    api('rollSubmit', [payload()]).then(function (d) {
      if (window.hideLoading) window.hideLoading();
      if (!d.success) { toast(d.error, 'error'); if (d.issues) { W.issues = d.issues; W.counts = d.counts; W.ok = false; showResult(); } return; }
      closeModal(); toast('Roll submitted for approval', 'success'); load();
    }).catch(err);
  }

  // ---------- review (Battalion Commander / Admin, or the submitter) ----------
  function review(id) {
    if (window.showLoading) window.showLoading();
    api('rollGet', [id]).then(function (d) {
      if (window.hideLoading) window.hideLoading();
      if (!d.success) { toast(d.error, 'error'); return; }
      var r = d.roll, m = d.matches, st = r.status.toLowerCase();
      var h = '<p><b>' + esc(r.unit) + ' - Platoon ' + esc(r.platoonNumber) + '</b> &middot; Term ' + esc(r.term) + ' &middot; ' + esc(r.cadetCount) + ' cadets &middot; ' + esc(st) + '</p>' +
        '<p class="muted">Submitted by ' + esc(r.submittedByName) + ' on ' + esc((r.submittedAt || '').substr(0, 10)) + '. Unit Commander: ' + esc(r.unitCommander) + '. Battalion Commander: ' + esc(r.bnCommander) + '.</p>';
      h += '<p><b>Competitions:</b> ' + esc(compList(r.competitions)) + (r.legacyAll ? ' <span class="muted">(registered before competitions were chosen)</span>' : '') + '</p>';
      if (r.editLog && r.editLog.length) h += '<p class="muted">Edited ' + r.editLog.length + ' time(s); last by ' + esc(r.editLog[r.editLog.length - 1].by) + ' on ' + esc(r.editLog[r.editLog.length - 1].at.substr(0, 10)) + '.</p>';
      if (r.approvals && r.approvals.length) h += '<p class="muted">Approved so far by: ' + r.approvals.map(function (a) { return esc(a.name) + ' (' + (a.role === 'BC' ? 'Battalion Commander' : 'Admin') + ')'; }).join(', ') + '.</p>';
      if (r.decisionNote) h += '<div class="rl-note">' + esc(r.decisionNote) + '</div>';
      if (m) h += '<p class="muted">If approved: <b>' + m.added + '</b> new cadet(s) added, <b>' + m.updated + '</b> updated' + (m.moved.length ? ', <b>' + m.moved.length + '</b> moved from another unit' : '') + (m.missing.length ? '. Not on the roll (kept): ' + m.missing.map(function (x) { return esc(x.name); }).join(', ') : '') + '.</p>';
      if (d.rows.length) h += '<div class="rl-grid-wrap"><table class="rl-grid rl-ro"><thead><tr><th>Row</th>' + COLS.map(function (k) { return '<th>' + k[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
        d.rows.map(function (x) { return '<tr><th>' + x.n + '</th>' + COLS.map(function (k) { return '<td>' + esc(x[k[0]]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      else h += '<p class="muted">The cadet details are removed once a roll is replaced or returned.</p>';
      var f = '<button class="btn btn-outline" id="rlCancel">Close</button>';
      var canDl = d.canDownload && d.rows.length; d.competitionsText = compList(r.competitions);
      if (canDl) f += '<button class="btn btn-outline" id="rlDlX"><i class="fas fa-file-excel"></i> Download Excel</button><button class="btn btn-outline" id="rlDlP"><i class="fas fa-file-pdf"></i> Download PDF</button>';
      var canEdit = isAdmin() && (r.status === 'APPROVED' || r.status === 'SUBMITTED') && d.rows.length;
      if (canEdit) f += '<button class="btn btn-secondary" id="rlEdit"><i class="fas fa-edit"></i> Edit roll</button>';
      if (d.canDecide) f += '<button class="btn btn-outline rl-ret" id="rlRet"><i class="fas fa-undo"></i> Return for fixes</button><button class="btn btn-primary" id="rlApp"><i class="fas fa-check"></i> Approve</button>';
      modal('Nominal roll', h, f); $('rlCancel').onclick = closeModal;
      if (canEdit) $('rlEdit').onclick = function () { startEdit(d); };
      if (canDl) {
        $('rlDlX').onclick = function () { var b = this; b.disabled = true; window.ReconRollExport.xlsx(d).then(function (n) { toast('Downloaded ' + n, 'success'); }).catch(err).then(function () { b.disabled = false; }); };
        $('rlDlP').onclick = function () { window.ReconRollExport.pdf(d).then(function () { toast('In the print window, choose Save as PDF.', 'info'); }).catch(err); };
      }
      if (d.canDecide) {
        $('rlApp').onclick = function () {
          if (!window.confirm('Approve this roll? ' + (m ? m.added + ' new cadet(s) will be added and ' + m.updated + ' updated. ' : '') + 'The platoon becomes registered.')) return;
          decide({ id: id, decision: 'APPROVE' });
        };
        $('rlRet').onclick = function () {
          $('rlBody').insertAdjacentHTML('afterbegin', '<div class="rl-set"><label><b>What must the unit fix?</b></label><textarea id="rlNote" class="form-control" rows="3" placeholder="e.g. Row 9 needs a parent telephone number."></textarea><button class="btn btn-primary btn-sm" id="rlRetGo">Return roll</button></div>');
          $('rlRetGo').onclick = function () { decide({ id: id, decision: 'REJECT', note: $('rlNote').value }); };
        };
      }
    }).catch(err);
  }
  // ---------- Admin: edit a roll ----------
  function startEdit(d) {
    var r = d.roll;
    W = { platoon: { id: r.platoonId, name: r.unit + ' - Platoon ' + r.platoonNumber }, header: { date: r.rollDate, term: r.term, unitLine: r.unitLine, school: r.school, unitCommander: r.unitCommander, bnCommander: r.bnCommander },
          rows: d.rows.map(function (x) { var c = {}; COLS.forEach(function (k) { c[k[0]] = x[k[0]]; }); return { n: x.n, dobIsDate: true, cells: c }; }), issues: [], counts: null, matches: null, ok: false, fixed: [], file: '', sheet: '', first: true, dirty: false, edit: r.id };
    modal('Edit roll: ' + W.platoon.name, compBoxes(r.competitions) + '<div id="rlRes"></div>', '<button class="btn btn-outline" id="rlCancel">Close</button>');
    $('rlCancel').onclick = closeModal; check();
  }
  function saveEdit() {
    if (W.dirty) { toast('You changed the table. Press Check again first.', 'error'); return; }
    var comps = pickedComps(); if (!comps.length) { toast('Tick at least one competition.', 'error'); return; }
    if (!window.confirm('Save these changes? The cadet records for this platoon will be updated from the roll.')) return;
    if (window.showLoading) window.showLoading();
    api('rollEdit', [{ id: W.edit, competitions: comps, header: W.header, rows: W.rows.map(function (r) { return { n: r.n, dobIsDate: true, cells: r.cells }; }) }]).then(function (d) {
      if (window.hideLoading) window.hideLoading();
      if (!d.success) { toast(d.error, 'error'); if (d.issues) { W.issues = d.issues; W.counts = d.counts; W.ok = false; showResult(); } return; }
      closeModal(); toast('Roll updated' + (d.removedRegNos && d.removedRegNos.length ? '. Reg. numbers no longer on the roll: ' + d.removedRegNos.join(', ') + ' (their cadet records were kept)' : ''), 'success'); load();
    }).catch(err);
  }

  function decide(d) {
    api('rollDecide', [d]).then(function (r) {
      if (!r.success) { toast(r.error, 'error'); return; }
      closeModal();
      toast(r.status === 'APPROVED' ? 'Approved. The platoon is registered.' : r.status === 'REJECTED' ? 'Returned to the unit.' : 'Your approval is recorded. Waiting for ' + r.waiting + '.', 'success'); load();
    }).catch(err);
  }
})();
