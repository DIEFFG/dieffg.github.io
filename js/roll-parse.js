/* RECON: reads a C19A Nominal Roll workbook in the browser (SheetJS) and returns plain rows. Nothing is uploaded as a file.
 * Works in the browser (window.ReconRollParse) and in Node (module.exports) so it can be tested. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ReconRollParse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var COLS = [
    ['parentEmail', /(e-?mail).*parent|parent.*(e-?mail)/i], ['cadetEmail', /(e-?mail).*cadet|cadet.*(e-?mail)/i],
    ['parentTel', /(tel|phone).*parent|parent.*(tel|phone)/i], ['cadetTel', /(tel|phone).*cadet|cadet.*(tel|phone)/i],
    ['parent', /^name of parent|^parent or guardian|^guardian/i], ['reg', /^reg/i], ['rank', /^rank/i], ['surname', /^surname/i], ['first', /^first/i],
    ['sex', /^(sex|gender)/i], ['dob', /^(date of birth|dob)/i], ['school', /^school att/i], ['address', /^address/i]
  ];
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function iso(y, m, d) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }

  function parse(XLSX, data) {
    var wb;
    try { wb = XLSX.read(data, { type: 'array', cellNF: true }); } catch (e) { return { ok: false, error: 'This file could not be read. Upload the Excel file (.xlsx) of the C19A Nominal Roll.' }; }
    var names = wb.SheetNames, pick = null;
    names.forEach(function (n) { var k = n.toLowerCase(); if (!pick && /c\s*19\s*a/.test(k) && /cadet/.test(k) && !/recruit/.test(k)) pick = n; });
    if (!pick) names.forEach(function (n) { var k = n.toLowerCase(); if (!pick && /c\s*19\s*a/.test(k) && !/recruit/.test(k)) pick = n; });
    if (!pick) return { ok: false, error: 'No "C19A (Cadets)" sheet was found. The sheets in this file are: ' + names.map(norm).join(', ') + '. Upload the C19A Nominal Roll workbook.' };
    var ws = wb.Sheets[pick], ref = ws['!ref']; if (!ref) return { ok: false, error: 'The "' + norm(pick) + '" sheet is empty.' };
    var range = XLSX.utils.decode_range(ref);
    function cell(r, c) { return ws[XLSX.utils.encode_cell({ r: r, c: c })]; }
    function isDateCell(x) { if (!x) return false; if (x.t === 'd') return true; if (x.t !== 'n' || !x.z) return false; try { return !!XLSX.SSF.is_date(x.z); } catch (e) { return false; } }
    function val(x) {
      if (!x || x.v === undefined || x.v === null) return { v: '', date: false };
      if (x.t === 'd') { var dt = x.v; return { v: iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()), date: true }; }
      if (isDateCell(x)) { var p = XLSX.SSF.parse_date_code(x.v); return { v: iso(p.y, p.m, p.d), date: true }; }
      return { v: x.t === 'n' ? String(x.v) : String(x.v), date: false };
    }
    // header block (first rows): label cell, value in the next non-empty cell to its right
    function labelValue(rx) {
      for (var r = range.s.r; r <= Math.min(range.e.r, 12); r++) for (var c = range.s.c; c <= range.e.c; c++) {
        var t = norm(val(cell(r, c)).v); if (!t || !rx.test(t)) continue;
        for (var k = c + 1; k <= Math.min(range.e.c, c + 4); k++) { var v = val(cell(r, k)); if (norm(v.v)) return v; }
      }
      return { v: '', date: false };
    }
    var head = {
      unitLine: norm(labelValue(/^unit$/i).v), school: norm(labelValue(/^school( no\.?)?$/i).v), date: labelValue(/^date$/i).v, term: norm(labelValue(/^term$/i).v),
      unitCommander: norm(labelValue(/^unit commander$/i).v), bnCommander: norm(labelValue(/^battalion commander$/i).v)
    };
    // find the column-header row
    var hr = -1;
    for (var r = range.s.r; r <= Math.min(range.e.r, 20) && hr < 0; r++) {
      var seen = {}; for (var c = range.s.c; c <= range.e.c; c++) { var t = norm(val(cell(r, c)).v); if (/^reg/i.test(t)) seen.reg = 1; if (/^surname/i.test(t)) seen.sn = 1; }
      if (seen.reg && seen.sn) hr = r;
    }
    if (hr < 0) return { ok: false, error: 'The column headings (Reg. No., Rank, Surname ...) were not found on the "' + norm(pick) + '" sheet. Upload the unedited C19A template.' };
    var map = {}, serCol = -1;
    for (var c2 = range.s.c; c2 <= range.e.c; c2++) {
      var h = norm(val(cell(hr, c2)).v); if (!h) continue;
      if (/^ser/i.test(h)) { serCol = c2; continue; }
      for (var i = 0; i < COLS.length; i++) { if (COLS[i][1].test(h)) { if (map[COLS[i][0]] === undefined) map[COLS[i][0]] = c2; break; } }   // first match wins: the second Reg./Rank/Name block is ignored
    }
    var missing = ['reg', 'rank', 'surname', 'first', 'sex', 'dob', 'school', 'parent', 'parentTel'].filter(function (k) { return map[k] === undefined; });
    if (missing.length) return { ok: false, error: 'These columns were not found: ' + missing.join(', ') + '. Upload the unedited C19A template.' };
    var rows = [], keys = Object.keys(map);
    for (var rr = hr + 1; rr <= range.e.r; rr++) {
      var hasSer = serCol >= 0 && norm(val(cell(rr, serCol)).v) !== '' && /^\d+$/.test(norm(val(cell(rr, serCol)).v));
      var regV = val(cell(rr, map.reg)).v;
      if (!hasSer && !norm(regV)) continue;               // blank space and the signature block carry neither a serial number nor a Reg. No.
      var cells = {}, any = false, dobIsDate = false;
      keys.forEach(function (k) { var v = val(cell(rr, map[k])); cells[k] = v.v; if (norm(v.v)) any = true; if (k === 'dob') dobIsDate = v.date; });
      if (!any) continue;                                  // numbered but empty line
      rows.push({ n: rr + 1, dobIsDate: dobIsDate, cells: cells });
    }
    var ignored = names.filter(function (n) { return n !== pick; }).map(norm);
    return { ok: true, sheetName: norm(pick), header: head, rows: rows, ignoredSheets: ignored, recruitsIgnored: names.some(function (n) { return /recruit/i.test(n); }) };
  }
  return { parse: parse, colName: colName };
});
