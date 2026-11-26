/* RECON Competitions: Military Knowledge. Draw one cadet per platoon, five questions at 10 points each, judges mark Correct / Incorrect. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function cp() { return window.reconCp; }
  function esc(s) { return cp().esc(s); }
  var mk = null, cur = '';

  // ---------- draw and score ----------
  function openScore() {
    if (window.showLoading) window.showLoading();
    cp().api('compMkGet').then(function (d) {
      if (window.hideLoading) window.hideLoading();
      if (!d.success) { cp().toast(d.error, 'error'); return; }
      mk = d; drawPick();
    }).catch(cp().err);
  }
  function statusOf(p) {
    if (!p.drawn) return 'no cadet drawn';
    if (p.mine && p.mine.results.every(function (x) { return x; })) return 'scored';
    if (p.mine) return 'part scored';
    return 'cadet drawn';
  }
  function drawPick(keep) {
    var byBn = {}; mk.platoons.forEach(function (p) { (byBn[p.battalion || 'Other'] = byBn[p.battalion || 'Other'] || []).push(p); });
    var sel = '<option value="">Select a platoon...</option>' + Object.keys(byBn).sort().map(function (b) {
      return '<optgroup label="' + esc(b) + '">' + byBn[b].map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === keep ? ' selected' : '') + '>' + esc(p.name) + ' (' + statusOf(p) + ')</option>'; }).join('') + '</optgroup>';
    }).join('');
    cp().modal('Military Knowledge', (mk.status === 'FINAL' ? '<div class="rl-note rl-on"><i class="fas fa-lock"></i> This competition is finalised. Drawing and scoring are locked.</div>' : '') +
      (mk.platoons.length ? '<div class="form-group"><label>Platoon</label><select id="mkPick" class="form-control">' + sel + '</select></div><div id="mkPane"><p class="muted">Pick the platoon, draw a cadet, then mark the five questions Correct or Incorrect (' + mk.points + ' points each, ' + mk.max + ' in total).</p></div>' : '<p>No platoons are set up yet. An Admin can add them under Import results > Platoons.</p>'),
      '<button class="btn btn-outline" id="cpClose">Close</button>');
    $('cpClose').onclick = function () { cp().closeModal(); cp().reload(); };
    var pick = $('mkPick'); if (pick) { pick.onchange = function () { cur = pick.value; drawPane(); }; if (keep) { cur = keep; drawPane(); } }
  }
  function find(id) { return mk.platoons.filter(function (p) { return p.id === id; })[0]; }
  function refresh(then) {
    cp().api('compMkGet').then(function (d) { if (d.success) { mk = d; } then && then(); }).catch(cp().err);
  }
  function drawPane() {
    var p = find(cur), pane = $('mkPane'); if (!p) { pane.innerHTML = ''; return; }
    if (!p.drawn) {
      pane.innerHTML = (mk.canDraw ? '<div class="cp-rec"><p>No cadet has been drawn for <b>' + esc(p.name) + '</b> yet. The cadet is picked at random from the platoon\'s nominal roll and stays the same for every judge.</p><button class="btn btn-primary" id="mkDraw"><i class="fas fa-dice"></i> Draw a cadet</button></div>' : '<p class="muted">No cadet drawn yet.</p>');
      var b = $('mkDraw'); if (b) b.onclick = function () { doDraw(p, ''); };
      return;
    }
    var res = (p.mine && p.mine.results) || ['', '', '', '', ''];
    var h = '<div class="cp-rec"><h4><i class="fas fa-user"></i> ' + esc(p.cadet) + '</h4><p class="muted">' + (p.pool ? 'Drawn at random from a roll of ' + p.pool + '.' : 'Name entered by the judge.') + (p.absent ? ' Replaced ' + p.absent + ' absent cadet' + (p.absent > 1 ? 's' : '') + '.' : '') + (p.mine && p.mine.updated ? ' Last saved ' + esc(p.mine.updated) + '.' : '') + '</p></div>';
    p.questions.forEach(function (q, i) {
      h += '<div class="cp-rec"><h4>Q' + (i + 1) + ' <span class="cp-sub">' + esc(q.topic) + '</span></h4><p><b>' + esc(q.question) + '</b></p><p class="muted">Expected answer: ' + esc(q.answer) + '</p>' +
        (mk.canScore ? '<div class="mk-res"><label><input type="radio" name="mkq' + i + '" value="correct"' + (res[i] === 'correct' ? ' checked' : '') + '> Correct</label> <label><input type="radio" name="mkq' + i + '" value="incorrect"' + (res[i] === 'incorrect' ? ' checked' : '') + '> Incorrect</label></div>' : '') + '</div>';
    });
    if (mk.canScore) h += '<input class="form-control" id="mkComment" placeholder="Comment (optional)" value="' + esc((p.mine && p.mine.comment) || '') + '"><div class="cp-grand">Your total: <b id="mkTot">0</b> / ' + mk.max + '</div><button class="btn btn-primary" id="mkSave"><i class="fas fa-save"></i> Save scores</button> ';
    if (mk.canDraw && !(p.mine && p.mine.results.some(function (x) { return x; }))) h += '<button class="btn btn-outline" id="mkRep"><i class="fas fa-user-slash"></i> Cadet absent: draw another</button>';
    pane.innerHTML = h;
    function recalc() { var n = 0; p.questions.forEach(function (q, i) { var el = document.querySelector('input[name="mkq' + i + '"]:checked'); if (el && el.value === 'correct') n += mk.points; }); var t = $('mkTot'); if (t) t.textContent = n; }
    Array.prototype.forEach.call(pane.querySelectorAll('input[type=radio]'), function (r) { r.onchange = recalc; }); recalc();
    var s = $('mkSave'); if (s) s.onclick = function () {
      var results = p.questions.map(function (q, i) { var el = document.querySelector('input[name="mkq' + i + '"]:checked'); return el ? el.value : ''; });
      s.disabled = true;
      cp().api('compMkSave', [{ platoonId: p.id, results: results, comment: $('mkComment').value }]).then(function (r) {
        s.disabled = false; if (!r.success) { cp().toast(r.error, 'error'); return; }
        p.mine = r.mine; cp().toast('Scores saved', 'success'); drawPick(p.id);
      }).catch(function (e) { s.disabled = false; cp().err(e); });
    };
    var rp = $('mkRep'); if (rp) rp.onclick = function () {
      var reason = window.prompt('Why is ' + p.cadet + ' being replaced? (for example: absent)', 'Absent'); if (reason === null) return;
      doReplace(p, reason, '');
    };
  }
  function askName(p, msg, cb) {
    var n = window.prompt(msg, ''); if (n === null || !String(n).trim()) return; cb(String(n).trim());
  }
  function doDraw(p, manual) {
    cp().api('compMkDraw', [{ platoonId: p.id, manual: manual }]).then(function (r) {
      if (r.needName) { askName(p, r.error, function (n) { doDraw(p, n); }); return; }
      if (!r.success) { cp().toast(r.error, 'error'); return; }
      refresh(function () { drawPick(p.id); cp().toast(r.already ? 'A cadet was already drawn' : 'Cadet drawn', 'success'); });
    }).catch(cp().err);
  }
  function doReplace(p, reason, manual) {
    cp().api('compMkReplace', [{ platoonId: p.id, reason: reason, manual: manual }]).then(function (r) {
      if (r.needName) { askName(p, r.error, function (n) { doReplace(p, reason, n); }); return; }
      if (!r.success) { cp().toast(r.error, 'error'); return; }
      refresh(function () { drawPick(p.id); cp().toast('New cadet drawn', 'success'); });
    }).catch(cp().err);
  }

  // ---------- standings, finalise, PDFs ----------
  function openStand() {
    if (window.showLoading) window.showLoading();
    cp().api('compMkStandings').then(function (d) {
      if (window.hideLoading) window.hideLoading(); if (!d.success) { cp().toast(d.error, 'error'); return; }
      var final = d.status === 'FINAL';
      var rows = d.rows.slice().sort(function (a, b) { return (a.rank || 999) - (b.rank || 999) || a.name.localeCompare(b.name); }).map(function (r) {
        return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + (r.drawn ? esc(r.cadet) : '<span class="rl-badge rl-warn">not drawn</span>') + '</td><td>' + r.judgesDone + ' of ' + r.judgesStarted + (r.ready ? '' : ' <span class="rl-badge rl-warn">needs ' + Math.max(1, d.min) + '</span>') + '</td><td><b>' + (r.total === null ? '-' : esc(r.total)) + '</b></td><td>' + (r.rank || '-') + '</td></tr>'; }).join('');
      var body = '<p class="muted">One cadet per platoon answers five questions. A platoon\'s score is the average of its judges\' totals out of ' + d.max + ' (a judge counts once all five questions are marked). Finalising locks drawing and scoring; then open <b>Import results</b> to preview and confirm it into the Shield.</p>' +
        '<div class="rl-scroll"><table class="data-table"><thead><tr><th>Platoon</th><th>Cadet</th><th>Judges done</th><th>Total /' + d.max + '</th><th>Rank</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">No platoons are open for scoring.</td></tr>') + '</tbody></table></div>';
      cp().modal('Military Knowledge standings', body, '<button class="btn btn-outline" id="cpClose">Close</button><button class="btn btn-outline" id="mkPdfS"><i class="fas fa-file-pdf"></i> Standings PDF</button><button class="btn btn-outline" id="mkPdfC"><i class="fas fa-file-pdf"></i> Cadet scorecards PDF</button>' +
        (final ? '<button class="btn btn-outline" id="cpRe"><i class="fas fa-unlock"></i> Reopen</button>' : '<button class="btn btn-primary" id="cpFin"><i class="fas fa-lock"></i> Finalise</button>'));
      $('cpClose').onclick = function () { cp().closeModal(); cp().reload(); };
      $('mkPdfS').onclick = function () { cp().printDoc(standingsHtml(d)); };
      $('mkPdfC').onclick = function () { cp().api('compMkDetail').then(function (x) { if (!x.success) { cp().toast(x.error, 'error'); return; } if (!x.cards.length) { cp().toast('No cadets have been drawn yet, so there are no scorecards.', 'error'); return; } cp().printDoc(cardsHtml(x)); }).catch(cp().err); };
      if (final) $('cpRe').onclick = function () { if (!window.confirm('Reopen Military Knowledge? Judges can change scores until you finalise again.')) return; cp().api('compReopen', [{ competition: 'MILKNOW' }]).then(function (r) { if (!r.success) { cp().toast(r.error, 'error'); return; } cp().toast('Reopened', 'success'); cp().closeModal(); cp().reload(); }).catch(cp().err); };
      else $('cpFin').onclick = function () {
        if (!window.confirm('Finalise Military Knowledge? Drawing and scoring will be locked.')) return;
        cp().api('compFinalize', [{ competition: 'MILKNOW' }]).then(function (r) {
          if (!r.success) { cp().toast(r.error + (r.missing ? ' ' + r.missing.slice(0, 5).join('; ') : ''), 'error'); return; }
          cp().toast('Finalised. Now open Import results to send it to the Shield.', 'success'); cp().closeModal(); cp().reload();
        }).catch(cp().err);
      };
    }).catch(cp().err);
  }
  function standingsHtml(d) {
    var rows = d.rows.slice().sort(function (a, b) { return (a.rank || 999) - (b.rank || 999) || a.name.localeCompare(b.name); }).map(function (r) {
      return '<tr><td class="n">' + (r.rank || '-') + '</td><td class="l">' + esc(r.name) + '</td><td class="l">' + esc(r.battalion) + '</td><td class="l">' + esc(r.cadet) + '</td><td class="n">' + r.judgesDone + '</td><td class="n"><b>' + (r.total === null ? '-' : esc(r.total)) + '</b></td></tr>'; }).join('');
    return cp().docHtml('Military Knowledge Competition: standings', cp().metaLine(d),
      '<p>Average of the judges\' scores out of ' + d.max + '. Five questions per cadet, 10 points for each correct answer.</p><table><thead><tr><th>#</th><th class="l">Platoon</th><th class="l">Bn</th><th class="l">Cadet</th><th>Judges</th><th>Total /' + d.max + '</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6">No scores recorded yet.</td></tr>') + '</tbody></table><div class="sig"><div>Chief Judge: ______________________</div><div>Date: ______________</div></div>');
  }
  function cardsHtml(x) {
    var cards = x.cards.map(function (c, k) {
      var js = c.judges, avg = js.length ? Math.round(js.reduce(function (a, j) { return a + j.total; }, 0) / js.length * 10) / 10 : null;
      var head = '<tr><th>#</th><th class="l">Topic</th><th class="l">Question asked</th><th class="l">Expected answer</th>' + (js.length ? js.map(function (j) { return '<th>' + esc(j.judge) + '</th>'; }).join('') : '<th>Result</th>') + '</tr>';
      var body = c.questions.map(function (q, n) {
        var cells = js.length ? js.map(function (j) { var r = String(j.results[n] || ''); return '<td class="n" style="text-align:center;color:' + (r === 'Correct' ? '#1b6b3a' : r === 'Incorrect' ? '#b3261e' : '#000') + ';font-weight:bold">' + (r || '-') + '</td>'; }).join('') : '<td style="text-align:center">-</td>';
        return '<tr><td style="text-align:center">' + (n + 1) + '</td><td class="l">' + esc(q.topic) + '</td><td class="l">' + esc(q.question) + '</td><td class="l">' + esc(q.answer) + '</td>' + cells + '</tr>';
      }).join('');
      var totals = js.length ? js.map(function (j) { return '<td style="text-align:center"><b>' + j.total + ' / ' + x.max + '</b></td>'; }).join('') : '<td style="text-align:center">-</td>';
      var comments = js.filter(function (j) { return j.comment; }).map(function (j) { return '<li><b>' + esc(j.judge) + ':</b> ' + esc(j.comment) + '</li>'; }).join('');
      var sig = (js.length ? js.map(function (j) { return j.judge; }) : ['', '']).map(function (j) { return '<div>Judge: ' + (esc(j) || '______________________') + ' &nbsp; Signature: ______________________</div>'; }).join('');
      return '<div class="pg"><h3 style="font-size:13px">Military Knowledge Competition: Cadet Scorecard</h3>' +
        '<table><tr><td class="l"><b>Platoon:</b> ' + esc(c.platoonName) + '</td><td class="l"><b>Battalion:</b> ' + esc(c.battalion) + '</td></tr>' +
        '<tr><td class="l"><b>Cadet:</b> ' + esc(c.cadet) + '</td><td class="l"><b>Drawn:</b> ' + esc(c.drawnAt) + ' by ' + esc(c.drawnBy) + '</td></tr>' +
        '<tr><td class="l"><b>Selected:</b> ' + (c.pool ? 'randomly from a roll of ' + c.pool : 'name entered by judge') + '</td><td class="l">' + (c.absent.length ? '<b>Replaced (not present):</b> ' + c.absent.map(esc).join(', ') : '&nbsp;') + '</td></tr></table>' +
        '<table><thead>' + head + '</thead><tbody>' + body + '<tr><td colspan="4" class="n"><b>Score (' + x.points + ' points per correct answer)</b></td>' + totals + '</tr></tbody></table>' +
        '<p style="font-size:12px">' + (avg === null ? 'Not yet scored.' : (js.length > 1 ? 'Average of ' + js.length + ' judges: ' : 'Score: ') + '<b>' + avg + ' / ' + x.max + '</b>') + '</p>' +
        (comments ? '<p><b>Comments</b></p><ul>' + comments + '</ul>' : '') +
        (js.length ? '<p class="note">Last saved ' + esc(js.map(function (j) { return j.updated; }).filter(Boolean).sort(function (a, b) { return new Date(b) - new Date(a); })[0] || '') + '</p>' : '') +
        '<div class="sig" style="flex-direction:column;gap:14px">' + sig + '</div></div>';
    }).join('');
    return cp().docHtml('Military Knowledge Competition: cadet scorecards', cp().metaLine(x), cards);
  }

  // ---------- question bank (Admin) ----------
  var bank = [];
  function openBank() {
    if (window.showLoading) window.showLoading();
    cp().api('compMkBankGet').then(function (d) {
      if (window.hideLoading) window.hideLoading(); if (!d.success) { cp().toast(d.error, 'error'); return; }
      bank = d.questions; drawBank('');
    }).catch(cp().err);
  }
  function drawBank(q) {
    var f = String(q || '').toLowerCase(), list = bank.filter(function (x) { return !f || (x.topic + ' ' + x.question + ' ' + x.answer + ' ' + x.id).toLowerCase().indexOf(f) >= 0; });
    var rows = list.slice(0, 200).map(function (x) {
      return '<tr' + (x.active ? '' : ' style="opacity:.5"') + '><td>' + esc(x.id) + '</td><td>' + esc(x.topic) + '</td><td>' + esc(x.question) + '</td><td>' + esc(x.answer) + '</td><td>' + (x.active ? 'Yes' : 'No') + '</td><td><button class="btn btn-outline btn-sm" data-eq="' + esc(x.id) + '">Edit</button></td></tr>'; }).join('');
    cp().modal('Question bank (' + bank.filter(function (x) { return x.active; }).length + ' active of ' + bank.length + ')',
      '<p class="muted">Each cadet is asked five questions drawn from the active ones: never a question that cadet already had, with the fewest repeats and topics varied.</p><input id="mkSearch" class="form-control" placeholder="Search questions" value="' + esc(q || '') + '">' +
      '<div class="rl-scroll" style="max-height:340px;overflow:auto"><table class="data-table"><thead><tr><th>ID</th><th>Topic</th><th>Question</th><th>Expected answer</th><th>Active</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6">No questions match.</td></tr>') + '</tbody></table></div>' + (list.length > 200 ? '<p class="muted">Showing the first 200. Search to narrow.</p>' : ''),
      '<button class="btn btn-outline" id="cpClose">Close</button><button class="btn btn-outline" id="mkSeed">Add missing starter questions</button><button class="btn btn-primary" id="mkNew"><i class="fas fa-plus"></i> Add question</button>');
    $('cpClose').onclick = function () { cp().closeModal(); };
    var s = $('mkSearch'); s.oninput = function () { var pos = s.selectionStart; drawBank(s.value); var n = $('mkSearch'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } };
    $('mkNew').onclick = function () { editQ(null); };
    $('mkSeed').onclick = function () { cp().api('compMkBankSeed').then(function (r) { cp().toast(r.success ? (r.added ? r.added + ' starter questions added' : 'Nothing missing') : r.error, r.success ? 'success' : 'error'); openBank(); }).catch(cp().err); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-eq]'), function (b) { b.onclick = function () { editQ(bank.filter(function (x) { return x.id === b.getAttribute('data-eq'); })[0]); }; });
  }
  function editQ(x) {
    x = x || { id: '', topic: '', question: '', answer: '', active: true };
    var topics = {}; bank.forEach(function (b) { topics[b.topic] = 1; });
    cp().modal(x.id ? 'Edit question ' + x.id : 'Add question',
      '<div class="form-group"><label>Topic</label><input id="mqT" list="mqTopics" class="form-control" value="' + esc(x.topic) + '"><datalist id="mqTopics">' + Object.keys(topics).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></div>' +
      '<div class="form-group"><label>Question</label><textarea id="mqQ" class="form-control" rows="3">' + esc(x.question) + '</textarea></div>' +
      '<div class="form-group"><label>Expected answer</label><textarea id="mqA" class="form-control" rows="3">' + esc(x.answer) + '</textarea></div>' +
      '<label><input type="checkbox" id="mqOn"' + (x.active ? ' checked' : '') + '> Active (can be asked)</label>',
      '<button class="btn btn-outline" id="mqBack">Back</button><button class="btn btn-primary" id="mqSave"><i class="fas fa-save"></i> Save</button>');
    $('mqBack').onclick = function () { drawBank(''); };
    $('mqSave').onclick = function () {
      cp().api('compMkBankSave', [{ id: x.id, topic: $('mqT').value, question: $('mqQ').value, answer: $('mqA').value, active: $('mqOn').checked }]).then(function (r) {
        if (!r.success) { cp().toast(r.error, 'error'); return; } cp().toast('Saved', 'success'); openBank();
      }).catch(cp().err);
    };
  }

  window.reconMkScore = openScore; window.reconMkStand = openStand; window.reconMkBank = openBank;
  window.reconMkStandingsHtml = standingsHtml; window.reconMkCardsHtml = cardsHtml;
})();
