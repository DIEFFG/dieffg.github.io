/* Page logic (from the original single-file site, patched for the installable app). */
var currentUser = null;
    let currentDate = new Date();
    var allMembers = [];
    var allEvents = [];
    var allSermons = [];
    var allNotices = [];
    var allPrayers = [];
    var allUsers = [];
    let currentSermonFilter = 'all';
    var authToken = null; var allMessages = []; var allRsvps = [];
    const isHttp = u => { u = String(u || '').trim().toLowerCase(); return u.indexOf('http:' + String.fromCharCode(47, 47)) === 0 || u.indexOf('https:' + String.fromCharCode(47, 47)) === 0; };
    const store = (function () { const map = { authToken: 'token', currentUser: 'user' }, S = window.ChurchApi ? ChurchApi.store : { get() { return null; }, set() {}, del() {} };
      return { get(k) { return S.get(map[k] || k); }, set(k, v) { S.set(map[k] || k, v); }, del(k) { S.del(map[k] || k); } }; })();
    const MINISTRIES = ['Worship & Music', "Children's Ministry", 'Youth Ministry', 'Welcome & Ushering', 'Prayer & Intercession', 'Media & Technology', 'Outreach & Missions', 'Hospitality & Kitchen', 'Teaching & Bible Study', 'Administration & Support', 'Not sure yet - help me find my place'];
    const KIN_RELS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'];
    function ministryChanged(cb) {
      if (!cb.checked) return;
      const notSure = MINISTRIES[MINISTRIES.length - 1];
      cb.closest('[data-ministry]').querySelectorAll('input').forEach(i => { if (i !== cb && (cb.value === notSure || i.value === notSure)) i.checked = false; });
    }
    function getMinistries(id) { return [...document.querySelectorAll('#' + id + ' input:checked')].map(i => i.value).join('; '); }
    function setMinistries(id, val) { const set = String(val || '').split(/;\s*/).filter(Boolean); document.querySelectorAll('#' + id + ' input').forEach(i => i.checked = set.includes(i.value)); }
    function toggleJoined() {
      const ex = document.getElementById('memberType').value === 'existing', j = document.getElementById('memberJoined');
      document.getElementById('joinedGroup').style.display = ex ? 'block' : 'none'; j.required = ex; if (!ex) j.value = '';
    }
    function toggleKin() {
      const v = document.getElementById('memberFamily').value, on = v === 'Married' || v === 'Family';
      document.getElementById('kinSection').style.display = on ? 'block' : 'none';
      if (!on) document.getElementById('kinRows').innerHTML = '';
    }
    function addKinRow() {
      const r = document.createElement('div'); r.className = 'kin-row'; r.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr) auto;gap:8px;margin-bottom:10px;padding:12px;background:#fff;border-radius:12px;border:1px solid var(--gray-200)';
      r.innerHTML = `<input class="form-input" placeholder="First name" data-k="firstName" required><input class="form-input" placeholder="Surname (if different)" data-k="lastName"><select class="form-input" data-k="relationship">${KIN_RELS.map(x => `<option>${x}</option>`).join('')}</select><input class="form-input" type="date" data-k="dateOfBirth" title="Date of birth (optional)"><input class="form-input" type="email" placeholder="Email (optional)" data-k="email" maxlength="150"><input class="form-input" placeholder="Occupation (optional)" data-k="occupation" maxlength="100"><button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()" title="Remove" style="grid-row:1/span 2;grid-column:4;align-self:center">✕</button>`;
      document.getElementById('kinRows').appendChild(r);
    }
    function collectKin() { return [...document.querySelectorAll('#kinRows .kin-row')].map(r => { const o = {}; r.querySelectorAll('[data-k]').forEach(el => o[el.dataset.k] = el.value.trim()); return o; }).filter(o => o.firstName); }
    function familyLabel(m) { if (!m.householdid) return '-'; return esc(m.relationship || 'Family') + ' · ' + allMembers.filter(x => x.householdid === m.householdid).length + ' in household'; }
    function viewHousehold(hid) {
      const fam = allMembers.filter(m => m.householdid === hid).sort((a, b) => (b.relationship === 'Head of household') - (a.relationship === 'Head of household'));
      viewItem('Household (' + fam.length + ')', '<div style="display:flex;flex-direction:column;gap:10px">' + fam.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--purple-subtle);border-radius:12px"><div><strong>${esc(m.firstname)} ${esc(m.lastname)}</strong><div style="font-size:12px;color:var(--gray-500)">${esc(m.email || '')}${m.occupation ? (m.email ? ' · ' : '') + esc(m.occupation) : ''}${m.dateofbirth ? ' · Born ' + formatDate(m.dateofbirth) : ''}</div></div><span class="status-badge normal">${esc(m.relationship || 'Family')}</span></div>`).join('') + '</div>');
    }
    const t12 = v => /^\d{1,2}:\d{2}$/.test(String(v || '').trim()) ? formatTime(String(v).trim()) : v;
    let eventFlyer = ''; let driveTarget = null; let photoKey = null;
    function showFlyerPreview() {
      document.getElementById('flyerPreview').innerHTML = eventFlyer ? `<div style="display:flex;gap:12px;align-items:center;margin-top:10px"><img src="${esc(eventFlyer)}" alt="Flyer preview" style="height:96px;border-radius:8px;border:1px solid var(--gray-200)"><button type="button" class="btn btn-ghost btn-sm" onclick="eventFlyer='';showFlyerPreview()">Remove flyer</button></div>` : '';
    }
    function handleFlyerPick(inp) {
      const f = inp.files[0]; if (!f) return;
      if (f.type.indexOf('image') !== 0) { showToast('Please choose an image file', 'error'); inp.value = ''; return; }
      const rd = new FileReader(), img = new Image();
      rd.onload = () => { img.onload = () => {
        const s = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL('image/jpeg', 0.85);
        if (!isBackendAvailable()) { eventFlyer = data; showFlyerPreview(); return; }
        showToast('Uploading flyer...', 'info');
        google.script.run.withSuccessHandler(function(r) { if (r.success) { eventFlyer = r.url; showFlyerPreview(); showToast('Flyer uploaded', 'success'); } else showToast(r.message, 'error'); })
          .withFailureHandler(function(er) { showToast('Upload failed: ' + er.message, 'error'); }).uploadFlyer(authToken, data, f.name);
      }; img.src = rd.result; };
      rd.readAsDataURL(f);
    }
    function openDrivePicker(target) {
      driveTarget = target || null;
      if (!isBackendAvailable()) { showToast('Google Drive is available once the app is deployed. Use "Upload from device" for now.', 'info'); return; }
      openModal('driveModal'); loadDriveFiles();
    }
    function loadDriveFiles() {
      const g = document.getElementById('driveGrid'), msg = (t, c) => '<p style="grid-column:1/-1;color:' + c + '">' + esc(t) + '</p>';
      g.innerHTML = msg('Loading from Google Drive...', 'var(--gray-500)');
      google.script.run.withSuccessHandler(function(r) {
        if (!r.success) { g.innerHTML = msg(r.message, 'var(--error)'); return; }
        document.getElementById('driveFolderLink').href = r.folderUrl;
        g.innerHTML = r.files.length ? r.files.map(f => `<div onclick="setDriveFlyer('${f.id}')" title="${esc(f.name)}" style="cursor:pointer;border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;background:var(--purple-subtle)"><div style="height:120px;display:flex;align-items:center;justify-content:center">${f.thumb ? `<img src="${f.thumb}" alt="" style="max-width:100%;max-height:100%">` : '<i data-lucide="image"></i>'}</div><div style="padding:6px 8px;font-size:11px;color:var(--gray-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div></div>`).join('') : msg('No images in the folder yet. Open the folder, add your flyer, then tap Refresh.', 'var(--gray-500)');
        lucide.createIcons();
      }).withFailureHandler(function(er) { g.innerHTML = msg(er.message, 'var(--error)'); }).listDriveFlyers(authToken);
    }
    function setDriveFlyer(ref) {
      showToast('Getting flyer from Google Drive...', 'info');
      google.script.run.withSuccessHandler(function(r) {
        if (r.success) { if (driveTarget) { setLeaderPhoto(driveTarget, r.url.replace('w1200', 'w500')); showToast('Photo added. Tap Save Changes to publish it.', 'success'); } else { eventFlyer = r.url; showFlyerPreview(); showToast('Flyer added', 'success'); } closeModal('driveModal'); } else showToast(r.message, 'error');
      }).withFailureHandler(function(er) { showToast('Error: ' + er.message, 'error'); }).useDriveFlyer(authToken, ref);
    }
    function useDriveLink() { const v = document.getElementById('driveLink').value.trim(); if (v) setDriveFlyer(v); }
    function pickPhotoFile(k) { photoKey = k; const f = document.getElementById('leaderPhotoFile'); f.value = ''; f.click(); }
    function setLeaderPhoto(k, url) {
      const inp = document.querySelector('#settingsFields [data-key="' + k + '"]'); if (!inp) return;
      inp.value = url || '';
      document.getElementById('photoPrev_' + k).innerHTML = url ? `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover">` : '<i data-lucide="user"></i>';
      lucide.createIcons();
    }
    function handlePhotoPick(inp) {
      const f = inp.files[0], k = photoKey; if (!f || !k) return;
      if (f.type.indexOf('image') !== 0) { showToast('Please choose an image file', 'error'); return; }
      const rd = new FileReader(), img = new Image();
      rd.onload = () => { img.onload = () => {
        const side = Math.min(img.width, img.height), sx = (img.width - side) / 2, sy = (img.height - side) * 0.2, out = Math.min(480, side);
        const c = document.createElement('canvas'); c.width = c.height = out;
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out, out); ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
        const data = c.toDataURL('image/jpeg', 0.85);
        if (!isBackendAvailable()) { setLeaderPhoto(k, data); return; }
        showToast('Uploading photo...', 'info');
        google.script.run.withSuccessHandler(function(r) { if (r.success) { setLeaderPhoto(k, r.url.replace('w1200', 'w500')); showToast('Photo added. Tap Save Changes to publish it.', 'success'); } else showToast(r.message, 'error'); })
          .withFailureHandler(function(er) { showToast('Upload failed: ' + er.message, 'error'); }).uploadFlyer(authToken, data, 'leader-photo');
      }; img.src = rd.result; };
      rd.readAsDataURL(f);
    }

    // Member prompt, sign-in and flyer download now live in ui.js (emailed-code sign in).
    let jpMode = 'visit', jpPendingEvent = null;

    function rsvpCount(id) {
      const n = allRsvps.filter(r => r.eventid === id).length;
      return n ? `<button class="btn btn-sm btn-outline-purple" onclick="viewRsvps('${id}')" title="See who is coming"><i data-lucide="users"></i> ${n}</button>` : '<span style="color:var(--gray-400)">0</span>';
    }
    function viewRsvps(eventId) {
      const ev = allEvents.find(e => e.id === eventId), list = allRsvps.filter(r => r.eventid === eventId);
      viewItem('RSVPs - ' + (ev ? ev.title : ''), `<p style="color:var(--gray-500);font-size:13px;margin-bottom:12px">${list.length} ${list.length === 1 ? 'person' : 'people'} coming</p>` + (list.length ? list.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;background:var(--purple-subtle);border-radius:10px;margin-bottom:8px"><div><strong>${esc(r.name)}</strong><div style="font-size:12px;color:var(--gray-500)">${esc(r.email)}${r.phone ? ' &middot; ' + esc(r.phone) : ''} &middot; ${formatDate(r.date)}</div></div><button class="table-action-btn delete" title="Remove this RSVP" onclick="removeRsvp('${r.id}','${eventId}')"><i data-lucide="trash-2"></i></button></div>`).join('') : '<p>No RSVPs yet.</p>'));
    }
    function removeRsvp(id, eventId) {
      const done = function() { allRsvps = allRsvps.filter(r => r.id !== id); loadAdminEvents(); viewRsvps(eventId); showToast('RSVP removed', 'success'); };
      if (!isBackendAvailable()) { done(); return; }
      google.script.run.withSuccessHandler(function(r) { r.success ? done() : showToast(r.message, 'error'); }).withFailureHandler(function(er) { showToast('Error: ' + er.message, 'error'); }).deleteRsvp(authToken, id);
    }
    function renderFlyerStrips() {
      const today = localDate();
      const list = allEvents.filter(e => e.flyer && e.active === 'TRUE' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
      const html = list.map(e => `<figure class="flyer-card" onclick="openFlyer('${e.id}')"><img src="${esc(e.flyer)}" alt="${esc(e.title)} flyer" loading="lazy"><figcaption><strong>${esc(e.title)}</strong><span>${formatDate(e.date)}${e.time ? ' · ' + formatTime(e.time) : ''}</span></figcaption></figure>`).join('');
      document.querySelectorAll('.flyer-strip').forEach(el => { el.innerHTML = html; el.closest('[data-flyers]').style.display = list.length ? '' : 'none'; });
    }
    function openFlyer(id) {
      const e = allEvents.find(x => x.id === id); if (!e) return;
      const when = formatDate(e.date) + (e.time ? ' · ' + formatTime(e.time) : '') + (e.location ? ' · ' + esc(e.location) : '');
      const desc = e.description ? '<p style="margin-top:8px;color:var(--gray-600)">' + esc(e.description) + '</p>' : '';
      const rsvp = '<button class="btn btn-purple btn-sm" style="margin-top:14px" onclick="closeModal(\'viewModal\');openRSVPModal(\'' + e.id + '\')">RSVP</button>';
      const join = isHttp(e.link) ? ' <a class="btn btn-gold btn-sm" style="margin-top:14px" href="' + esc(e.link) + '" target="_blank" rel="noopener"><i data-lucide="video"></i> Join Online</a>' : '';
      const dl = ' <button class="btn btn-outline-purple btn-sm" style="margin-top:14px" onclick="downloadFlyer(\'' + e.id + '\')"><i data-lucide="download"></i> Download Flyer</button>';
      viewItem(e.title, '<img src="' + esc(e.flyer) + '" alt="' + esc(e.title) + ' flyer" style="width:100%;border-radius:12px;margin-bottom:14px"><p style="color:var(--gray-600)">' + when + '</p>' + desc + rsvp + dl + join);
    }
    function ytId(u) {
      u = String(u || '');
      if (u.indexOf('youtube.com') < 0 && u.indexOf('youtu.be') < 0) return null;
      const keys = ['?v=', '&v=', 'youtu.be/', '/embed/', '/shorts/', '/live/'];
      for (const k of keys) {
        const i = u.indexOf(k);
        if (i >= 0) { const id = u.substr(i + k.length, 11); if (id.length === 11 && /^[\w-]{11}$/.test(id)) return id; }
      }
      return null;
    }
    function initFormExtras() {
      document.querySelectorAll('[data-ministry]').forEach(box => { box.innerHTML = MINISTRIES.map(m => `<label class="ministry-opt"><input type="checkbox" value="${esc(m)}" onchange="ministryChanged(this)"><span>${esc(m)}</span></label>`).join(''); });
      ['memberJoined', 'editMemberJoined'].forEach(id => { const e = document.getElementById(id); if (e) e.max = localDate(); });
      document.querySelectorAll('input[type="time"]').forEach(inp => {
        const mk = items => { const s = document.createElement('select'); s.className = 'form-input'; s.style.cssText = 'padding:14px 10px;flex:1'; items.forEach(([v, t]) => s.add(new Option(t, v))); return s; };
        const hh = mk([['', 'Hr'], ...Array.from({length: 12}, (_, i) => [String(i + 1), String(i + 1)])]);
        const mm = mk([['', 'Min'], ...Array.from({length: 12}, (_, i) => { const v = String(i * 5).padStart(2, '0'); return [v, v]; })]);
        const pp = mk([['AM', 'AM'], ['PM', 'PM']]);
        const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;gap:8px'; wrap.append(hh, mm, pp);
        inp.style.display = 'none'; inp.required = false; inp.after(wrap);
        Object.defineProperty(inp, 'value', {configurable: true,
          get() { if (!hh.value) return ''; let h = +hh.value % 12; if (pp.value === 'PM') h += 12; return String(h).padStart(2, '0') + ':' + (mm.value || '00'); },
          set(v) {
            const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
            if (!m) { hh.value = ''; mm.value = ''; pp.value = 'AM'; return; }
            const h = +m[1]; pp.value = h >= 12 ? 'PM' : 'AM'; hh.value = String(h % 12 || 12);
            if (![...mm.options].some(o => o.value === m[2])) mm.add(new Option(m[2], m[2]));
            mm.value = m[2];
          }});
      });
    }
    const SETTING_DEFAULTS = {churchName:'The Christian Sanctuary',churchTagline:'A Place of Worship',churchAddress:'123 Faith Street, City, State 12345',churchPhone:'(555) 123-4567',churchEmail:'info@christiansanctuary.org',officeHours:'Mon - Fri: 9AM - 5PM',
      svc1Day:'Sunday',svc1Name:'Morning Worship',svc1Time:'9:00 AM & 11:00 AM',svc2Day:'Wednesday',svc2Name:'Bible Study',svc2Time:'7:00 PM',svc3Day:'Friday',svc3Name:'Youth Night',svc3Time:'6:30 PM',
      leader1Name:'Pastor John Smith',leader1Role:'Senior Pastor',leader2Name:'Rev. Mary Johnson',leader2Role:'Associate Pastor',leader3Name:'Elder David Wilson',leader3Role:'Worship Leader',leader4Name:'Sister Grace Lee',leader4Role:'Youth Director',
      aboutStory:'The Christian Sanctuary was founded with a simple mission: to create a welcoming space where people from all walks of life can encounter God\'s love and grow in their faith journey.\n\nOur doors are always open to anyone seeking spiritual growth and meaningful connection.'};
    const SETTING_GROUPS = [['Church Information',['churchName','churchTagline','churchAddress','churchPhone','churchEmail','officeHours','rsvpNotifyEmail']],['Service Times',[1,2,3].flatMap(i=>['svc'+i+'Day','svc'+i+'Name','svc'+i+'Time','svc'+i+'Link'])],['Leadership',[1,2,3,4].flatMap(i=>['leader'+i+'Name','leader'+i+'Role','leader'+i+'Photo'])],['About Us',['aboutStory']]];
    const SETTING_LABEL = k => k === 'rsvpNotifyEmail' ? 'Default RSVP notification email (receives every RSVP, along with the event coordinator)' : k.replace(/^svc(\d)/,'Service $1 ').replace(/^leader(\d)/,'Leader $1 ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/ Link$/,' Online Link (optional)').replace(/^./,c=>c.toUpperCase());
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function localDate(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function parseLocal(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(s); }
    
    const demoData = {
      events: [
        { id: '1', title: 'Sunday Worship Service', description: 'Join us for our weekly worship', date: '2026-01-18', time: '09:00', endtime: '11:00', location: 'Main Sanctuary', category: 'Worship', active: 'TRUE' },
        { id: '2', title: 'Wednesday Bible Study', description: 'In-depth study of Romans', date: '2026-01-21', time: '19:00', endtime: '20:30', location: 'Fellowship Hall', category: 'Bible Study', active: 'TRUE' },
        { id: '3', title: 'Youth Night', description: 'Games, worship, and teaching for teens', date: '2026-01-23', time: '18:30', endtime: '21:00', location: 'Youth Center', category: 'Youth', active: 'TRUE' },
        { id: '4', title: 'Community Outreach', description: 'Serving at the local food bank', date: '2026-01-25', time: '09:00', endtime: '13:00', location: 'City Food Bank', category: 'Outreach', active: 'TRUE' },
        { id: '5', title: 'Prayer Breakfast', description: 'Morning prayer and fellowship', date: '2026-01-26', time: '07:00', endtime: '08:30', location: 'Fellowship Hall', category: 'Fellowship', active: 'TRUE' }
      ],
      sermons: [
        { id: '1', title: 'Walking in Faith', speaker: 'Pastor John Smith', date: '2026-01-12', scripture: 'Hebrews 11:1-6', videourl: '', category: 'Sunday Service', active: 'TRUE', notes: 'A powerful message about trusting God in uncertain times.' },
        { id: '2', title: 'The Power of Prayer', speaker: 'Rev. Mary Johnson', date: '2026-01-05', scripture: 'James 5:13-18', videourl: '', category: 'Sunday Service', active: 'TRUE', notes: 'Discover how prayer can transform your life and circumstances.' },
        { id: '3', title: 'Understanding Grace', speaker: 'Pastor John Smith', date: '2025-12-29', scripture: 'Ephesians 2:8-10', videourl: '', category: 'Sunday Service', active: 'TRUE', notes: 'Exploring the depth of God\'s unmerited favor.' },
        { id: '4', title: 'Romans Chapter 8', speaker: 'Elder David Wilson', date: '2026-01-08', scripture: 'Romans 8:1-17', videourl: '', category: 'Bible Study', active: 'TRUE', notes: 'Verse-by-verse study of this powerful chapter.' },
        { id: '5', title: 'New Year, New Purpose', speaker: 'Pastor John Smith', date: '2026-01-01', scripture: 'Jeremiah 29:11', videourl: '', category: 'Special', active: 'TRUE', notes: 'Starting the year with God\'s plan for your life.' }
      ],
      notices: [
        { id: '1', title: 'Annual Church Meeting', content: 'Join us for our annual church meeting to discuss plans for 2026. All members are encouraged to attend.', category: 'Announcement', priority: 'High', startdate: '2026-01-15', enddate: '2026-02-01', active: 'TRUE' },
        { id: '2', title: 'Building Fund Update', content: 'We have reached 75% of our building fund goal! Thank you for your generous contributions.', category: 'General', priority: 'Normal', startdate: '2026-01-10', enddate: '2026-01-31', active: 'TRUE' },
        { id: '3', title: 'Volunteer Needed', content: 'We are looking for volunteers for our children\'s ministry. Training provided!', category: 'Ministry', priority: 'Normal', startdate: '2026-01-01', enddate: '2026-02-28', active: 'TRUE' },
        { id: '4', title: 'Weather Alert', content: 'In case of severe weather, check our website for service cancellations.', category: 'General', priority: 'Urgent', startdate: '2026-01-15', enddate: '2026-03-31', active: 'TRUE' }
      ],
      prayers: [
        { id: '1', name: 'Sarah', request: 'Please pray for my mother\'s recovery from surgery.', date: '2026-01-14', anonymous: 'FALSE', status: 'Active' },
        { id: '2', name: 'Anonymous', request: 'Praying for guidance in a difficult career decision.', date: '2026-01-13', anonymous: 'TRUE', status: 'Active' },
        { id: '3', name: 'Michael', request: 'Please pray for our family as we welcome a new baby next month.', date: '2026-01-12', anonymous: 'FALSE', status: 'Active' },
        { id: '4', name: 'Anonymous', request: 'Seeking peace and comfort during a difficult time.', date: '2026-01-11', anonymous: 'TRUE', status: 'Active' }
      ],
      members: [
        { id: '1', firstname: 'John', lastname: 'Doe', email: 'john@example.com', phone: '555-0101', status: 'Active', joindate: '2024-03-15', familygroup: 'Family' },
        { id: '2', firstname: 'Jane', lastname: 'Smith', email: 'jane@example.com', phone: '555-0102', status: 'Active', joindate: '2024-06-20', familygroup: 'Married' },
        { id: '3', firstname: 'Robert', lastname: 'Johnson', email: 'robert@example.com', phone: '555-0103', status: 'Active', joindate: '2025-01-10', familygroup: 'Single' }
      ],
      users: [
        { id: '1', name: 'System Administrator', username: 'admin', email: 'admin@christiansanctuary.org', role: 'admin', active: 'TRUE' }
      ]
    };

    document.addEventListener('DOMContentLoaded', function() {
      initFormExtras();
      lucide.createIcons();
      setTimeout(function () { window.maybeShowJoinPrompt && maybeShowJoinPrompt(); }, 1800);

      // About-page logo: if no image was pasted into the <img>, reuse the small church logo
      const aboutImg = document.getElementById('aboutLogoImg');
      if (aboutImg && !aboutImg.getAttribute('src')) {
        const logoEl = document.querySelector('.logo-placeholder');
        const bg = logoEl ? getComputedStyle(logoEl).backgroundImage : '';
        const lm = bg.match(/^url\(["']?(.*?)["']?\)$/);
        if (lm) aboutImg.src = lm[1];
      }
      
      if (typeof google !== 'undefined' && google.script) {
        console.log('Connected to the church system');
        loadDataFromBackend();
      } else {
        console.log('Running in standalone mode - using demo data');
        loadDemoData(); applySettings(); initCalendar();
        loadPublicData();
      }
      
      const sess = window.ChurchApi && ChurchApi.session();
      if (sess && ['coordinator', 'admin', 'super'].indexOf(sess.user.role) >= 0 && isBackendAvailable()) { currentUser = sess.user; authToken = sess.token; loadAdminData(showAdminPanel); }
      
      window.addEventListener('scroll', function() {
        const navbar = document.getElementById('navbar');
        if (window.scrollY > 50) {
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
        }
      });
    });

    function loadDataFromBackend() {
      showLoader(true);
      google.script.run.withSuccessHandler(function(d) {
        allEvents = d.events || []; allSermons = d.sermons || []; allNotices = d.notices || []; allPrayers = d.prayers || [];
        window.churchSettings = d.settings || {}; applySettings();
        showLoader(false); initCalendar(); loadPublicData();
      }).withFailureHandler(handleBackendError).getPublicData();
    }

    function loadAdminData(cb) {
      const jobs = isAdminRole() ? [['getMembers', v => allMembers = v], ['getEvents', v => allEvents = v], ['getSermons', v => allSermons = v], ['getNotices', v => allNotices = v], ['getPrayerRequests', v => allPrayers = v], ['getMessages', v => allMessages = v], ['getRsvps', v => allRsvps = v], ['getUsers', v => allUsers = v]] : [['getEvents', v => allEvents = v], ['getRsvps', v => allRsvps = v]];
      let n = 0;
      jobs.forEach(([fn, set]) => google.script.run.withSuccessHandler(v => { set(v || []); if (++n === jobs.length && cb) cb(); }).withFailureHandler(handleBackendError)[fn](authToken));
    }

    function applySettings() {
      const S = Object.assign({}, SETTING_DEFAULTS, window.churchSettings || {});
      document.querySelectorAll('[data-s]').forEach(el => el.textContent = S[el.dataset.s] || '');
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('cAddr', S.churchAddress); set('cPhone', S.churchPhone); set('cEmail', S.churchEmail); set('cHours', S.officeHours);
      const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
      put('serviceTimes', [1,2,3].filter(i => S['svc'+i+'Name']).map((i, n) => `<div class="service-card${n === 0 ? ' featured' : ''}"><div class="service-day">${esc(S['svc'+i+'Day'])}</div><div class="service-name">${esc(S['svc'+i+'Name'])}</div><div class="service-time">${esc(t12(S['svc'+i+'Time']))}</div>${isHttp(S['svc'+i+'Link']) ? `<a class="service-join" href="${esc(S['svc'+i+'Link'])}" target="_blank" rel="noopener"><i data-lucide="video"></i> Join Online</a>` : ''}</div>`).join(''));
      put('leaderGrid', [1,2,3,4].filter(i => S['leader'+i+'Name']).map(i => `<div class="leader-card"><div class="leader-avatar">${S['leader'+i+'Photo'] ? `<img src="${esc(S['leader'+i+'Photo'])}" alt="${esc(S['leader'+i+'Name'])}" loading="lazy" onerror="this.style.display='none'">` : '<i data-lucide="user"></i>'}</div><div class="leader-name">${esc(S['leader'+i+'Name'])}</div><div class="leader-role">${esc(S['leader'+i+'Role'])}</div></div>`).join(''));
      put('aboutStory', String(S.aboutStory || '').split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join(''));
      put('footerServices', [1,2,3].filter(i => S['svc'+i+'Name']).map(i => `${esc(S['svc'+i+'Day'])}: ${esc(t12(S['svc'+i+'Time']))}`).join('<br>'));
      document.title = S.churchName;
      lucide.createIcons();
    }

    let dataLoadCount = 0;
    function checkAllDataLoaded() {
      dataLoadCount++;
      if (dataLoadCount >= 6) {
        dataLoadCount = 0;
        showLoader(false);
        initCalendar();
        loadPublicData();
        console.log('All data loaded from backend');
      }
    }

    function isAdminRole() { return !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'super'); }
    function isStaffRole() { return !!currentUser && ['coordinator', 'admin', 'super'].indexOf(currentUser.role) >= 0; }
    function handleBackendError(error) {
      console.error('Backend error:', error);
      if (error && error.network) { showToast('You are offline. Showing what is saved on this phone.', 'info'); showLoader(false); return; }
      if (error && error.code === 'mustchange') { openPasswordModal(); showToast('Please choose your own password first.', 'info'); return; }
      if (error && /Session expired/.test(error.message)) { showToast('Session expired. Please sign in again.', 'error'); handleLogout(); return; }
      showToast('Error loading data: ' + error.message, 'error');
      showLoader(false);
    }

    function showLoader(show) {
      if (show) {
        document.body.style.cursor = 'wait'; document.body.classList.add('loading');
      } else {
        document.body.style.cursor = 'default'; document.body.classList.remove('loading');
      }
    }

    function isBackendAvailable() {
      return typeof google !== 'undefined' && google.script;
    }

    function loadDemoData() {
      const shift = Math.round((parseLocal(localDate()) - new Date(2026, 0, 15)) / 864e5);
      const sh = s => { if (!s) return s; const d = parseLocal(s); d.setDate(d.getDate() + shift); return localDate(d); };
      const c = a => JSON.parse(JSON.stringify(a)).map(o => { ['date','startdate','enddate','joindate'].forEach(k => { if (o[k]) o[k] = sh(o[k]); }); return o; });
      allEvents = c(demoData.events); allSermons = c(demoData.sermons); allNotices = c(demoData.notices);
      allPrayers = c(demoData.prayers); allMembers = c(demoData.members); allUsers = c(demoData.users);
    }

    function showPage(pageName) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      
      const page = document.getElementById('page-' + pageName);
      const link = document.querySelector(`.nav-link[data-page="${pageName}"]`);
      
      if (page) page.classList.add('active');
      if (link) link.classList.add('active');
      
      renderFlyerStrips();
      if (pageName === 'events') loadEventsList();
      if (pageName === 'sermons') loadSermons();
      if (pageName === 'notices') loadNotices();
      if (pageName === 'prayer') loadPrayerRequests();
      
      document.getElementById('navMenu').classList.remove('open');
      window.scrollTo(0, 0);
    }

    function toggleMobileMenu() {
      document.getElementById('navMenu').classList.toggle('open');
    }

    function showLoginPage() {
      closeModal('joinPromptModal');
      document.getElementById('publicSite').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'none';
      document.getElementById('loginPage').style.display = 'flex';
      lucide.createIcons();
    }

    function showPublicSite() {
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'none';
      document.getElementById('publicSite').style.display = 'block';
      showPage('home');
      lucide.createIcons();
    }

    function showAdminPanel() {
      closeModal('joinPromptModal');
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('publicSite').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'flex';
      
      if (currentUser) {
        document.getElementById('adminUserName').textContent = currentUser.name;
        document.getElementById('adminUserRole').textContent = ({ super: 'Super Administrator', admin: 'Administrator', coordinator: 'Event Coordinator' })[currentUser.role] || currentUser.role;
        if (window.ChurchUI) ChurchUI.applyRoleUI();
        loadAdminMessages();
      }
      
      showAdminPage('dashboard');
      lucide.createIcons();
    }

    function handleLogin(e) {
      e.preventDefault();
      const u = document.getElementById('loginUsername').value.trim(), p = document.getElementById('loginPassword').value;
      const btn = document.getElementById('loginBtn');
      if (isBackendAvailable()) {
        btn.disabled = true;
        google.script.run.withSuccessHandler(function(r) {
          btn.disabled = false;
          if (r.success) {
            currentUser = r.user; authToken = r.token;
            store.set('currentUser', JSON.stringify(r.user)); store.set('authToken', r.token);
            ChurchApi.setSession(r.token, r.user);
            showToast('Welcome back, ' + r.user.name + '!', 'success');
            loadAdminData(showAdminPanel);
            if (r.user.mustChange) setTimeout(function () { openPasswordModal(); showToast('Please choose your own password now.', 'info'); }, 600);
            if (window.ChurchUI) ChurchUI.afterSignIn();
          } else showToast(r.message || 'Login failed', 'error');
        }).withFailureHandler(function(err) { btn.disabled = false; showToast('Login failed: ' + err.message, 'error'); }).authenticateUser(u, p);
        return;
      }
      showToast('This copy is not connected to the church system yet (see config.js).', 'error');
    }

    function openPasswordModal() { document.getElementById('passwordForm').reset(); openModal('passwordModal'); }

    let rsStep = 1;
    function showReset(on) {
      document.getElementById('loginForm').style.display = on ? 'none' : 'block';
      document.getElementById('resetForm').style.display = on ? 'block' : 'none';
      document.querySelector('.login-header h1').textContent = on ? 'Reset Password' : 'Staff Sign In';
      document.querySelector('.login-header p').textContent = on ? 'We will email you a one-time code' : 'For administrators and event coordinators';
      if (on) { rsStep = 1; document.getElementById('rsStep2').style.display = 'none'; document.getElementById('rsIdent').disabled = false; document.getElementById('rsBtn').textContent = 'Send Reset Code'; }
    }
    function handleReset(e) {
      e.preventDefault();
      const ident = document.getElementById('rsIdent').value.trim(), btn = document.getElementById('rsBtn');
      if (!isBackendAvailable()) { showToast('Email password reset works once the app is deployed to Google Apps Script.', 'info'); return; }
      btn.disabled = true;
      const fail = er => { btn.disabled = false; showToast('Error: ' + er.message, 'error'); };
      if (rsStep === 1) {
        google.script.run.withSuccessHandler(function() {
          btn.disabled = false; rsStep = 2; document.getElementById('rsStep2').style.display = 'block';
          document.getElementById('rsIdent').disabled = true; btn.textContent = 'Reset Password';
          showToast('If that account exists, a reset code has been emailed.', 'info');
        }).withFailureHandler(fail).requestPasswordReset(ident);
      } else {
        const n = document.getElementById('rsNew').value, c = document.getElementById('rsConfirm').value;
        if (n !== c) { btn.disabled = false; showToast('Passwords do not match', 'error'); return; }
        if (n.length < 10 || !/[A-Za-z]/.test(n) || !/[0-9]/.test(n)) { btn.disabled = false; showToast('Password needs 10+ characters with a letter and a number', 'error'); return; }
        google.script.run.withSuccessHandler(function(r) {
          btn.disabled = false;
          if (r.success) { showToast('Password updated. You can sign in now.', 'success'); document.getElementById('resetForm').reset(); showReset(false); }
          else showToast(r.message, 'error');
        }).withFailureHandler(fail).resetPassword(ident, document.getElementById('rsCode').value.trim(), n);
      }
    }

    function handleLogout() {
      currentUser = null;
      ChurchApi.clearSession(); authToken = null; allMembers = []; allUsers = []; allMessages = []; allRsvps = [];
      if (window.ChurchUI) ChurchUI.afterSignOut();
      if (isBackendAvailable()) loadDataFromBackend();
      showToast('Logged out successfully', 'info');
      showPublicSite();
    }

    function showAdminPage(pageName) {
      if (currentUser && !isAdminRole() && ['dashboard', 'events'].indexOf(pageName) < 0) pageName = 'dashboard';
      document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      
      const page = document.getElementById('admin-' + pageName);
      const link = document.querySelector(`.sidebar-link[data-admin-page="${pageName}"]`);
      
      if (page) page.classList.add('active');
      if (link) link.classList.add('active');
      
      const titles = {
        dashboard: 'Dashboard', members: 'Members', events: 'Events',
        sermons: 'Sermons', notices: 'Notices', prayers: 'Prayer Requests', messages: 'Messages',
        users: 'Staff Users', settings: 'Settings', approvals: 'Approvals', broadcast: 'Send an Alert'
      };
      document.getElementById('adminPageTitle').textContent = titles[pageName] || pageName;
      
      if (pageName === 'approvals' && window.ChurchUI) ChurchUI.loadApprovals();
      if (pageName === 'broadcast' && window.ChurchUI) ChurchUI.loadBroadcast();
      if (pageName === 'dashboard') loadAdminDashboard();
      if (pageName === 'members') loadAdminMembers();
      if (pageName === 'events') loadAdminEvents();
      if (pageName === 'sermons') loadAdminSermons();
      if (pageName === 'notices') loadAdminNotices();
      if (pageName === 'prayers') loadAdminPrayers();
      if (pageName === 'messages') loadAdminMessages();
      if (pageName === 'users') loadAdminUsers();
      if (pageName === 'settings') loadSettings();
      
      document.getElementById('adminSidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
      
      lucide.createIcons();
    }

    function toggleAdminSidebar() {
      document.getElementById('adminSidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('active');
    }

    function loadAdminDashboard() {
      document.getElementById('statMembers').textContent = allMembers.length;
      document.getElementById('statEvents').textContent = allEvents.filter(e => e.date >= localDate()).length;
      document.getElementById('statSermons').textContent = allSermons.length;
      document.getElementById('statPrayers').textContent = allPrayers.filter(p => p.status === 'Active').length;
      
      const recentMembers = allMembers.slice(-5).reverse();
      document.getElementById('recentMembersList').innerHTML = recentMembers.length ? 
        recentMembers.map(m => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--gray-100);">
            <div>
              <div style="font-weight: 600; color: var(--gray-800);">${esc(m.firstname)} ${esc(m.lastname)}</div>
              <div style="font-size: 13px; color: var(--gray-500);">${esc(m.email)}</div>
            </div>
            <span class="status-badge ${m.status.toLowerCase()}">${m.status}</span>
          </div>
        `).join('') : '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No members yet</p>';
      
      const activeNotices = allNotices.filter(n => n.active === 'TRUE').slice(0, 3);
      document.getElementById('activeNoticesList').innerHTML = activeNotices.length ?
        activeNotices.map(n => `
          <div style="padding: 12px 0; border-bottom: 1px solid var(--gray-100);">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="font-weight: 600; color: var(--gray-800);">${esc(n.title)}</div>
              <span class="status-badge ${n.priority.toLowerCase()}">${n.priority}</span>
            </div>
            <div style="font-size: 13px; color: var(--gray-500); margin-top: 4px;">${esc(n.content.substring(0, 80))}...</div>
          </div>
        `).join('') : '<p style="color: var(--gray-500); text-align: center; padding: 20px;">No active notices</p>';
    }

    function loadAdminMembers() {
      const tbody = document.getElementById('membersTableBody');
      tbody.innerHTML = allMembers.length ? allMembers.map(m => `
        <tr>
          <td><strong>${esc(m.firstname)} ${esc(m.lastname)}</strong></td>
          <td>${esc(m.email)}</td>
          <td>${esc(m.phone || '-')}</td><td>${esc(m.occupation || '-')}</td>
          <td><span class="status-badge ${m.status.toLowerCase()}">${m.status}</span>${m.approval && m.approval !== 'Approved' ? ` <span class="status-badge ${m.approval === 'Pending' ? 'high' : 'inactive'}">${esc(m.approval)}</span>` : ''}</td>
          <td>${familyLabel(m)}</td><td style="max-width:220px">${esc(String(m.ministry || '-').replace(/;\s*/g, ', '))}</td><td>${formatDate(m.joindate)}${m.registered && m.registered !== m.joindate ? '<div style="font-size:11px;color:var(--gray-400)">On app: ' + formatDate(m.registered) + '</div>' : ''}</td>
          <td>
            <div class="table-actions">
              ${m.householdid ? `<button class="table-action-btn edit" onclick="viewHousehold('${m.householdid}')" title="View family"><i data-lucide="users"></i></button>` : ''}<button class="table-action-btn edit" onclick="editMember('${m.id}')" title="Edit"><i data-lucide="pencil"></i></button>
              <button class="table-action-btn delete" onclick="confirmDelete('member', '${m.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="9" class="data-table-empty">No members found</td></tr>';
      lucide.createIcons();
    }

    function filterAdminMembers() {
      const search = document.getElementById('memberSearchInput').value.toLowerCase();
      const filtered = allMembers.filter(m => 
        m.firstname.toLowerCase().includes(search) || 
        m.lastname.toLowerCase().includes(search) || 
        m.email.toLowerCase().includes(search)
      );
      const tbody = document.getElementById('membersTableBody');
      tbody.innerHTML = filtered.length ? filtered.map(m => `
        <tr>
          <td><strong>${esc(m.firstname)} ${esc(m.lastname)}</strong></td>
          <td>${esc(m.email)}</td>
          <td>${esc(m.phone || '-')}</td><td>${esc(m.occupation || '-')}</td>
          <td><span class="status-badge ${m.status.toLowerCase()}">${m.status}</span>${m.approval && m.approval !== 'Approved' ? ` <span class="status-badge ${m.approval === 'Pending' ? 'high' : 'inactive'}">${esc(m.approval)}</span>` : ''}</td>
          <td>${familyLabel(m)}</td><td style="max-width:220px">${esc(String(m.ministry || '-').replace(/;\s*/g, ', '))}</td><td>${formatDate(m.joindate)}${m.registered && m.registered !== m.joindate ? '<div style="font-size:11px;color:var(--gray-400)">On app: ' + formatDate(m.registered) + '</div>' : ''}</td>
          <td>
            <div class="table-actions">
              ${m.householdid ? `<button class="table-action-btn edit" onclick="viewHousehold('${m.householdid}')" title="View family"><i data-lucide="users"></i></button>` : ''}<button class="table-action-btn edit" onclick="editMember('${m.id}')" title="Edit"><i data-lucide="pencil"></i></button>
              <button class="table-action-btn delete" onclick="confirmDelete('member', '${m.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="9" class="data-table-empty">No members found</td></tr>';
      lucide.createIcons();
    }

    function openMemberModal(member = null) {
      document.getElementById('memberModalTitle').textContent = member ? 'Edit Member' : 'Add Member';
      document.getElementById('editMemberId').value = member ? member.id : '';
      document.getElementById('editMemberFirstName').value = member ? member.firstname : '';
      document.getElementById('editMemberLastName').value = member ? member.lastname : '';
      document.getElementById('editMemberEmail').value = member ? member.email : '';
      document.getElementById('editMemberPhone').value = member ? member.phone : '';
      document.getElementById('editMemberAddress').value = member ? member.address : '';
      document.getElementById('editMemberDOB').value = member ? member.dateofbirth : '';
      document.getElementById('editMemberStatus').value = member ? member.status : 'Active';
      document.getElementById('editMemberFamily').value = member ? member.familygroup : '';
      document.getElementById('editMemberNotes').value = member ? member.notes : '';
      setMinistries('editMemberMinistry', member ? member.ministry : '');
      const lk = document.getElementById('editMemberLink'); lk.innerHTML = ''; lk.add(new Option(member ? 'Keep as is' : 'Not linked', ''));
      if (member) lk.add(new Option('Remove from family', '__none__'));
      allMembers.filter(x => !member || x.id !== member.id).forEach(x => lk.add(new Option(x.firstname + ' ' + x.lastname + (x.householdid ? ' (family)' : ''), x.id)));
      document.getElementById('editMemberRelationship').value = member ? (member.relationship || '') : '';
      document.getElementById('editMemberOccupation').value = member ? (member.occupation || '') : '';
      document.getElementById('editMemberJoined').value = member ? (member.joindate || '') : localDate();
      document.getElementById('editMemberRegistered').textContent = member ? 'Entered in the app on ' + formatDate(member.registered || member.joindate) : 'Set this to the date they actually joined, even if it was years ago.';
      openModal('memberModal');
    }

    function editMember(id) {
      const member = allMembers.find(m => m.id === id);
      if (member) openMemberModal(member);
    }

    function saveMember(e) {
      e.preventDefault();
      const id = document.getElementById('editMemberId').value;
      const memberData = {
        firstName: document.getElementById('editMemberFirstName').value,
        lastName: document.getElementById('editMemberLastName').value,
        email: document.getElementById('editMemberEmail').value,
        phone: document.getElementById('editMemberPhone').value,
        address: document.getElementById('editMemberAddress').value,
        dateOfBirth: document.getElementById('editMemberDOB').value,
        status: document.getElementById('editMemberStatus').value,
        familyGroup: document.getElementById('editMemberFamily').value,
        notes: document.getElementById('editMemberNotes').value,
        ministry: getMinistries('editMemberMinistry'),
        occupation: document.getElementById('editMemberOccupation').value.trim(),
        joinDate: document.getElementById('editMemberJoined').value,
        relationship: document.getElementById('editMemberRelationship').value,
        linkTo: document.getElementById('editMemberLink').value,
        token: authToken
      };
      
      if (isBackendAvailable()) {
        if (id) {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Member updated successfully', 'success');
                closeModal('memberModal');
                refreshMembers();
              } else {
                showToast(result.message || 'Failed to update member', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .updateMember(authToken, id, memberData);
        } else {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Member added successfully', 'success');
                closeModal('memberModal');
                refreshMembers();
              } else {
                showToast(result.message || 'Failed to add member', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .registerMember(memberData);
        }
      } else {
        const localData = {
          id: id || Date.now().toString(),
          firstname: memberData.firstName,
          lastname: memberData.lastName,
          email: memberData.email,
          phone: memberData.phone,
          address: memberData.address,
          dateofbirth: memberData.dateOfBirth,
          status: memberData.status,
          familygroup: memberData.familyGroup, occupation: memberData.occupation || '', ministry: memberData.ministry, relationship: memberData.relationship || '',
          notes: memberData.notes,
          joindate: memberData.joinDate || localDate(), registered: id ? (allMembers.find(m => m.id === id)?.registered) : localDate()
        };
        
        if (id) {
          const index = allMembers.findIndex(m => m.id === id);
          if (index !== -1) { localData.householdid = allMembers[index].householdid; allMembers[index] = localData; }
        } else {
          allMembers.push(localData);
        }
        
        if (memberData.linkTo) {
          const me = allMembers.find(m => m.id === localData.id), head = allMembers.find(m => m.id === memberData.linkTo);
          if (me && memberData.linkTo === '__none__') me.householdid = '';
          else if (me && head) { head.householdid = head.householdid || head.id; head.relationship = head.relationship || 'Head of household'; me.householdid = head.householdid; }
        }
        closeModal('memberModal');
        loadAdminMembers();
        showToast('Member saved successfully (demo mode)', 'success');
      }
    }

    function refreshMembers() {
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(data) {
            allMembers = data || [];
            loadAdminMembers();
          })
          .getMembers(authToken);
      } else {
        loadAdminMembers();
      }
    }

    function loadAdminEvents() {
      const tbody = document.getElementById('eventsTableBody');
      tbody.innerHTML = allEvents.length ? allEvents.map(e => `
        <tr>
          <td><strong>${esc(e.title)}</strong>${e.coordinator ? `<div style="font-size:12px;color:var(--gray-500)">RSVPs go to ${esc(e.coordinator)}</div>` : ''}</td>
          <td>${formatDate(e.date)}</td>
          <td>${formatTime(e.time)}</td>
          <td>${e.location || '-'}</td>
          <td>${e.category || '-'}</td><td>${rsvpCount(e.id)}</td>
          <td><span class="status-badge ${e.active === 'TRUE' ? 'active' : 'inactive'}">${e.active === 'TRUE' ? 'Active' : 'Inactive'}</span></td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn edit" onclick="editEvent('${e.id}')" title="Edit"><i data-lucide="pencil"></i></button>
              <button class="table-action-btn delete" onclick="confirmDelete('event', '${e.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="8" class="data-table-empty">No events found</td></tr>';
      lucide.createIcons();
    }

    function openEventModal(event = null) {
      document.getElementById('eventModalTitle').textContent = event ? 'Edit Event' : 'Add Event';
      document.getElementById('editEventId').value = event ? event.id : '';
      document.getElementById('editEventTitle').value = event ? event.title : '';
      document.getElementById('editEventDesc').value = event ? event.description : '';
      document.getElementById('editEventDate').value = event ? event.date : '';
      document.getElementById('editEventTime').value = event ? event.time : '';
      document.getElementById('editEventEndTime').value = event ? event.endtime : '';
      document.getElementById('editEventLocation').value = event ? event.location : '';
      document.getElementById('editEventCategory').value = event ? event.category : 'Worship';
      document.getElementById('editEventActive').value = event ? (event.active === 'TRUE' ? 'true' : 'false') : 'true';
      eventFlyer = event ? (event.flyer || '') : ''; document.getElementById('editEventLink').value = event ? (event.link || '') : ''; document.getElementById('editEventCoordinator').value = event ? (event.coordinator || '') : ''; document.getElementById('editEventFlyerFile').value = ''; showFlyerPreview();
      openModal('eventModal');
    }

    function editEvent(id) {
      const event = allEvents.find(e => e.id === id);
      if (event) openEventModal(event);
    }

    function saveEvent(e) {
      e.preventDefault();
      const lk = document.getElementById('editEventLink').value.trim();
      if (lk && !isHttp(lk)) { showToast('The online link must start with https:\/\/', 'error'); return; }
      const co = document.getElementById('editEventCoordinator').value.trim();
      if (co && !co.split(/[;,\s]+/).filter(Boolean).every(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) { showToast('Please check the coordinator email address', 'error'); return; }
      const id = document.getElementById('editEventId').value;
      const eventData = {
        title: document.getElementById('editEventTitle').value,
        description: document.getElementById('editEventDesc').value,
        date: document.getElementById('editEventDate').value,
        time: document.getElementById('editEventTime').value,
        endTime: document.getElementById('editEventEndTime').value,
        location: document.getElementById('editEventLocation').value,
        category: document.getElementById('editEventCategory').value,
        active: document.getElementById('editEventActive').value === 'true',
        flyer: eventFlyer,
        link: document.getElementById('editEventLink').value.trim(),
        coordinator: document.getElementById('editEventCoordinator').value.trim()
      };
      
      if (isBackendAvailable()) {
        if (id) {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Event updated successfully', 'success');
                closeModal('eventModal');
                refreshEvents();
              } else {
                showToast(result.message || 'Failed to update event', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .updateEvent(authToken, id, eventData);
        } else {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Event added successfully', 'success');
                closeModal('eventModal');
                refreshEvents();
              } else {
                showToast(result.message || 'Failed to add event', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .addEvent(authToken, eventData);
        }
      } else {
        const localData = {
          id: id || Date.now().toString(),
          title: eventData.title,
          description: eventData.description,
          date: eventData.date,
          time: eventData.time,
          endtime: eventData.endTime,
          location: eventData.location,
          category: eventData.category,
          flyer: eventData.flyer, link: eventData.link, coordinator: eventData.coordinator,
          active: eventData.active ? 'TRUE' : 'FALSE'
        };
        
        if (id) {
          const index = allEvents.findIndex(e => e.id === id);
          if (index !== -1) allEvents[index] = localData;
        } else {
          allEvents.push(localData);
        }
        
        closeModal('eventModal');
        loadAdminEvents();
        renderCalendar();
        showToast('Event saved successfully (demo mode)', 'success');
      }
    }

    function refreshEvents() {
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(data) {
            allEvents = data || [];
            loadAdminEvents();
            renderCalendar();
          })
          .getEvents(authToken);
      } else {
        loadAdminEvents();
        renderCalendar();
      }
    }

    function loadAdminSermons() {
      const tbody = document.getElementById('sermonsTableBody');
      tbody.innerHTML = allSermons.length ? allSermons.map(s => `
        <tr>
          <td><strong>${esc(s.title)}</strong></td>
          <td>${esc(s.speaker)}</td>
          <td>${formatDate(s.date)}</td>
          <td>${s.scripture || '-'}</td>
          <td>${s.category || '-'}</td>
          <td><span class="status-badge ${s.active === 'TRUE' ? 'active' : 'inactive'}">${s.active === 'TRUE' ? 'Active' : 'Inactive'}</span></td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn edit" onclick="editSermon('${s.id}')" title="Edit"><i data-lucide="pencil"></i></button>
              <button class="table-action-btn delete" onclick="confirmDelete('sermon', '${s.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="7" class="data-table-empty">No sermons found</td></tr>';
      lucide.createIcons();
    }

    function openSermonModal(sermon = null) {
      document.getElementById('sermonModalTitle').textContent = sermon ? 'Edit Sermon' : 'Add Sermon';
      document.getElementById('editSermonId').value = sermon ? sermon.id : '';
      document.getElementById('editSermonTitle').value = sermon ? sermon.title : '';
      document.getElementById('editSermonSpeaker').value = sermon ? sermon.speaker : '';
      document.getElementById('editSermonDate').value = sermon ? sermon.date : '';
      document.getElementById('editSermonScripture').value = sermon ? sermon.scripture : '';
      document.getElementById('editSermonCategory').value = sermon ? sermon.category : 'Sunday Service';
      document.getElementById('editSermonVideo').value = sermon ? sermon.videourl : '';
      document.getElementById('editSermonNotes').value = sermon ? sermon.notes : '';
      document.getElementById('editSermonActive').value = sermon ? (sermon.active === 'TRUE' ? 'true' : 'false') : 'true';
      openModal('sermonModal');
    }

    function editSermon(id) {
      const sermon = allSermons.find(s => s.id === id);
      if (sermon) openSermonModal(sermon);
    }

    function saveSermon(e) {
      e.preventDefault();
      const yt = document.getElementById('editSermonVideo').value.trim();
      if (yt && !ytId(yt)) { showToast('Please paste a valid YouTube link', 'error'); return; }
      const id = document.getElementById('editSermonId').value;
      const sermonData = {
        title: document.getElementById('editSermonTitle').value,
        speaker: document.getElementById('editSermonSpeaker').value,
        date: document.getElementById('editSermonDate').value,
        scripture: document.getElementById('editSermonScripture').value,
        category: document.getElementById('editSermonCategory').value,
        videoUrl: document.getElementById('editSermonVideo').value,
        audioUrl: '',
        notes: document.getElementById('editSermonNotes').value,
        active: document.getElementById('editSermonActive').value === 'true'
      };
      
      if (isBackendAvailable()) {
        if (id) {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Sermon updated successfully', 'success');
                closeModal('sermonModal');
                refreshSermons();
              } else {
                showToast(result.message || 'Failed to update sermon', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .updateSermon(authToken, id, sermonData);
        } else {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Sermon added successfully', 'success');
                closeModal('sermonModal');
                refreshSermons();
              } else {
                showToast(result.message || 'Failed to add sermon', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .addSermon(authToken, sermonData);
        }
      } else {
        const localData = {
          id: id || Date.now().toString(),
          title: sermonData.title,
          speaker: sermonData.speaker,
          date: sermonData.date,
          scripture: sermonData.scripture,
          category: sermonData.category,
          videourl: sermonData.videoUrl,
          notes: sermonData.notes,
          active: sermonData.active ? 'TRUE' : 'FALSE'
        };
        
        if (id) {
          const index = allSermons.findIndex(s => s.id === id);
          if (index !== -1) allSermons[index] = localData;
        } else {
          allSermons.push(localData);
        }
        
        closeModal('sermonModal');
        loadAdminSermons();
        showToast('Sermon saved successfully (demo mode)', 'success');
      }
    }

    function refreshSermons() {
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(data) {
            allSermons = data || [];
            loadAdminSermons();
            loadSermons();
          })
          .getSermons(authToken);
      } else {
        loadAdminSermons();
        loadSermons();
      }
    }

    function loadAdminNotices() {
      const tbody = document.getElementById('noticesTableBody');
      tbody.innerHTML = allNotices.length ? allNotices.map(n => `
        <tr>
          <td><strong>${esc(n.title)}</strong></td>
          <td><span class="status-badge ${n.priority.toLowerCase()}">${n.priority}</span></td>
          <td>${formatDate(n.startdate)}</td>
          <td>${formatDate(n.enddate)}</td>
          <td><span class="status-badge ${n.active === 'TRUE' ? 'active' : 'inactive'}">${n.active === 'TRUE' ? 'Active' : 'Inactive'}</span></td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn edit" onclick="editNotice('${n.id}')" title="Edit"><i data-lucide="pencil"></i></button>
              <button class="table-action-btn delete" onclick="confirmDelete('notice', '${n.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="6" class="data-table-empty">No notices found</td></tr>';
      lucide.createIcons();
    }

    function openNoticeModal(notice = null) {
      document.getElementById('noticeModalTitle').textContent = notice ? 'Edit Notice' : 'Add Notice';
      document.getElementById('editNoticeId').value = notice ? notice.id : '';
      document.getElementById('editNoticeTitle').value = notice ? notice.title : '';
      document.getElementById('editNoticeContent').value = notice ? notice.content : '';
      document.getElementById('editNoticePriority').value = notice ? notice.priority : 'Normal';
      document.getElementById('editNoticeAudience').value = notice && notice.audience === 'Members' ? 'Members' : 'Public';
      document.getElementById('editNoticeCategory').value = notice ? notice.category : 'General';
      document.getElementById('editNoticeStartDate').value = notice ? notice.startdate : localDate();
      document.getElementById('editNoticeEndDate').value = notice ? notice.enddate : '';
      document.getElementById('editNoticeActive').value = notice ? (notice.active === 'TRUE' ? 'true' : 'false') : 'true';
      openModal('noticeModal');
    }

    function editNotice(id) {
      const notice = allNotices.find(n => n.id === id);
      if (notice) openNoticeModal(notice);
    }

    function saveNotice(e) {
      e.preventDefault();
      const id = document.getElementById('editNoticeId').value;
      const noticeData = {
        title: document.getElementById('editNoticeTitle').value,
        audience: document.getElementById('editNoticeAudience').value,
        content: document.getElementById('editNoticeContent').value,
        priority: document.getElementById('editNoticePriority').value,
        category: document.getElementById('editNoticeCategory').value,
        startDate: document.getElementById('editNoticeStartDate').value,
        endDate: document.getElementById('editNoticeEndDate').value,
        active: document.getElementById('editNoticeActive').value === 'true'
      };
      
      if (isBackendAvailable()) {
        if (id) {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Notice updated successfully', 'success');
                closeModal('noticeModal');
                refreshNotices();
              } else {
                showToast(result.message || 'Failed to update notice', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .updateNotice(authToken, id, noticeData);
        } else {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Notice added successfully', 'success');
                closeModal('noticeModal');
                refreshNotices();
              } else {
                showToast(result.message || 'Failed to add notice', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .addNotice(authToken, noticeData);
        }
      } else {
        const localData = {
          id: id || Date.now().toString(),
          title: noticeData.title,
          content: noticeData.content,
          priority: noticeData.priority,
          category: noticeData.category,
          startdate: noticeData.startDate,
          enddate: noticeData.endDate,
          active: noticeData.active ? 'TRUE' : 'FALSE'
        };
        
        if (id) {
          const index = allNotices.findIndex(n => n.id === id);
          if (index !== -1) allNotices[index] = localData;
        } else {
          allNotices.push(localData);
        }
        
        closeModal('noticeModal');
        loadAdminNotices();
        showToast('Notice saved successfully (demo mode)', 'success');
      }
    }

    function refreshNotices() {
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(data) {
            allNotices = data || [];
            loadAdminNotices();
            loadNotices();
          })
          .getNotices(authToken);
      } else {
        loadAdminNotices();
        loadNotices();
      }
    }

    function loadAdminPrayers() {
      const next = {Pending: ['Active','check','Approve'], Active: ['Answered','check-check','Mark answered'], Answered: ['Active','refresh-cw','Reactivate']};
      document.getElementById('prayersTableBody').innerHTML = allPrayers.length ? allPrayers.map(p => { const n = next[p.status] || next.Active; return `<tr><td>${esc(p.name)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.request)}</td><td>${formatDate(p.date)}</td><td><span class="status-badge ${esc(String(p.status).toLowerCase())}">${esc(p.status)}</span></td><td><div class="table-actions"><button class="table-action-btn edit" onclick="viewPrayer('${p.id}')" title="Read"><i data-lucide="eye"></i></button><button class="table-action-btn edit" onclick="updatePrayerStatus('${p.id}','${n[0]}')" title="${n[2]}"><i data-lucide="${n[1]}"></i></button><button class="table-action-btn delete" onclick="confirmDelete('prayer','${p.id}')" title="Delete"><i data-lucide="trash-2"></i></button></div></td></tr>`; }).join('') : '<tr><td colspan="5" class="data-table-empty">No prayer requests found</td></tr>';
      lucide.createIcons();
    }

    function viewItem(title, html) { document.getElementById('viewTitle').textContent = title; document.getElementById('viewBody').innerHTML = html; openModal('viewModal'); }
    function viewPrayer(id) {
      const p = allPrayers.find(x => x.id === id); if (!p) return;
      viewItem('Prayer Request', `<p style="color:var(--gray-500);font-size:13px;margin-bottom:12px">${esc(p.name)}${p.email ? ' · ' + esc(p.email) : ''} · ${formatDate(p.date)}</p><p style="white-space:pre-wrap;line-height:1.7">${esc(p.request)}</p>`);
    }

    function loadAdminMessages() {
      const nNew = allMessages.filter(m => m.status === 'New').length, b = document.getElementById('msgBadge');
      if (b) { b.textContent = nNew || ''; b.style.display = nNew ? 'inline-block' : 'none'; }
      document.getElementById('messagesTableBody').innerHTML = allMessages.length ? allMessages.map(m => `<tr><td><strong>${esc(m.name)}</strong><div style="font-size:12px;color:var(--gray-500)">${esc(m.email)}</div></td><td>${esc(m.subject || '(No subject)')}</td><td>${formatDate(m.date)}</td><td><span class="status-badge ${esc(String(m.status).toLowerCase())}">${esc(m.status)}</span></td><td><div class="table-actions"><button class="table-action-btn edit" onclick="viewMessage('${m.id}')" title="Read"><i data-lucide="eye"></i></button><button class="table-action-btn delete" onclick="deleteMessageUI('${m.id}')" title="Delete"><i data-lucide="trash-2"></i></button></div></td></tr>`).join('') : '<tr><td colspan="5" class="data-table-empty">No messages yet</td></tr>';
      lucide.createIcons();
    }
    function viewMessage(id) {
      const m = allMessages.find(x => x.id === id); if (!m) return;
      viewItem(m.subject || '(No subject)', `<p style="color:var(--gray-500);font-size:13px;margin-bottom:12px">${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a> · ${formatDate(m.date)}</p><p style="white-space:pre-wrap;line-height:1.7">${esc(m.message)}</p>`);
      if (m.status === 'New') { m.status = 'Read'; loadAdminMessages(); if (isBackendAvailable()) google.script.run.withFailureHandler(function() {}).updateMessage(authToken, id, 'Read'); }
    }
    function deleteMessageUI(id) {
      document.getElementById('confirmMessage').textContent = 'Delete this message?';
      document.getElementById('confirmDeleteBtn').onclick = function() {
        const done = function() { allMessages = allMessages.filter(m => m.id !== id); closeModal('confirmModal'); showToast('Message deleted', 'success'); loadAdminMessages(); };
        if (!isBackendAvailable()) { done(); return; }
        google.script.run.withSuccessHandler(function(r) { r.success ? done() : showToast(r.message, 'error'); }).withFailureHandler(function(er) { showToast('Error: ' + er.message, 'error'); }).deleteMessage(authToken, id);
      };
      openModal('confirmModal');
    }

    function loadAdminUsers() {
      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = allUsers.length ? allUsers.map(u => `
        <tr>
          <td><strong>${esc(u.name)}</strong></td>
          <td>${esc(u.username)}</td>
          <td>${esc(u.email)}</td>
          <td>${({ super: 'Super Admin', admin: 'Administrator', coordinator: 'Event Coordinator', editor: 'Event Coordinator' })[u.role] || esc(u.role)}</td>
          <td><span class="status-badge ${u.active === 'TRUE' ? 'active' : 'inactive'}">${u.active === 'TRUE' ? 'Active' : 'Inactive'}</span></td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn edit" onclick="editUser('${u.id}')" title="Edit"><i data-lucide="pencil"></i></button>
              <button class="table-action-btn delete" onclick="confirmDelete('user', '${u.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="6" class="data-table-empty">No users found</td></tr>';
      lucide.createIcons();
    }

    function openUserModal(user = null) {
      document.getElementById('userModalTitle').textContent = user ? 'Edit Staff User' : 'Add Staff User';
      document.getElementById('editUserId').value = user ? user.id : '';
      document.getElementById('editUserName').value = user ? user.name : '';
      document.getElementById('editUserUsername').value = user ? user.username : '';
      document.getElementById('editUserEmail').value = user ? user.email : '';
      document.getElementById('editUserPassword').value = '';
      document.getElementById('editUserRole').value = user ? user.role : 'coordinator';
      document.getElementById('roleSuperOpt').style.display = currentUser && currentUser.role === 'super' ? '' : 'none';
      document.getElementById('editUserActive').value = user ? (user.active === 'TRUE' ? 'true' : 'false') : 'true';
      document.getElementById('editUserPassword').required = !user;
      openModal('userModal');
    }

    function editUser(id) {
      const user = allUsers.find(u => u.id === id);
      if (user) openUserModal(user);
    }

    function saveUser(e) {
      e.preventDefault();
      const id = document.getElementById('editUserId').value;
      const userData = {
        name: document.getElementById('editUserName').value,
        username: document.getElementById('editUserUsername').value,
        email: document.getElementById('editUserEmail').value,
        password: document.getElementById('editUserPassword').value,
        role: document.getElementById('editUserRole').value,
        active: document.getElementById('editUserActive').value === 'true'
      };
      
      if (isBackendAvailable()) {
        if (id) {
          const updateData = {
            name: userData.name,
            email: userData.email,
            role: userData.role,
            active: userData.active,
            newPassword: userData.password || null
          };
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('User updated successfully', 'success');
                closeModal('userModal');
                refreshUsers();
              } else {
                showToast(result.message || 'Failed to update user', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .updateUser(authToken, id, updateData);
        } else {
          if (!userData.password) {
            showToast('Password is required for new users', 'error');
            return;
          }
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('User created successfully', 'success');
                closeModal('userModal');
                refreshUsers();
              } else {
                showToast(result.message || 'Failed to create user', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })
            .addUser(authToken, userData);
        }
      } else {
        const localData = {
          id: id || Date.now().toString(),
          name: userData.name,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          active: userData.active ? 'TRUE' : 'FALSE'
        };
        
        if (id) {
          const index = allUsers.findIndex(u => u.id === id);
          if (index !== -1) {
            localData.password = allUsers[index].password;
            allUsers[index] = localData;
          }
        } else {
          localData.password = userData.password;
          allUsers.push(localData);
        }
        
        closeModal('userModal');
        loadAdminUsers();
        showToast('User saved successfully (demo mode)', 'success');
      }
    }

    function refreshUsers() {
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(data) {
            allUsers = data || [];
            loadAdminUsers();
          })
          .getUsers(authToken);
      } else {
        loadAdminUsers();
      }
    }

    function loadSettings() {
      const render = function(cur) {
        const S = Object.assign({}, SETTING_DEFAULTS, cur || {});
        document.getElementById('settingsFields').innerHTML = SETTING_GROUPS.map(([t, ks]) => `<h4 style="font-family:var(--font-display);font-size:18px;color:var(--purple-deep);margin:20px 0 12px">${t}</h4><div class="form-row">${ks.map(k => k === 'aboutStory' ? `<div class="form-group" style="grid-column:1/-1"><label class="form-label">Our Story (blank line = new paragraph)</label><textarea class="form-input" rows="6" data-key="${k}">${esc(S[k])}</textarea></div>` : /Photo$/.test(k) ? `<div class="form-group" style="grid-column:1/-1"><label class="form-label">${SETTING_LABEL(k)} (optional)</label><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="leader-avatar" id="photoPrev_${k}" style="margin:0;width:72px;height:72px">${S[k] ? `<img src="${esc(S[k])}" alt="" style="width:100%;height:100%;object-fit:cover">` : '<i data-lucide="user"></i>'}</div><input type="hidden" data-key="${k}" value="${esc(S[k])}"><button type="button" class="btn btn-purple btn-sm" onclick="openDrivePicker('${k}')"><i data-lucide="hard-drive"></i> Google Drive</button><button type="button" class="btn btn-outline-purple btn-sm" onclick="pickPhotoFile('${k}')"><i data-lucide="upload"></i> Upload</button><button type="button" class="btn btn-ghost btn-sm" onclick="setLeaderPhoto('${k}','')">Remove</button></div></div>` : `<div class="form-group"><label class="form-label">${SETTING_LABEL(k)}</label><input class="form-input" data-key="${k}"${/Link$/.test(k) ? ' type="url" placeholder="https:\/\/zoom.us/j/..."' : k === 'rsvpNotifyEmail' ? ' type="email" multiple' : ''} value="${esc(/Time$/.test(k) ? t12(S[k]) : S[k])}"></div>`).join('')}</div>`).join('');
      };
      render(window.churchSettings); lucide.createIcons();
      if (isBackendAvailable()) google.script.run.withSuccessHandler(function(s) { window.churchSettings = s; render(s); lucide.createIcons(); }).getSettings(authToken);
    }

    function saveSettings(e) {
      e.preventDefault();
      const data = {}; document.querySelectorAll('#settingsFields [data-key]').forEach(el => data[el.dataset.key] = el.value.trim());
      if (Object.keys(data).some(k => /Link$/.test(k) && data[k] && !isHttp(data[k]))) { showToast('Online links must start with https:\/\/', 'error'); return; }
      const done = function() { window.churchSettings = Object.assign({}, window.churchSettings, data); applySettings(); showToast('Settings saved - the website is updated', 'success'); };
      if (!isBackendAvailable()) { done(); return; }
      google.script.run.withSuccessHandler(function(r) { r.success ? done() : showToast(r.message || 'Failed to save settings', 'error'); }).withFailureHandler(function(er) { showToast('Error: ' + er.message, 'error'); }).updateSettings(authToken, data);
    }

    function changeAdminPassword(e) {
      e.preventDefault();
      const currentPass = document.getElementById('currentPassword').value;
      const newPass = document.getElementById('newPassword').value;
      const confirmPass = document.getElementById('confirmPassword').value;
      
      if (newPass !== confirmPass) {
        showToast('Passwords do not match', 'error');
        return;
      }
      
      if (newPass.length < 10 || !/[A-Za-z]/.test(newPass) || !/[0-9]/.test(newPass)) {
        showToast('Password needs 10+ characters with a letter and a number', 'error');
        return;
      }
      
      if (isBackendAvailable() && currentUser) {
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showToast('Password changed successfully', 'success');
              if (result.token) { authToken = result.token; currentUser.mustChange = false; ChurchApi.setSession(result.token, currentUser); }
              document.getElementById('passwordForm').reset(); closeModal('passwordModal');
            } else {
              showToast(result.message || 'Failed to change password', 'error');
            }
          })
          .withFailureHandler(function(error) {
            showToast('Error: ' + error.message, 'error');
          })
          .changePassword(authToken, currentPass, newPass);
      } else {
        showToast('Password changed successfully (demo mode)', 'success');
        document.getElementById('passwordForm').reset(); closeModal('passwordModal');
      }
    }

    function loadPublicData() {
      renderFlyerStrips();
      loadEventsList();
      loadSermons();
      loadNotices();
      loadPrayerRequests();
    }

    function initCalendar() {
      renderCalendar();
    }

    function renderCalendar() {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      
      document.getElementById('calendarTitle').textContent = `${monthNames[month]} ${year}`;
      
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay();
      const daysInMonth = lastDay.getDate();
      
      const today = new Date();
      const todayStr = localDate(today);
      
      let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => 
        `<div class="calendar-day-header">${d}</div>`
      ).join('');
      
      const prevMonth = new Date(year, month, 0);
      for (let i = startDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month"><span class="day-number">${prevMonth.getDate() - i}</span></div>`;
      }
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = allEvents.filter(e => e.date === dateStr && e.active === 'TRUE');
        const isToday = dateStr === todayStr;
        const hasEvent = dayEvents.length > 0;
        
        const tip = dayEvents.map(e => e.title + (e.time ? ' - ' + formatTime(e.time) : '')).join('\n');
        html += `
          <div class="calendar-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}" onclick="showDayEvents('${dateStr}')" ${hasEvent ? `title="${esc(tip)}"` : ''}>
            <span class="day-number">${day}</span>
            ${hasEvent ? '<div class="day-chips">' + dayEvents.slice(0, 2).map(e => `<span class="day-chip">${esc(e.title)}</span>`).join('') + (dayEvents.length > 2 ? `<span class="day-more">+${dayEvents.length - 2} more</span>` : '') + '</div><div class="day-events">' + dayEvents.slice(0, 3).map(() => '<span class="event-dot"></span>').join('') + '</div>' : ''}
          </div>
        `;
      }
      
      const remainingDays = 42 - (startDay + daysInMonth);
      for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
      }
      
      document.getElementById('calendarGrid').innerHTML = html;
    }

    function changeMonth(delta) {
      currentDate.setMonth(currentDate.getMonth() + delta);
      renderCalendar();
    }

    function showDayEvents(dateStr) {
      const dayEvents = allEvents.filter(e => e.date === dateStr && e.active === 'TRUE');
      if (dayEvents.length > 0) {
        const eventListEl = document.getElementById('eventList');
        eventListEl.innerHTML = dayEvents.map(e => renderEventCard(e)).join('');
        eventListEl.scrollIntoView({ behavior: 'smooth' });
        lucide.createIcons();
      }
    }

    function loadEventsList() {
      const today = localDate();
      const upcomingEvents = allEvents
        .filter(e => e.date >= today && e.active === 'TRUE')
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const eventListEl = document.getElementById('eventList');
      if (eventListEl) {
        eventListEl.innerHTML = upcomingEvents.length ? 
          upcomingEvents.map(e => renderEventCard(e)).join('') :
          '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="calendar-x"></i></div><div class="empty-state-title">No Upcoming Events</div><div class="empty-state-text">Check back soon for new events!</div></div>';
        lucide.createIcons();
      }
    }

    function renderEventCard(event) {
      const date = parseLocal(event.date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `
        <div class="event-card">
          <div class="event-date-box">
            <div class="event-date-day">${date.getDate()}</div>
            <div class="event-date-month">${months[date.getMonth()]}</div>
          </div>
          <div class="event-info">
            <span class="event-category">${event.category || 'Event'}</span>
            <h3 class="event-title">${esc(event.title)}</h3>
            <div class="event-meta">
              ${event.time ? `<span class="event-meta-item"><i data-lucide="clock"></i> ${formatTime(event.time)}${event.endtime ? ' – ' + formatTime(event.endtime) : ''}</span>` : ''}
              ${event.location ? `<span class="event-meta-item"><i data-lucide="map-pin"></i> ${esc(event.location)}</span>` : ''}
              ${isHttp(event.link) ? `<a class="event-join" href="${esc(event.link)}" target="_blank" rel="noopener"><i data-lucide="video"></i> Join Online</a>` : ''}
              ${event.flyer ? `<a class="event-join" style="cursor:pointer" onclick="downloadFlyer('${event.id}')"><i data-lucide="download"></i> Download Flyer</a>` : ''}
            </div>
          </div>
          ${event.flyer ? `<img class="event-flyer-thumb" src="${esc(event.flyer)}" alt="Flyer" loading="lazy" onclick="openFlyer('${event.id}')">` : ''}
          <div class="event-actions"><button class="event-rsvp-btn" onclick="openRSVPModal('${event.id}')">RSVP</button><button type="button" class="share-link" onclick="shareEvent('${event.id}')" aria-label="Share this event on WhatsApp"><i data-lucide="share-2"></i> Share</button></div>
        </div>
      `;
    }

    function openRSVPModal(eventId) {
      const ev = allEvents.find(x => x.id === eventId); const eventTitle = ev ? ev.title : '';
      document.getElementById('rsvpEventId').value = eventId;
      document.getElementById('rsvpEventTitle').textContent = `Event: ${eventTitle}`;
      document.getElementById('rsvpForm').reset();
      openModal('rsvpModal');
    }

    function loadSermons() {
      const activeSermons = allSermons.filter(s => s.active === 'TRUE');
      renderSermons(activeSermons);
    }

    function renderSermons(sermons) {
      const sermonGridEl = document.getElementById('sermonGrid');
      if (sermonGridEl) {
        sermonGridEl.innerHTML = sermons.length ?
          sermons.map(s => `
            <div class="sermon-card">
              <div class="sermon-thumbnail" onclick="playSermon('${s.id}')" style="cursor: pointer;${ytId(s.videourl) ? 'background: linear-gradient(rgba(74,29,110,.3), rgba(74,29,110,.3)), url(https:\/\/img.youtube.com/vi/' + ytId(s.videourl) + '/hqdefault.jpg) center/cover;' : ''}">
                <div class="sermon-play-btn"><i data-lucide="play"></i></div>
                ${!s.videourl ? '<div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">Video coming soon</div>' : ''}
              </div>
              <div class="sermon-content">
                ${s.scripture ? `<span class="sermon-scripture">${esc(s.scripture)}</span>` : ''}
                <h3 class="sermon-title">${esc(s.title)}</h3>
                <div class="sermon-meta">
                  <span class="sermon-speaker"><i data-lucide="user"></i> ${esc(s.speaker)}</span>
                  <span>${formatDate(s.date)}</span>
                </div>
                ${s.videourl ? `<a href="${esc(s.videourl)}" target="_blank" class="btn btn-sm btn-outline-purple" style="margin-top: 12px; text-decoration: none;"><i data-lucide="external-link"></i> Watch on ${getVideoPlatform(s.videourl)}</a>` : ''}
              </div>
            </div>
          `).join('') :
          '<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-state-icon"><i data-lucide="video-off"></i></div><div class="empty-state-title">No Sermons Found</div></div>';
        lucide.createIcons();
      }
    }

    function getVideoPlatform(url) {
      if (!url) return '';
      if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
      if (url.includes('vimeo.com')) return 'Vimeo';
      if (url.includes('facebook.com')) return 'Facebook';
      return 'External Site';
    }

    function getEmbedUrl(url) {
      if (!url) return null;
      const yid = ytId(url); if (yid) return 'https:\/\/www.youtube.com/embed/' + yid + '?rel=0';
      
      if (url.includes('youtube.com/watch')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        if (videoId) return `https:\/\/www.youtube.com/embed/${videoId}`;
      }
      if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        if (videoId) return `https:\/\/www.youtube.com/embed/${videoId}`;
      }
      
      if (url.includes('vimeo.com/')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        if (videoId) return `https:\/\/player.vimeo.com/video/${videoId}`;
      }
      
      return null;
    }

    function playSermon(sermonId) {
      const sermon = allSermons.find(s => s.id === sermonId);
      if (!sermon) return;
      
      document.getElementById('videoModalTitle').textContent = 'Watch Sermon';
      document.getElementById('videoSermonTitle').textContent = sermon.title;
      document.getElementById('videoSermonSpeaker').innerHTML = `<i data-lucide="user" style="width: 16px; height: 16px; vertical-align: middle;"></i> ${esc(sermon.speaker)}`;
      document.getElementById('videoSermonDate').innerHTML = `<i data-lucide="calendar" style="width: 16px; height: 16px; vertical-align: middle;"></i> ${formatDate(sermon.date)}`;
      document.getElementById('videoSermonScripture').innerHTML = sermon.scripture ? `<i data-lucide="book-open" style="width: 16px; height: 16px; vertical-align: middle;"></i> ${esc(sermon.scripture)}` : '';
      document.getElementById('videoSermonNotes').textContent = sermon.notes || '';
      
      const videoContainer = document.getElementById('videoContainer');
      const externalLink = document.getElementById('videoExternalLink');
      
      if (sermon.videourl) {
        const embedUrl = getEmbedUrl(sermon.videourl);
        
        if (embedUrl) {
          videoContainer.innerHTML = `
            <iframe 
              src="${embedUrl}" 
              style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen>
            </iframe>
          `;
          videoContainer.style.display = 'block';
          externalLink.innerHTML = `
            <a href="${esc(sermon.videourl)}" target="_blank" class="btn btn-sm btn-outline-purple" style="text-decoration: none;">
              <i data-lucide="external-link"></i> Open in ${getVideoPlatform(sermon.videourl)}
            </a>
          `;
        } else {
          videoContainer.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: white;">
              <i data-lucide="video" style="width: 64px; height: 64px; margin-bottom: 16px; opacity: 0.5;"></i>
              <p>Video available on external platform</p>
            </div>
          `;
          videoContainer.style.display = 'block';
          externalLink.innerHTML = `
            <a href="${esc(sermon.videourl)}" target="_blank" class="btn btn-purple" style="text-decoration: none;">
              <i data-lucide="external-link"></i> Watch on ${getVideoPlatform(sermon.videourl)}
            </a>
          `;
        }
      } else {
        videoContainer.innerHTML = `
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: white;">
            <i data-lucide="mic" style="width: 64px; height: 64px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>Video not available yet</p>
          </div>
        `;
        videoContainer.style.display = 'block';
        externalLink.innerHTML = '<p style="color: var(--gray-500); font-size: 14px;">No video link available for this sermon. Contact the church office for audio recordings.</p>';
      }
      
      openModal('videoModal');
      lucide.createIcons();
    }

    function closeVideoModal() {
      document.getElementById('videoContainer').innerHTML = '';
      closeModal('videoModal');
    }

    function filterSermons() {
      const search = document.getElementById('sermonSearch').value.toLowerCase();
      let filtered = allSermons.filter(s => s.active === 'TRUE');
      
      if (search) {
        filtered = filtered.filter(s =>
          s.title.toLowerCase().includes(search) ||
          s.speaker.toLowerCase().includes(search) ||
          (s.scripture && s.scripture.toLowerCase().includes(search))
        );
      }
      
      if (currentSermonFilter !== 'all') {
        filtered = filtered.filter(s => s.category === currentSermonFilter);
      }
      
      renderSermons(filtered);
    }

    function filterSermonCategory(category) {
      currentSermonFilter = category;
      document.querySelectorAll('#sermonTabs .tab-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      filterSermons();
    }

    function loadNotices() {
      const today = localDate();
      const activeNotices = allNotices
        .filter(n => n.active === 'TRUE' && (!n.enddate || n.enddate >= today))
        .sort((a, b) => {
          const priority = { 'Urgent': 0, 'High': 1, 'Normal': 2, 'Low': 3 };
          return priority[a.priority] - priority[b.priority];
        });
      
      const noticeListEl = document.getElementById('noticeList');
      if (noticeListEl) {
        noticeListEl.innerHTML = activeNotices.length ?
          activeNotices.map(n => `
            <div class="notice-card ${n.priority.toLowerCase()}">
              <div class="notice-header">
                <h3 class="notice-title">${esc(n.title)}</h3>
                <span class="notice-badge ${n.priority.toLowerCase()}">${n.priority}</span>
              </div>
              ${n.audience === 'Members' ? '<div class="members-tag"><i data-lucide="lock"></i> Members only</div>' : ''}
              <p class="notice-content">${esc(n.content)}</p>
              <div class="notice-date">Posted: ${formatDate(n.startdate)} ${n.audience === 'Members' ? '' : `<button type="button" class="share-link" onclick="shareNotice('${n.id}')"><i data-lucide="share-2"></i> Share</button>`}</div>
            </div>
          `).join('') :
          '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="bell-off"></i></div><div class="empty-state-title">No Current Notices</div></div>';
        lucide.createIcons();
      }
    }

    function loadPrayerRequests() {
      const activePrayers = allPrayers.filter(p => p.status === 'Active');
      const prayerListEl = document.getElementById('prayerList');
      if (prayerListEl) {
        prayerListEl.innerHTML = activePrayers.length ?
          activePrayers.map(p => `
            <div class="prayer-card">
              <div class="prayer-header">
                <div class="prayer-icon"><i data-lucide="heart"></i></div>
                <div>
                  <div class="prayer-name">${esc(p.name)}</div>
                  <div class="prayer-date">${formatDate(p.date)}</div>
                </div>
              </div>
              <p class="prayer-text">${esc(p.request)}</p>
            </div>
          `).join('') :
          '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="heart"></i></div><div class="empty-state-title">No Prayer Requests</div><div class="empty-state-text">Be the first to share a prayer request.</div></div>';
        lucide.createIcons();
      }
    }

    function submitPrayerRequest(e) {
      e.preventDefault();
      const name = document.getElementById('prayerName').value || 'Anonymous';
      const email = document.getElementById('prayerEmail').value;
      const request = document.getElementById('prayerRequest').value;
      const anonymous = document.getElementById('prayerAnonymous').checked;
      
      const requestData = {
        name: anonymous ? 'Anonymous' : name,
        email: email,
        request: request,
        anonymous: anonymous
      };
      
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showToast('Prayer request received. It will appear on the prayer wall once approved.', 'success');
              document.getElementById('prayerForm').reset();
              refreshPrayers();
            } else {
              showToast(result.message || 'Failed to submit prayer request', 'error');
            }
          })
          .withFailureHandler(function(error) {
            showToast('Error: ' + error.message, 'error');
          })
          .submitPrayerRequest(requestData);
      } else {
        const newPrayer = {
          id: Date.now().toString(),
          name: requestData.name,
          email: requestData.email,
          request: requestData.request,
          date: localDate(),
          anonymous: anonymous ? 'TRUE' : 'FALSE',
          status: 'Pending'
        };
        
        allPrayers.unshift(newPrayer);
        document.getElementById('prayerForm').reset();
        loadPrayerRequests();
        showToast('Prayer request received. It will appear on the prayer wall once approved. (demo mode)', 'success');
      }
    }

    function refreshPrayers() {
      if (!isBackendAvailable()) { loadPrayerRequests(); return; }
      const ok = function(d) { allPrayers = d || []; loadPrayerRequests(); if (authToken) loadAdminPrayers(); };
      if (authToken) google.script.run.withSuccessHandler(ok).getPrayerRequests(authToken);
      else google.script.run.withSuccessHandler(function(d) { ok(d.prayers); }).getPublicData();
    }

    function updatePrayerStatus(id, newStatus) {
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showToast('Prayer request updated', 'success');
              refreshPrayers();
            } else {
              showToast(result.message || 'Failed to update', 'error');
            }
          })
          .withFailureHandler(function(error) {
            showToast('Error: ' + error.message, 'error');
          })
          .updatePrayerRequest(authToken, id, newStatus, '');
      } else {
        const prayer = allPrayers.find(p => p.id === id);
        if (prayer) {
          prayer.status = newStatus;
          loadAdminPrayers();
          showToast('Prayer request updated (demo mode)', 'success');
        }
      }
    }

    function submitMembershipForm(e) {
      e.preventDefault();
      const memberData = {
        firstName: document.getElementById('memberFirstName').value,
        lastName: document.getElementById('memberLastName').value,
        email: document.getElementById('memberEmail').value,
        phone: document.getElementById('memberPhone').value,
        address: document.getElementById('memberAddress').value,
        dateOfBirth: document.getElementById('memberDOB').value,
        familyGroup: document.getElementById('memberFamily').value,
        ministry: getMinistries('memberMinistry'),
        occupation: document.getElementById('memberOccupation').value.trim(),
        joinDate: document.getElementById('memberJoined').value,
        familyMembers: collectKin()
      };
      
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showToast(result.message || 'Thank you! A church leader will review your registration.', 'success');
              if (result.pending !== false && window.ChurchUI) ChurchUI.registrationSent(memberData.email);
              document.getElementById('membershipForm').reset(); toggleKin(); toggleJoined();
            } else {
              showToast(result.message || 'Registration failed', 'error');
            }
          })
          .withFailureHandler(function(error) {
            showToast('Error: ' + error.message, 'error');
          })
          .registerMember(memberData);
      } else {
        const localData = {
          id: Date.now().toString(),
          firstname: memberData.firstName,
          lastname: memberData.lastName,
          email: memberData.email,
          phone: memberData.phone,
          address: memberData.address,
          dateofbirth: memberData.dateOfBirth,
          familygroup: memberData.familyGroup, occupation: memberData.occupation || '', ministry: memberData.ministry, relationship: memberData.relationship || '',
          status: 'Active',
          joindate: memberData.joinDate || localDate(), registered: localDate(), notes: ''
        };
        
        const kin = memberData.familyMembers || [];
        if (kin.length) { localData.householdid = localData.id; localData.relationship = 'Head of household'; }
        allMembers.push(localData);
        kin.forEach((f, i) => allMembers.push({id: localData.id + 'k' + i, firstname: f.firstName, lastname: f.lastName || memberData.lastName, email: f.email || '', occupation: f.occupation || '', phone: '', status: 'Active', joindate: memberData.joinDate || localDate(), registered: localDate(), familygroup: memberData.familyGroup, ministry: '', householdid: localData.id, relationship: f.relationship || 'Other', dateofbirth: f.dateOfBirth || ''}));
        document.getElementById('membershipForm').reset(); toggleKin(); toggleJoined(); toggleKin();
        showToast('Registration successful! Welcome to The Christian Sanctuary. (demo mode)', 'success');
      }
    }

    function submitContactForm(e) {
      e.preventDefault();
      const g = id => document.getElementById(id).value.trim(), form = e.target, btn = form.querySelector('button[type=submit]');
      const d = {name: g('cfName'), email: g('cfEmail'), subject: g('cfSubject'), message: g('cfMessage')};
      const done = function() { showToast('Message sent! We will get back to you soon.', 'success'); form.reset(); };
      if (!isBackendAvailable()) { allMessages.unshift(Object.assign({id: Date.now().toString(), date: localDate(), status: 'New'}, d)); done(); return; }
      btn.disabled = true;
      google.script.run.withSuccessHandler(function(r) { btn.disabled = false; r.success ? done() : showToast(r.message, 'error'); }).withFailureHandler(function(er) { btn.disabled = false; showToast('Error: ' + er.message, 'error'); }).submitContactMessage(d);
    }

    function submitRSVP(e) {
      e.preventDefault();
      const eventId = document.getElementById('rsvpEventId').value;
      const name = document.getElementById('rsvpName').value;
      const email = document.getElementById('rsvpEmail').value;
      const phone = document.getElementById('rsvpPhone').value.trim();
      
      if (isBackendAvailable()) {
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showToast('RSVP confirmed! We look forward to seeing you.', 'success');
              closeModal('rsvpModal');
            } else {
              showToast(result.message || 'RSVP failed', 'error');
            }
          })
          .withFailureHandler(function(error) {
            showToast('Error: ' + error.message, 'error');
          })
          .rsvpEvent(eventId, name, email, phone);
      } else {
        const norm = v => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
        if (allRsvps.some(r => r.eventid === eventId && norm(r.name) === norm(name) && norm(r.email) === norm(email))) { showToast("You have already RSVP'd for this event with that name and email.", 'error'); return; }
        const ev = allEvents.find(x => x.id === eventId) || {};
        allRsvps.push({id: Date.now().toString(), eventid: eventId, eventtitle: ev.title || '', name: name, email: email, phone: phone, date: localDate()});
        showToast('RSVP confirmed! We look forward to seeing you. (demo mode)', 'success');
        closeModal('rsvpModal');
      }
    }

    let deleteCallback = null;

    function confirmDelete(type, id) {
      const messages = {
        member: 'Are you sure you want to delete this member?',
        event: 'Are you sure you want to delete this event?',
        sermon: 'Are you sure you want to delete this sermon?',
        notice: 'Are you sure you want to delete this notice?',
        prayer: 'Are you sure you want to delete this prayer request?',
        user: 'Are you sure you want to delete this admin user?'
      };
      
      document.getElementById('confirmMessage').textContent = messages[type] || 'Are you sure?';
      
      deleteCallback = function() {
        if (isBackendAvailable()) {
          let deleteFunc;
          let refreshFunc;
          
          switch(type) {
            case 'member':
              deleteFunc = 'deleteMember';
              refreshFunc = refreshMembers;
              break;
            case 'event':
              deleteFunc = 'deleteEvent';
              refreshFunc = refreshEvents;
              break;
            case 'sermon':
              deleteFunc = 'deleteSermon';
              refreshFunc = refreshSermons;
              break;
            case 'notice':
              deleteFunc = 'deleteNotice';
              refreshFunc = refreshNotices;
              break;
            case 'prayer':
              deleteFunc = 'deletePrayerRequest';
              refreshFunc = refreshPrayers;
              break;
            case 'user':
              deleteFunc = 'deleteUser';
              refreshFunc = refreshUsers;
              break;
          }
          
          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                showToast('Deleted successfully', 'success');
                closeModal('confirmModal');
                if (refreshFunc) refreshFunc();
              } else {
                showToast(result.message || 'Delete failed', 'error');
              }
            })
            .withFailureHandler(function(error) {
              showToast('Error: ' + error.message, 'error');
            })[deleteFunc](authToken, id);
        } else {
          switch(type) {
            case 'member':
              allMembers = allMembers.filter(m => m.id !== id);
              loadAdminMembers();
              break;
            case 'event':
              allEvents = allEvents.filter(e => e.id !== id);
              loadAdminEvents();
              renderCalendar();
              break;
            case 'sermon':
              allSermons = allSermons.filter(s => s.id !== id);
              loadAdminSermons();
              break;
            case 'notice':
              allNotices = allNotices.filter(n => n.id !== id);
              loadAdminNotices();
              break;
            case 'prayer':
              allPrayers = allPrayers.filter(p => p.id !== id);
              loadAdminPrayers();
              break;
            case 'user':
              if (allUsers.filter(u => u.active === 'TRUE').length <= 1) {
                showToast('Cannot delete the last active admin', 'error');
                return;
              }
              allUsers = allUsers.filter(u => u.id !== id);
              loadAdminUsers();
              break;
          }
          showToast('Deleted successfully (demo mode)', 'success');
          closeModal('confirmModal');
        }
      };
      
      document.getElementById('confirmDeleteBtn').onclick = deleteCallback;
      openModal('confirmModal');
    }

    function openModal(modalId) {
      document.getElementById(modalId).classList.add('active');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
    }

    function closeModal(modalId) {
      document.getElementById(modalId).classList.remove('active');
      document.body.style.overflow = '';
    }

    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = parseLocal(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatTime(t) {
      const m = String(t || '').match(/(\d{1,2}):(\d{2})/); if (!m) return t || '';
      const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
    }

    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      
      const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
      toast.innerHTML = `
        <i data-lucide="${icons[type]}" class="toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()"><i data-lucide="x"></i></button>
      `;
      
      container.appendChild(toast);
      lucide.createIcons();
      
      setTimeout(() => toast.remove(), 5000);
    }
