/* RECON Competitions: Drill. The battalion competition squad score sheet (copied from the original judging app)
   and the platoon drill-team roll call that feeds the Shield. Battalion score max 140; drill team 1 point per cadet, max 30. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function cp() { return window.reconCp; }
  function esc(s) { return cp().esc(s); }
  function r2(x) { return Math.round(x * 100) / 100; }
  var dr = null, cur = '', tab = 'S', cmds = [];

  function openScore() {
    if (window.showLoading) window.showLoading();
    cp().api('compDrillGet').then(function (d) {
      if (window.hideLoading) window.hideLoading();
      if (!d.success) { cp().toast(d.error, 'error'); return; }
      dr = d; drawPick();
    }).catch(cp().err);
  }
  function drawPick(keep) {
    var sel = '<option value="">Select a battalion...</option>' + dr.battalions.map(function (b) {
      return '<option value="' + esc(b.name) + '"' + (b.name === keep ? ' selected' : '') + '>' + esc(b.name) + (b.mine ? ' (scored ' + b.mine.total + ' / ' + dr.rules.total + ')' : ' (not scored)') + '</option>';
    }).join('');
    cp().modal('Drill', (dr.status === 'FINAL' ? '<div class="rl-note rl-on"><i class="fas fa-lock"></i> This competition is finalised. Scores are locked.</div>' : '') +
      (dr.battalions.length ? '<div class="form-group"><label>Battalion Competition Squad</label><select id="drPick" class="form-control">' + sel + '</select></div><div id="drPane"><p class="muted">Pick the battalion. Score the squad on the <b>Drill score</b> tab and enter the platoon <b>Drill team roll call</b> on the other tab.</p></div>' : '<p>No battalions are set up yet. An Admin can add platoons under Import results &gt; Platoons.</p>'),
      '<button class="btn btn-outline" id="cpClose">Close</button>');
    $('cpClose').onclick = function () { cp().closeModal(); cp().reload(); };
    var pick = $('drPick'); if (pick) { pick.onchange = function () { cur = pick.value; tab = 'S'; drawForm(); }; if (keep) { cur = keep; drawForm(); } }
  }
  function field(id, label, max, val, note, dis, whole) {
    return '<label>' + label + ' <span class="muted">/ ' + max + '</span><input class="form-control" type="number" inputmode="decimal" min="0" max="' + max + '" step="' + (whole ? 1 : 0.5) + '" id="' + id + '" value="' + (val === undefined || val === null ? '' : esc(val)) + '"' + dis + '>' + (note ? '<small class="muted">' + note + '</small>' : '') + '</label>';
  }
  function yn(id, on, dis) {
    return '<select class="form-control" id="' + id + '"' + dis + '><option value="Y"' + (on ? ' selected' : '') + '>Yes</option><option value="N"' + (on ? '' : ' selected') + '>No</option></select>';
  }
  function initCmds(m) {
    var saved = (m && m.cmds) || [], out = [];
    dr.fixedCommanders.forEach(function (r) { var s = saved.filter(function (x) { return x.role === r; })[0]; out.push({ role: r, score: s ? s.score : '', fixed: true }); });
    saved.forEach(function (x) { if (dr.fixedCommanders.indexOf(x.role) < 0) out.push({ role: x.role, score: x.score, fixed: false }); });
    return out;
  }
  function syncCmds() { cmds.forEach(function (c, i) { var el = $('drC' + i); if (el) c.score = el.value; }); }
  function cmdHtml(dis) {
    return cmds.map(function (c, i) {
      return '<div class="cp-grid"><label>' + esc(c.role) + ' <span class="muted">/ ' + dr.rules.words + '</span><input class="form-control" type="number" inputmode="decimal" min="0" max="' + dr.rules.words + '" step="0.5" id="drC' + i + '" value="' + (c.score === '' || c.score === null || c.score === undefined ? '' : esc(c.score)) + '"' + dis + '></label>' +
        (c.fixed || dis ? '' : '<button type="button" class="btn btn-outline btn-sm" data-rm="' + i + '">Remove</button>') + '</div>';
    }).join('');
  }
  function drawForm() {
    var b = dr.battalions.filter(function (x) { return x.name === cur; })[0], pane = $('drPane'); if (!b) { pane.innerHTML = ''; return; }
    var m = b.mine, R = dr.rules, dis = dr.canScore ? '' : ' disabled'; cmds = initCmds(m);
    var team = b.platoons.map(function (p, i) {
      return '<div class="cp-grid"><label>' + esc(p.name) + '<input class="form-control" type="number" inputmode="numeric" min="0" step="1" id="drT' + i + '" value="' + (p.team ? esc(p.team.n) : '') + '"' + dis + '></label><span class="cp-sub" id="drTp' + i + '"></span></div>';
    }).join('') || '<p>No platoons are listed for this battalion.</p>';
    pane.innerHTML =
      '<div class="seg"><button class="btn ' + (tab === 'S' ? 'btn-primary' : 'btn-outline') + '" id="drTabS">Drill score</button> <button class="btn ' + (tab === 'T' ? 'btn-primary' : 'btn-outline') + '" id="drTabT">Drill team roll call</button></div>' +
      '<div id="drPS"' + (tab === 'S' ? '' : ' class="hide" style="display:none"') + '>' +
      (m ? '<p class="muted"><i class="fas fa-clock"></i> Last saved ' + esc(m.updated) + '</p>' : '') +
      '<div class="cp-rec"><h4>Attendance <span class="cp-sub"><span id="drAtt">-</span> / ' + R.att + '</span></h4><div class="cp-grid">' +
        field('drPresent', 'Cadets present', dr.strength, m ? m.present : '', 'Required strength ' + dr.strength + '. Half a point off for each cadet short.', dis, true) +
        '<label>Commanded by a Lt. Col. or Major?' + yn('drCmd', m ? m.cmdOk : true, dis) + '<small class="muted">If No, the battalion cannot participate.</small></label>' +
        '<label>Adult Warrant Officer Class Two reported?' + yn('drWo2', m ? m.wo2 : true, dis) + '<small class="muted">One point off if No.</small></label></div></div>' +
      '<div class="cp-rec"><h4>Inspection <span class="cp-sub"><span id="drInsp">-</span> / ' + R.insp + '</span></h4>' +
        '<label>Missing items of uniform (total)<input class="form-control" type="number" inputmode="numeric" min="0" step="1" id="drMissing" value="' + (m ? esc(m.missing) : '') + '"' + dis + '></label>' +
        '<small class="muted">A quarter point off for every missing item. Officers wear Sam Browne belts; brass runners allowed for ORs; no brassards.</small></div>' +
      '<div class="cp-rec"><h4>Drill sequence</h4><div class="cp-grid">' + field('drDrill', 'Foot and rifle drill', R.drill, m ? m.drill : '', 'Drill All Arms', dis) + field('drCompl', 'Completion of the entire sequence', R.compl, m ? m.compl : '', '', dis) + field('drSeq', 'Correct sequence', R.seq, m ? m.seq : '', '', dis) + '</div></div>' +
      '<div class="cp-rec"><h4>Words of command and squad control <span class="cp-sub"><span id="drWords">-</span> / ' + R.words + '</span></h4><p class="muted">Score each commander out of ' + R.words + '; the battalion gets the average. Leave a role blank if that officer was not on parade.</p><div id="drCmds">' + cmdHtml(dis) + '</div>' +
        (dr.canScore ? '<button type="button" class="btn btn-outline btn-sm" id="drAdd">Add company commander</button>' : '') + '</div>' +
      '<input class="form-control" id="drComment" placeholder="Comments (optional)" value="' + esc(m ? m.comment : '') + '"' + dis + '></div>' +
      '<div id="drPT"' + (tab === 'T' ? '' : ' style="display:none"') + '><p class="muted">Enter the number of cadets from each platoon confirmed at roll call as part of the battalion drill team. Each platoon earns one point per cadet, up to ' + R.teamCap + '. These points go to the Shield and do not count in the battalion drill score.</p>' + team + '</div>' +
      '<div class="cp-grand" id="drTot"></div>' + (dr.canScore ? '<button class="btn btn-primary" id="drSave"></button>' : '');
    $('drTabS').onclick = function () { syncCmds(); tab = 'S'; show(); }; $('drTabT').onclick = function () { tab = 'T'; show(); };
    function bind() {
      Array.prototype.forEach.call(pane.querySelectorAll('input,select'), function (el) { el.oninput = calc; el.onchange = calc; });
      Array.prototype.forEach.call(pane.querySelectorAll('[data-rm]'), function (x) { x.onclick = function () { syncCmds(); cmds.splice(+x.getAttribute('data-rm'), 1); $('drCmds').innerHTML = cmdHtml(dis); bind(); calc(); }; });
    }
    var add = $('drAdd'); if (add) add.onclick = function () { syncCmds(); var n = cmds.filter(function (c) { return !c.fixed; }).length + 1; cmds.push({ role: 'Company Commander ' + n, score: '', fixed: false }); $('drCmds').innerHTML = cmdHtml(dis); bind(); calc(); };
    function show() {
      $('drPS').style.display = tab === 'S' ? '' : 'none'; $('drPT').style.display = tab === 'T' ? '' : 'none';
      $('drTabS').className = 'btn ' + (tab === 'S' ? 'btn-primary' : 'btn-outline'); $('drTabT').className = 'btn ' + (tab === 'T' ? 'btn-primary' : 'btn-outline'); calc();
    }
    function state() {
      syncCmds();
      var num = function (id) { var el = $(id); return !el || el.value === '' ? null : Number(el.value); };
      var v = { present: num('drPresent'), missing: num('drMissing'), drill: num('drDrill'), compl: num('drCompl'), seq: num('drSeq') };
      var inR = function (x, lo, hi, whole) { return x !== null && !isNaN(x) && x >= lo && x <= hi && (!whole || x === Math.floor(x)); };
      var sc = cmds.filter(function (c) { return c.score !== '' && c.score !== null && c.score !== undefined; }), cok = sc.every(function (c) { var n = Number(c.score); return !isNaN(n) && n >= 0 && n <= R.words; });
      var ok = inR(v.present, 0, 300, true) && inR(v.missing, 0, 400, true) && inR(v.drill, 0, R.drill) && inR(v.compl, 0, R.compl) && inR(v.seq, 0, R.seq) && sc.length > 0 && cok;
      var wo2 = $('drWo2').value === 'Y';
      var att = inR(v.present, 0, 300) ? Math.max(0, R.att - 0.5 * Math.max(0, dr.strength - v.present) - (wo2 ? 0 : 1)) : null;
      var insp = inR(v.missing, 0, 400) ? Math.max(0, R.insp - 0.25 * v.missing) : null;
      var words = sc.length && cok ? sc.reduce(function (a, c) { return a + Number(c.score); }, 0) / sc.length : null;
      var total = (att || 0) + (insp || 0) + (inR(v.drill, 0, R.drill) ? v.drill : 0) + (words || 0) + (inR(v.compl, 0, R.compl) ? v.compl : 0) + (inR(v.seq, 0, R.seq) ? v.seq : 0);
      return { v: v, ok: ok, att: att, insp: insp, words: words, total: total };
    }
    function calc() {
      var sv = $('drSave');
      if (tab === 'S') {
        var s = state();
        $('drAtt').textContent = s.att === null ? '-' : r2(s.att); $('drInsp').textContent = s.insp === null ? '-' : r2(s.insp); $('drWords').textContent = s.words === null ? '-' : r2(s.words);
        $('drTot').innerHTML = 'Battalion score: <b>' + r2(s.total) + '</b> / ' + R.total + (s.ok ? '' : ' <span class="cp-sub">fill every box to save</span>');
        if (sv) { sv.disabled = !s.ok; sv.innerHTML = '<i class="fas fa-save"></i> Save drill score'; }
        return;
      }
      var tot = 0, ok = true, any = false;
      b.platoons.forEach(function (p, i) {
        var el = $('drT' + i), pt = $('drTp' + i); if (!el) return;
        if (el.value === '') { pt.textContent = ''; return; }
        var n = Number(el.value), bad = isNaN(n) || n < 0 || n > 200 || n !== Math.floor(n);
        if (bad) { ok = false; pt.textContent = 'whole number 0 to 200'; return; }
        any = true; tot += n; pt.textContent = Math.min(n, R.teamCap) + ' pt' + (Math.min(n, R.teamCap) === 1 ? '' : 's');
      });
      $('drTot').innerHTML = 'Cadets on the drill team: <b>' + tot + '</b>';
      if (sv) { sv.disabled = !ok || !any; sv.innerHTML = '<i class="fas fa-save"></i> Save drill team'; }
    }
    bind(); calc();
    var sv = $('drSave'); if (sv) sv.onclick = function () {
      sv.disabled = true;
      if (tab === 'S') {
        var s = state();
        cp().api('compDrillSave', [{ battalion: b.name, present: s.v.present, cmdOk: $('drCmd').value === 'Y', wo2: $('drWo2').value === 'Y', missing: s.v.missing, drill: s.v.drill, cmds: cmds.map(function (c) { return { role: c.role, score: c.score }; }), compl: s.v.compl, seq: s.v.seq, comment: $('drComment').value }]).then(function (x) {
          if (!x.success) { sv.disabled = false; cp().toast(x.error, 'error'); return; }
          b.mine = x.mine; cp().toast('Drill score saved', 'success'); drawPick(b.name);
        }).catch(function (e) { sv.disabled = false; cp().err(e); });
      } else {
        var counts = {}; b.platoons.forEach(function (p, i) { var el = $('drT' + i); if (el && el.value !== '') counts[p.id] = el.value; });
        cp().api('compDrillTeamSave', [{ battalion: b.name, counts: counts }]).then(function (x) {
          if (!x.success) { sv.disabled = false; cp().toast(x.error, 'error'); return; }
          b.platoons.forEach(function (p) { if (x.team[p.id]) p.team = x.team[p.id]; }); cp().toast('Drill team saved', 'success'); drawPick(b.name);
        }).catch(function (e) { sv.disabled = false; cp().err(e); });
      }
    };
  }

  // ---------- standings, finalise, PDFs ----------
  var f = function (x) { return x === null || x === undefined ? '-' : esc(x); };
  function inelNote(d) { var l = d.bnRows.filter(function (x) { return x.ineligible; }).map(function (x) { return esc(x.battalion); }); return l.length ? ' Not eligible (not commanded by a Lt. Col. or Major): ' + l.join(', ') + '.' : ''; }
  function openStand() {
    if (window.showLoading) window.showLoading();
    cp().api('compDrillStandings').then(function (d) {
      if (window.hideLoading) window.hideLoading(); if (!d.success) { cp().toast(d.error, 'error'); return; }
      var final = d.status === 'FINAL';
      var bn = d.bnRows.slice().sort(function (a, b) { return (a.ineligible ? 1 : 0) - (b.ineligible ? 1 : 0) || (a.rank || 999) - (b.rank || 999) || a.battalion.localeCompare(b.battalion); }).map(function (r) {
        return '<tr><td>' + (r.ineligible ? 'n/e' : (r.rank || '-')) + '</td><td><b>' + esc(r.battalion) + '</b></td><td>' + r.judges + (r.judges && !r.ready ? ' <span class="rl-badge rl-warn">needs ' + Math.max(1, d.min) + '</span>' : '') + '</td>' +
          (r.judges ? '<td>' + f(r.att) + '</td><td>' + f(r.insp) + '</td><td>' + f(r.drill) + '</td><td>' + f(r.words) + '</td><td>' + f(r.compl) + '</td><td>' + f(r.seq) + '</td><td><b>' + f(r.total) + '</b></td>' : '<td colspan="7"><span class="rl-badge rl-warn">not scored</span></td>') + '</tr>'; }).join('');
      var tm = d.rows.slice().sort(function (a, b) { return (a.rank || 999) - (b.rank || 999) || a.name.localeCompare(b.name); }).map(function (r) {
        return '<tr><td>' + (r.rank || '-') + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.battalion) + '</td>' + (r.entered ? '<td>' + r.n + '</td><td><b>' + r.total + '</b></td>' : '<td colspan="2"><span class="rl-badge rl-warn">no roll call</span></td>') + '</tr>'; }).join('');
      var body = '<h4>Battalion drill score</h4><p class="muted">Average of all judges, out of ' + d.battalionMax + '. Ranked on its own; it does not go to the Shield.' + inelNote(d) + '</p>' +
        '<div class="rl-scroll"><table class="data-table"><thead><tr><th>#</th><th>Battalion</th><th>Judges</th><th>Attend. /' + d.rules.att + '</th><th>Inspect. /' + d.rules.insp + '</th><th>Drill /' + d.rules.drill + '</th><th>Words /' + d.rules.words + '</th><th>Complete /' + d.rules.compl + '</th><th>Sequence /' + d.rules.seq + '</th><th>Total</th></tr></thead><tbody>' + (bn || '<tr><td colspan="10">No battalions.</td></tr>') + '</tbody></table></div>' +
        '<h4>Drill team points per platoon (Shield)</h4><p class="muted">One point per cadet on the drill team, maximum ' + d.max + '. Finalising locks scoring; then open <b>Import results</b> to preview and confirm it into the Shield.</p>' +
        '<div class="rl-scroll"><table class="data-table"><thead><tr><th>#</th><th>Platoon</th><th>Bn</th><th>Cadets</th><th>Points</th></tr></thead><tbody>' + (tm || '<tr><td colspan="5">No platoons are open for scoring.</td></tr>') + '</tbody></table></div>';
      cp().modal('Drill standings', body, '<button class="btn btn-outline" id="cpClose">Close</button><button class="btn btn-outline" id="drPdfS"><i class="fas fa-file-pdf"></i> Standings PDF</button><button class="btn btn-outline" id="drPdfD"><i class="fas fa-file-pdf"></i> Score sheets PDF</button>' +
        (final ? '<button class="btn btn-outline" id="cpRe"><i class="fas fa-unlock"></i> Reopen</button>' : '<button class="btn btn-primary" id="cpFin"><i class="fas fa-lock"></i> Finalise</button>'));
      $('cpClose').onclick = function () { cp().closeModal(); cp().reload(); };
      $('drPdfS').onclick = function () { cp().printDoc(standingsHtml(d)); };
      $('drPdfD').onclick = function () { cp().api('compDrillDetail').then(function (x) { if (!x.success) { cp().toast(x.error, 'error'); return; } cp().printDoc(sheetsHtml(x)); }).catch(cp().err); };
      if (final) $('cpRe').onclick = function () { if (!window.confirm('Reopen Drill? Judges can change scores until you finalise again.')) return; cp().api('compReopen', [{ competition: 'DRILL' }]).then(function (r) { if (!r.success) { cp().toast(r.error, 'error'); return; } cp().toast('Reopened', 'success'); cp().closeModal(); cp().reload(); }).catch(cp().err); };
      else $('cpFin').onclick = function () {
        if (!window.confirm('Finalise Drill? Scoring will be locked.')) return;
        cp().api('compFinalize', [{ competition: 'DRILL' }]).then(function (r) {
          if (!r.success) { cp().toast(r.error + (r.missing ? ' ' + r.missing.slice(0, 5).join('; ') : ''), 'error'); return; }
          cp().toast('Finalised. Now open Import results to send it to the Shield.', 'success'); cp().closeModal(); cp().reload();
        }).catch(cp().err);
      };
    }).catch(cp().err);
  }
  function standingsHtml(d) {
    var bn = d.bnRows.slice().sort(function (a, b) { return (a.ineligible ? 1 : 0) - (b.ineligible ? 1 : 0) || (a.rank || 999) - (b.rank || 999) || a.battalion.localeCompare(b.battalion); }).filter(function (r) { return r.judges; }).map(function (r) {
      return '<tr><td class="n">' + (r.ineligible ? 'n/e' : r.rank) + '</td><td class="l">' + esc(r.battalion) + '</td><td class="n">' + r.judges + '</td><td class="n">' + f(r.att) + '</td><td class="n">' + f(r.insp) + '</td><td class="n">' + f(r.drill) + '</td><td class="n">' + f(r.words) + '</td><td class="n">' + f(r.compl) + '</td><td class="n">' + f(r.seq) + '</td><td class="n"><b>' + f(r.total) + '</b></td></tr>'; }).join('');
    var tm = d.rows.filter(function (r) { return r.entered; }).sort(function (a, b) { return (a.rank || 999) - (b.rank || 999) || a.name.localeCompare(b.name); }).map(function (r) {
      return '<tr><td class="n">' + r.rank + '</td><td class="l">' + esc(r.name) + '</td><td class="l">' + esc(r.battalion) + '</td><td class="n">' + r.n + '</td><td class="n"><b>' + r.total + '</b></td></tr>'; }).join('');
    return cp().docHtml('Drill Competition: standings', cp().metaLine(d),
      '<h3>Battalion Competition Squad</h3><p>Average of the judges\' scores out of ' + d.battalionMax + '.' + inelNote(d).replace(/<[^>]+>/g, '') + ' n/e = not eligible.</p>' +
      '<table><thead><tr><th>#</th><th class="l">Battalion</th><th>Judges</th><th>Attend. /' + d.rules.att + '</th><th>Inspect. /' + d.rules.insp + '</th><th>Drill /' + d.rules.drill + '</th><th>Words /' + d.rules.words + '</th><th>Complete /' + d.rules.compl + '</th><th>Sequence /' + d.rules.seq + '</th><th>Total /' + d.battalionMax + '</th></tr></thead><tbody>' + (bn || '<tr><td colspan="10">No scores recorded yet.</td></tr>') + '</tbody></table>' +
      '<h3>Drill team points per platoon (Commandant\'s Inter-Platoon Efficiency Shield)</h3><p>One point per cadet confirmed at roll call as part of the battalion drill team, maximum ' + d.max + '. Reported separately from the battalion score.</p>' +
      '<table><thead><tr><th>#</th><th class="l">Platoon</th><th class="l">Bn</th><th>Cadets</th><th>Points</th></tr></thead><tbody>' + (tm || '<tr><td colspan="5">No roll call recorded yet.</td></tr>') + '</tbody></table>' +
      '<div class="sig"><div>Chief Judge: ______________________</div><div>Date: ______________</div></div>');
  }
  function sheetsHtml(x) {
    var by = {}; x.sheets.forEach(function (s) { (by[s.battalion] = by[s.battalion] || []).push(s); });
    var avg = {}; x.bnRows.forEach(function (r) { avg[r.battalion] = r; });
    var body = Object.keys(by).sort().map(function (bn) {
      var a = avg[bn] || {};
      var judges = by[bn].sort(function (p, q) { return p.judge.localeCompare(q.judge); }).map(function (s) {
        return '<h3>Judge: ' + esc(s.judge) + ' &mdash; total ' + esc(s.total) + ' / ' + x.rules.total + (s.updated ? ' &middot; saved ' + esc(s.updated) : '') + '</h3><table><thead><tr><th class="l">Item</th><th>Entered</th><th>Points</th></tr></thead><tbody>' +
          '<tr><td class="l">Attendance (cadets present; required ' + x.strength + ' at time of scoring)</td><td class="n">' + s.present + ' present' + (s.wo2 ? '' : ', no WO2') + '</td><td class="n">' + s.att + ' / ' + x.rules.att + '</td></tr>' +
          '<tr><td class="l">Commanded by a Lt. Col. or Major</td><td class="n">' + (s.cmdOk ? 'Yes' : 'No') + '</td><td class="n">-</td></tr>' +
          '<tr><td class="l">Inspection (missing items)</td><td class="n">' + s.missing + '</td><td class="n">' + s.insp + ' / ' + x.rules.insp + '</td></tr>' +
          '<tr><td class="l">Foot and rifle drill</td><td class="n">-</td><td class="n">' + s.drill + ' / ' + x.rules.drill + '</td></tr>' +
          '<tr><td class="l">Words of command: ' + s.cmds.map(function (c) { return esc(c.role) + ' ' + esc(c.score); }).join(', ') + '</td><td class="n">average</td><td class="n">' + s.words + ' / ' + x.rules.words + '</td></tr>' +
          '<tr><td class="l">Completion of the entire sequence</td><td class="n">-</td><td class="n">' + s.compl + ' / ' + x.rules.compl + '</td></tr>' +
          '<tr><td class="l">Correct sequence</td><td class="n">-</td><td class="n">' + s.seq + ' / ' + x.rules.seq + '</td></tr></tbody></table>' + (s.comment ? '<p>Comment: ' + esc(s.comment) + '</p>' : '');
      }).join('');
      return '<div class="pg"><h2 style="color:#154b12;margin:0 0 2px">' + esc(bn) + ' &mdash; Battalion Competition Squad</h2><p class="meta">Battalion score (average of judges): <b>' + f(a.total) + ' / ' + x.rules.total + '</b>' + (a.ineligible ? ' &middot; not eligible' : (a.rank ? ' &middot; Rank ' + a.rank : '')) + '</p>' + judges + '<div class="sig"><div>Judge: ______________________</div><div>Date: ______________</div></div></div>';
    }).join('');
    return cp().docHtml('Drill Competition: score sheets', cp().metaLine(x), body || '<p>No scores recorded yet.</p>');
  }
  window.reconDrScore = openScore; window.reconDrStand = openStand; window.reconDrPdfHtml = standingsHtml; window.reconDrSheetsHtml = sheetsHtml;
})();
