/* RECON Competitions: Orienteering. One result per platoon team: markers (6 x 8), time (30), grid references (17), team equipment (5) = 100. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function cp() { return window.reconCp; }
  function esc(s) { return cp().esc(s); }
  var or = null, cur = '';

  // The same arithmetic as the server (the server is the authority on save).
  function secs(t) { var m = String(t || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0)) : null; }
  function hms(s) { if (s === null || s === undefined) return '-'; var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h + ':' + ('0' + m).slice(-2) + ':' + ('0' + x).slice(-2); }
  function timeScore(s, r) { if (s === null) return 0; return Math.max(0, r.timeMax - Math.floor(Math.max(0, s - r.baselineSec) / r.stepSec)); }

  function openScore() {
    if (window.showLoading) window.showLoading();
    cp().api('compOrientGet').then(function (d) {
      if (window.hideLoading) window.hideLoading();
      if (!d.success) { cp().toast(d.error, 'error'); return; }
      or = d; drawPick();
    }).catch(cp().err);
  }
  function drawPick(keep) {
    var byBn = {}; or.platoons.forEach(function (p) { (byBn[p.battalion || 'Other'] = byBn[p.battalion || 'Other'] || []).push(p); });
    var sel = '<option value="">Select a team...</option>' + Object.keys(byBn).sort().map(function (b) {
      return '<optgroup label="' + esc(b) + '">' + byBn[b].map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === keep ? ' selected' : '') + '>' + esc(p.name) + (p.result ? ' (' + p.result.total + ' / ' + or.max + ')' : ' (no result)') + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    cp().modal('Orienteering', (or.status === 'FINAL' ? '<div class="rl-note rl-on"><i class="fas fa-lock"></i> This competition is finalised. Results are locked.</div>' : '') +
      (or.platoons.length ? '<div class="form-group"><label>Platoon team</label><select id="orPick" class="form-control">' + sel + '</select></div><div id="orPane"><p class="muted">Pick the team and enter its result. Time points are worked out for you: full ' + or.rules.timeMax + ' if the course is finished within 1:15:00, then 1 point off for every full 5 minutes over.</p></div>' : '<p>No platoons are set up yet. An Admin can add them under Import results > Platoons.</p>'),
      '<button class="btn btn-outline" id="cpClose">Close</button>');
    $('cpClose').onclick = function () { cp().closeModal(); cp().reload(); };
    var pick = $('orPick'); if (pick) { pick.onchange = function () { cur = pick.value; drawForm(); }; if (keep) { cur = keep; drawForm(); } }
  }
  function drawForm() {
    var p = or.platoons.filter(function (x) { return x.id === cur; })[0], pane = $('orPane'); if (!p) { pane.innerHTML = ''; return; }
    var r = p.result || { markers: 0, start: '', finish: '', dnf: false, grid: 0, equipment: 0, note: '' }, R = or.rules, dis = or.canScore ? '' : ' disabled';
    var mkOpts = ''; for (var i = 0; i <= R.maxMarkers; i++) mkOpts += '<option value="' + i + '"' + (i === r.markers ? ' selected' : '') + '>' + i + ' (' + (i * R.markerPts) + ' points)</option>';
    pane.innerHTML =
      (p.result ? '<p class="muted"><i class="fas fa-clock"></i> Last saved ' + esc(p.result.updated) + (p.result.by ? ' by ' + esc(p.result.by) : '') + '</p>' : '') +
      '<div class="cp-rec"><h4>Control markers <span class="cp-sub">' + R.maxMarkers + ' markers at ' + R.markerPts + ' points</span></h4><select id="orMk" class="form-control"' + dis + '>' + mkOpts + '</select></div>' +
      '<div class="cp-rec"><h4>Time <span class="cp-sub">out of ' + R.timeMax + '</span></h4><div class="cp-grid"><label>Start<input type="time" step="1" id="orStart" class="form-control" value="' + esc(r.start) + '"' + dis + '></label><label>Finish<input type="time" step="1" id="orFinish" class="form-control" value="' + esc(r.finish) + '"' + dis + '></label></div>' +
      '<label><input type="checkbox" id="orDnf"' + (r.dnf ? ' checked' : '') + dis + '> Did not finish (no time points)</label><p id="orTime" class="muted"></p></div>' +
      '<div class="cp-rec"><div class="cp-grid"><label>Grid references found <span class="muted">/' + R.maxGrid + ', 1 point each</span><input type="number" min="0" max="' + R.maxGrid + '" step="1" id="orGrid" class="form-control" value="' + esc(r.grid) + '"' + dis + '></label>' +
      '<label>Team equipment <span class="muted">/' + R.maxEquip + '</span><input type="number" min="0" max="' + R.maxEquip + '" step="0.5" id="orEq" class="form-control" value="' + esc(r.equipment) + '"' + dis + '></label></div></div>' +
      '<input class="form-control" id="orNote" placeholder="Note (optional)" value="' + esc(r.note || '') + '"' + dis + '>' +
      '<div class="cp-grand" id="orTot"></div>' + (or.canScore ? '<button class="btn btn-primary" id="orSave"><i class="fas fa-save"></i> Save result</button>' : '');
    function calc() {
      var dnf = $('orDnf').checked, a = secs($('orStart').value), b = secs($('orFinish').value), tot = null, ts = 0;
      if (!dnf && a !== null && b !== null && b > a) { tot = b - a; ts = timeScore(tot, R); }
      $('orTime').textContent = dnf ? 'Did not finish: 0 time points.' : (tot === null ? 'Enter the start and finish times.' : 'Total time ' + hms(tot) + ': ' + ts + ' of ' + R.timeMax + ' time points.');
      var mk = +$('orMk').value * R.markerPts, g = Math.min(+$('orGrid').value || 0, R.maxGrid), e = Math.min(+$('orEq').value || 0, R.maxEquip);
      $('orTot').innerHTML = 'Total: <b>' + (mk + ts + g + e) + '</b> / ' + or.max + ' <span class="cp-sub">(markers ' + mk + ' + time ' + ts + ' + grid ' + g + ' + equipment ' + e + ')</span>';
    }
    Array.prototype.forEach.call(pane.querySelectorAll('input,select'), function (el) { el.oninput = calc; el.onchange = calc; }); calc();
    var s = $('orSave'); if (s) s.onclick = function () {
      s.disabled = true;
      cp().api('compOrientSave', [{ platoonId: p.id, markers: $('orMk').value, start: $('orStart').value, finish: $('orFinish').value, dnf: $('orDnf').checked, grid: $('orGrid').value, equipment: $('orEq').value, note: $('orNote').value }]).then(function (x) {
        s.disabled = false; if (!x.success) { cp().toast(x.error, 'error'); return; }
        p.result = x.result; cp().toast('Result saved', 'success'); drawPick(p.id);
      }).catch(function (e) { s.disabled = false; cp().err(e); });
    };
  }

  // ---------- standings, finalise, PDF ----------
  function openStand() {
    if (window.showLoading) window.showLoading();
    cp().api('compOrientStandings').then(function (d) {
      if (window.hideLoading) window.hideLoading(); if (!d.success) { cp().toast(d.error, 'error'); return; }
      var final = d.status === 'FINAL';
      var rows = d.rows.slice().sort(function (a, b) { return (a.rank || 999) - (b.rank || 999) || a.name.localeCompare(b.name); }).map(function (r) {
        return '<tr><td>' + (r.rank || '-') + '</td><td><b>' + esc(r.name) + '</b></td>' + (r.entered ? '<td>' + r.markers + ' (' + r.markersScore + ')</td><td>' + (r.dnf ? 'DNF' : hms(r.secs)) + ' (' + r.timeScore + ')</td><td>' + r.grid + '</td><td>' + r.equipment + '</td><td><b>' + esc(r.total) + '</b></td>' : '<td colspan="5"><span class="rl-badge rl-warn">no result yet</span></td>') + '</tr>'; }).join('');
      var body = '<p class="muted">Markers ' + d.rules.maxMarkers + ' x ' + d.rules.markerPts + ', time ' + d.rules.timeMax + ', grid references ' + d.rules.maxGrid + ', equipment ' + d.rules.maxEquip + ' = ' + d.max + '. ' + (d.tieBreak === 'TIME' ? 'Ties: the faster time ranks higher.' : 'Ties: equal totals share the rank.') + ' Finalising locks results; then open <b>Import results</b> to preview and confirm it into the Shield.</p>' +
        '<div class="rl-scroll"><table class="data-table"><thead><tr><th>#</th><th>Platoon team</th><th>Markers</th><th>Time (points)</th><th>Grid /' + d.rules.maxGrid + '</th><th>Equip /' + d.rules.maxEquip + '</th><th>Total /' + d.max + '</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7">No platoons are open for scoring.</td></tr>') + '</tbody></table></div>';
      cp().modal('Orienteering standings', body, '<button class="btn btn-outline" id="cpClose">Close</button><button class="btn btn-outline" id="orPdf"><i class="fas fa-file-pdf"></i> Results PDF</button>' +
        (final ? '<button class="btn btn-outline" id="cpRe"><i class="fas fa-unlock"></i> Reopen</button>' : '<button class="btn btn-primary" id="cpFin"><i class="fas fa-lock"></i> Finalise</button>'));
      $('cpClose').onclick = function () { cp().closeModal(); cp().reload(); };
      $('orPdf').onclick = function () { cp().printDoc(pdfHtml(d)); };
      if (final) $('cpRe').onclick = function () { if (!window.confirm('Reopen Orienteering? Judges can change results until you finalise again.')) return; cp().api('compReopen', [{ competition: 'ORIENT' }]).then(function (r) { if (!r.success) { cp().toast(r.error, 'error'); return; } cp().toast('Reopened', 'success'); cp().closeModal(); cp().reload(); }).catch(cp().err); };
      else $('cpFin').onclick = function () {
        if (!window.confirm('Finalise Orienteering? Results will be locked.')) return;
        cp().api('compFinalize', [{ competition: 'ORIENT' }]).then(function (r) {
          if (!r.success) { cp().toast(r.error + (r.missing ? ' ' + r.missing.slice(0, 5).join('; ') : ''), 'error'); return; }
          cp().toast('Finalised. Now open Import results to send it to the Shield.', 'success'); cp().closeModal(); cp().reload();
        }).catch(cp().err);
      };
    }).catch(cp().err);
  }
  function pdfHtml(d) {
    var rows = d.rows.slice().sort(function (a, b) { return (a.rank || 999) - (b.rank || 999) || a.name.localeCompare(b.name); }).map(function (r) {
      return '<tr><td class="n">' + (r.rank || '-') + '</td><td class="l">' + esc(r.name) + '</td><td class="l">' + esc(r.battalion) + '</td>' + (r.entered ?
        '<td class="n">' + r.markers + ' / ' + r.markersScore + '</td><td class="n">' + esc(r.start) + '</td><td class="n">' + esc(r.finish) + '</td><td class="n">' + (r.dnf ? 'DNF' : hms(r.secs)) + '</td><td class="n">' + r.timeScore + '</td><td class="n">' + r.grid + '</td><td class="n">' + r.equipment + '</td><td class="n"><b>' + esc(r.total) + '</b></td>'
        : '<td colspan="8" class="l">no result recorded</td>') + '</tr>'; }).join('');
    return cp().docHtml('Orienteering Competition: results', cp().metaLine(d),
      '<p>Markers ' + d.rules.maxMarkers + ' x ' + d.rules.markerPts + ' = ' + (d.rules.maxMarkers * d.rules.markerPts) + '. Time out of ' + d.rules.timeMax + ': full marks within 1:15:00, then 1 point off for every full 5 minutes over. Grid references out of ' + d.rules.maxGrid + ' (1 point each). Team equipment out of ' + d.rules.maxEquip + '. Total ' + d.max + '. ' + (d.tieBreak === 'TIME' ? 'Ties are broken by the faster time.' : 'Equal totals share the rank.') + '</p>' +
      '<table><thead><tr><th>#</th><th class="l">Platoon team</th><th class="l">Bn</th><th>Markers (pts)</th><th>Start</th><th>Finish</th><th>Time</th><th>Time pts</th><th>Grid</th><th>Equip</th><th>Total /' + d.max + '</th></tr></thead><tbody>' + (rows || '<tr><td colspan="11">No results recorded yet.</td></tr>') + '</tbody></table>' +
      '<div class="sig"><div>Chief Judge: ______________________</div><div>Date: ______________</div></div>');
  }

  window.reconOrScore = openScore; window.reconOrStand = openStand; window.reconOrPdfHtml = pdfHtml;
})();
