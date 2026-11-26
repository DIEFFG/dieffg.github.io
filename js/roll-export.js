/* RECON: download a nominal roll as a C19A-style Excel file or a printable PDF page, with the TTCF logo. */
(function () {
  'use strict';
  var COLS = [['reg', 'Reg. No.', 11], ['rank', 'Rank', 8], ['surname', 'Surname', 18], ['first', 'First Name', 16], ['sex', 'Sex', 8], ['dob', 'Date of Birth', 13], ['school', 'School Attending', 24],
              ['parent', 'Parent / Guardian', 20], ['address', 'Address', 28], ['parentEmail', 'Parent Email', 24], ['cadetEmail', 'Cadet Email', 24], ['parentTel', 'Parent Tel.', 13], ['cadetTel', 'Cadet Tel.', 13]];
  var LOGO = 'img/icon-192.png', EXCEL = 'js/vendor/exceljs.bare.min.js', loading = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nice(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return String(iso || ''); return m[3] + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + '-' + m[1]; }
  function safe(s) { return String(s || 'roll').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, ''); }
  function fileBase(d) { var r = d.roll; return 'C19A-' + safe(r.unit) + '-P' + safe(r.platoonNumber) + '-' + r.year; }
  function head(d) {
    var r = d.roll;
    return [['Unit / School', r.unit], ['Platoon', r.platoonNumber], ['Battalion', r.battalion], ['Term', r.term], ['Date of roll', nice(r.rollDate)], ['Cadets', r.cadetCount],
            ['Unit Commander', r.unitCommander], ['Battalion Commander', r.bnCommander], ['Competitions', d.competitionsText || ''], ['Status', String(r.status || '').toLowerCase()]];
  }
  function loadScript(src) {
    if (window.ExcelJS) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { loading = null; rej(new Error('The Excel tool could not load. Check your connection and try again.')); }; document.head.appendChild(s); });
    return loading;
  }
  function logoBase64() {
    return fetch(LOGO).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s);
    });
  }

  // ---------- Excel ----------
  function xlsx(d) {
    return Promise.all([loadScript(EXCEL), logoBase64().catch(function () { return ''; })]).then(function (x) {
      var wb = new window.ExcelJS.Workbook(); wb.creator = 'RECON'; wb.created = new Date();
      var ws = wb.addWorksheet('C19A (Cadets)', { pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
        views: [{ showGridLines: false }] });
      var n = COLS.length + 1, green = 'FF154B12', gold = 'FFC9A227';
      ws.getColumn(1).width = 5; COLS.forEach(function (c, i) { ws.getColumn(i + 2).width = c[2]; });
      ws.mergeCells(1, 3, 1, n); ws.getCell(1, 3).value = 'TRINIDAD AND TOBAGO CADET FORCE'; ws.getCell(1, 3).font = { bold: true, size: 18, color: { argb: green } }; ws.getCell(1, 3).alignment = { vertical: 'middle' };
      ws.mergeCells(2, 3, 2, n); ws.getCell(2, 3).value = 'NOMINAL ROLL (FORM C19A)'; ws.getCell(2, 3).font = { bold: true, size: 13 }; ws.getCell(2, 3).alignment = { vertical: 'middle' };
      ws.getRow(1).height = 30; ws.getRow(2).height = 22; ws.getRow(3).height = 8;
      if (x[1]) { var img = wb.addImage({ base64: x[1], extension: 'png' }); ws.addImage(img, { tl: { col: 0.15, row: 0.1 }, ext: { width: 62, height: 62 } }); }
      var h = head(d), row = 4;
      for (var i = 0; i < h.length; i += 2) {
        [0, 1].forEach(function (k) {
          var it = h[i + k]; if (!it) return; var c0 = k === 0 ? 1 : 8;
          ws.mergeCells(row, c0, row, c0 + 1); ws.getCell(row, c0).value = it[0]; ws.getCell(row, c0).font = { bold: true, color: { argb: green } };
          ws.mergeCells(row, c0 + 2, row, c0 + 5); ws.getCell(row, c0 + 2).value = it[1];
        });
        row++;
      }
      row++;
      var hr = ws.getRow(row); hr.height = 22;
      ws.getCell(row, 1).value = 'No.'; COLS.forEach(function (c, i) { ws.getCell(row, i + 2).value = c[1]; });
      for (var c = 1; c <= n; c++) { var cell = ws.getCell(row, c); cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; }
      ws.views = [{ showGridLines: false, state: 'frozen', ySplit: row }];
      var first = row + 1;
      d.rows.forEach(function (r, ri) {
        var rr = row + 1 + ri; ws.getCell(rr, 1).value = r.n;
        COLS.forEach(function (c, i) { var v = r[c[0]]; ws.getCell(rr, i + 2).value = c[0] === 'dob' ? nice(v) : (v === undefined || v === null ? '' : String(v)); });
        for (var c = 1; c <= n; c++) { var cell = ws.getCell(rr, c); cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }; cell.alignment = { vertical: 'middle', wrapText: c === 10 || c === 8 }; if (ri % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F7F1' } }; }
        ws.getCell(rr, 2).numFmt = '@';
      });
      ws.pageSetup.printTitlesRow = row + ':' + row;
      var end = row + d.rows.length + 3;
      ws.mergeCells(end, 2, end, 5); ws.getCell(end, 2).value = 'Unit Commander: ______________________'; ws.mergeCells(end, 8, end, 11); ws.getCell(end, 8).value = 'Battalion Commander: ______________________';
      ws.mergeCells(end + 2, 2, end + 2, n); ws.getCell(end + 2, 2).value = 'Downloaded from RECON on ' + nice(new Date().toISOString()) + '. Contains personal information: handle with care.'; ws.getCell(end + 2, 2).font = { italic: true, size: 9, color: { argb: 'FF666666' } };
      return wb.xlsx.writeBuffer().then(function (buf) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = fileBase(d) + '.xlsx';
        document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); return fileBase(d) + '.xlsx';
      });
    });
  }

  // ---------- PDF (print view: choose "Save as PDF") ----------
  function html(d) {
    var h = head(d), logo = new URL(LOGO, document.baseURI).href;
    var meta = '<table class="meta">' + (function () { var o = ''; for (var i = 0; i < h.length; i += 2) o += '<tr><th>' + esc(h[i][0]) + '</th><td>' + esc(h[i][1]) + '</td><th>' + (h[i + 1] ? esc(h[i + 1][0]) : '') + '</th><td>' + (h[i + 1] ? esc(h[i + 1][1]) : '') + '</td></tr>'; return o; })() + '</table>';
    var th = '<th>No.</th>' + COLS.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('');
    var body = d.rows.map(function (r) { return '<tr><td>' + esc(r.n) + '</td>' + COLS.map(function (c) { return '<td>' + esc(c[0] === 'dob' ? nice(r[c[0]]) : r[c[0]]) + '</td>'; }).join('') + '</tr>'; }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(fileBase(d)) + '</title><style>' +
      '@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:8.5px;margin:0}' +
      '.top{display:flex;align-items:center;gap:12px;border-bottom:3px solid #c9a227;padding-bottom:6px;margin-bottom:8px}.top img{width:62px;height:62px}' +
      '.top h1{margin:0;font-size:18px;color:#154b12}.top h2{margin:2px 0 0;font-size:13px}' +
      '.meta{border-collapse:collapse;width:100%;margin-bottom:8px;font-size:9.5px}.meta th{text-align:left;color:#154b12;width:15%;padding:2px 6px}.meta td{padding:2px 6px;border-bottom:1px solid #ddd;width:35%}' +
      'table.roll{border-collapse:collapse;width:100%;table-layout:auto}table.roll th{background:#154b12;color:#fff;padding:4px 3px;border:1px solid #333;font-size:8px}' +
      'table.roll td{border:1px solid #999;padding:3px;vertical-align:top;word-break:break-word}table.roll tr:nth-child(even) td{background:#f3f7f1}thead{display:table-header-group}tr{page-break-inside:avoid}' +
      '.sig{display:flex;justify-content:space-between;margin-top:30px;font-size:10px}.note{margin-top:14px;font-size:8px;color:#666;font-style:italic}' +
      '</style></head><body><div class="top"><img src="' + esc(logo) + '" alt="TTCF"><div><h1>TRINIDAD AND TOBAGO CADET FORCE</h1><h2>NOMINAL ROLL (FORM C19A)</h2></div></div>' + meta +
      '<table class="roll"><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table>' +
      '<div class="sig"><div>Unit Commander: ______________________</div><div>Battalion Commander: ______________________</div></div>' +
      '<div class="note">Printed from RECON on ' + esc(nice(new Date().toISOString())) + '. Contains personal information: handle with care.</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},400)}<\/script></body></html>';
  }
  function pdf(d) {
    var w = window.open('', '_blank');
    if (!w) return Promise.reject(new Error('Your browser blocked the print window. Allow pop-ups for this site and try again.'));
    w.document.open(); w.document.write(html(d)); w.document.close();
    return Promise.resolve('print');
  }
  window.ReconRollExport = { xlsx: xlsx, pdf: pdf, html: html, fileBase: fileBase };
})();
