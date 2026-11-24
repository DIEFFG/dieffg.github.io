/* ui.js - everything the installable app adds on top of the original page:
   member sign in (emailed code), bell + alerts, approvals, send-an-alert, WhatsApp share links,
   offline notices, install help, service worker. Loaded last so it can replace the old email-only member check. */
(function () {
  'use strict';
  var A = window.ChurchApi, CFG = window.CHURCH_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var APP_URL = location.origin + (CFG.appPath || '/church/');
  var deferredInstall = null, pendingFlyer = null, jpMode = 'visit', bellTimer = null, unread = 0, feed = [];
  var STAFF = ['coordinator', 'admin', 'super'];
  function sess() { return A.session(); }
  function isStaff(u) { return !!u && STAFF.indexOf(u.role) >= 0; }
  function isAdminU(u) { return !!u && (u.role === 'admin' || u.role === 'super'); }
  function churchName() { return (window.churchSettings && churchSettings.churchName) || 'The Christian Sanctuary'; }
  function icons() { try { lucide.createIcons(); } catch (e) { /* ignore */ } }
  function toast(m, t) { if (window.showToast) showToast(m, t || 'info'); }
  function eh(s) { return window.esc ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }

  // ================= member prompt + emailed-code sign in =================
  window.maybeShowJoinPrompt = function () {
    if (!A.configured || sess()) return;
    if (Number(A.store.get('join_snooze') || 0) > Date.now()) return;
    var pub = $('publicSite'); if (!pub || pub.style.display === 'none') return;
    window.openJoinPrompt('visit');
  };
  window.openJoinPrompt = function (mode) {
    jpMode = mode || 'visit';
    var t = $('jpTitle'), p = $('jpText');
    if (jpMode === 'download') { t.textContent = 'Members can download flyers'; p.textContent = 'Sign in with the email you registered with to download this flyer. Not a member yet? Registering only takes a minute.'; }
    else if (jpMode === 'signin') { t.textContent = 'Member sign in'; p.textContent = 'We will email you a 6-digit code. No password needed.'; }
    else { t.textContent = 'Welcome! Join our church family'; p.textContent = "We'd love to have you as a member. If you haven't registered yet, it only takes a minute. Already a member? Sign in to see members-only notices and download flyers."; }
    jpBackSteps();
    var direct = jpMode === 'download' || jpMode === 'signin';
    $('jpMain').style.display = direct ? 'none' : 'flex'; $('jpVerify').style.display = direct ? 'block' : 'none';
    $('jpLater').style.display = jpMode === 'visit' ? '' : 'none';
    openModal('joinPromptModal');
    if (direct) setTimeout(function () { $('jpEmail').focus(); }, 100);
  };
  function jpBackSteps() { $('jpStep1').style.display = 'block'; $('jpStep2').style.display = 'none'; $('jpCode').value = ''; }
  window.jpBack = function () { jpBackSteps(); $('jpEmail').focus(); };
  window.showJpVerify = function () { $('jpMain').style.display = 'none'; $('jpVerify').style.display = 'block'; $('jpEmail').focus(); };
  window.closeJoinPrompt = function (snooze) {
    if (snooze && jpMode === 'visit') A.store.set('join_snooze', String(Date.now() + 7 * 864e5));   // hidden for 7 days after "Remind me later"
    pendingFlyer = null; closeModal('joinPromptModal');
  };
  window.registerFromPrompt = function () { closeModal('joinPromptModal'); showPage('membership'); };
  window.verifyMemberUI = function (e) {
    e.preventDefault();
    var email = $('jpEmail').value.trim(), step2 = $('jpStep2').style.display !== 'none';
    var b1 = $('jpBtn'), b2 = $('jpBtn2');
    if (!step2) {
      b1.disabled = true;
      A.call('requestMemberCode', [email]).then(function (r) {
        b1.disabled = false;
        if (!r.success) { toast(r.message, 'error'); return; }
        $('jpSent').textContent = 'If ' + email + ' belongs to an approved member, a code is on its way. It works for 10 minutes. Check your spam folder too.';
        $('jpStep1').style.display = 'none'; $('jpStep2').style.display = 'block'; $('jpCode').focus();
      }).catch(function (er) { b1.disabled = false; toast(er.network ? 'You are offline. Connect to the internet to sign in.' : er.message, 'error'); });
      return;
    }
    b2.disabled = true;
    A.call('verifyMemberCode', [email, $('jpCode').value.trim()]).then(function (r) {
      b2.disabled = false;
      if (!r.success) { toast(r.message, 'error'); return; }
      A.setSession(r.token, r.user);
      closeModal('joinPromptModal');
      toast('Welcome' + (r.user.name ? ', ' + r.user.name.split(' ')[0] : '') + '!', 'success');
      afterSignIn();
      if (pendingFlyer) { var id = pendingFlyer; pendingFlyer = null; window.downloadFlyer(id); }
    }).catch(function (er) { b2.disabled = false; toast(er.network ? 'You are offline. Connect to the internet to sign in.' : er.message, 'error'); });
  };
  function registrationSent(email) {
    viewItem('Thank you!', '<p style="font-size:16px;line-height:1.6">Your registration has been received.</p><p style="font-size:16px;line-height:1.6;margin-top:10px">A church leader will approve it, and we will email <strong>' + eh(email) + '</strong> as soon as that is done. Then tap <strong>Member sign in</strong> and we will send you a code.</p>');
  }

  // ================= flyer download (members only, checked on the server) =================
  window.downloadFlyer = function (id) {
    var ev = (window.allEvents || []).find(function (x) { return x.id === id; }); if (!ev || !ev.flyer) return;
    var save = function (href, name) { var a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    if (!A.configured) { save(ev.flyer, (ev.title || 'flyer') + '.jpg'); return; }
    if (!sess()) { pendingFlyer = id; window.openJoinPrompt('download'); return; }
    toast('Preparing your download...', 'info');
    A.call('getFlyerDownload', [id]).then(function (r) {
      if (!r.success) { toast(r.message, 'error'); return; }
      var bin = atob(r.data), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var ext = (r.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), url = URL.createObjectURL(new Blob([arr], { type: r.mime }));
      save(url, String(ev.title || 'event').replace(/[^\w\- ]/g, '') + '-flyer.' + ext); setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('Flyer downloaded', 'success');
    }).catch(function (er) {
      if (er.code === 'auth') { pendingFlyer = id; window.openJoinPrompt('download'); toast('Please sign in again.', 'error'); }
      else toast(er.network ? 'You are offline. Flyers can be downloaded when you are connected.' : er.message, 'error');
    });
  };

  // ================= WhatsApp share (only opens a share link; nothing is sent automatically) =================
  function wa(text) { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'); }
  window.shareEvent = function (id) {
    var e = (window.allEvents || []).find(function (x) { return x.id === id; }); if (!e) return;
    wa(churchName() + '\n' + e.title + ' - ' + formatDate(e.date) + (e.time ? ' at ' + formatTime(e.time) : '') + (e.location ? '\n' + e.location : '') + '\n' + APP_URL);
  };
  window.shareNotice = function (id) {
    var n = (window.allNotices || []).find(function (x) { return x.id === id; }); if (!n || n.audience === 'Members') return;
    wa(churchName() + ' notice: ' + n.title + '\n' + String(n.content || '').slice(0, 200) + '\n' + APP_URL);
  };
  window.shareApp = function () { wa('Join us at ' + churchName() + '. Events, sermons, notices and prayer in one place:\n' + APP_URL); };

  // ================= nav: sign in / bell / install =================
  function refreshAuthUI() {
    var s = sess(), nav = $('memberNav'); if (!nav) return;
    var html = '';
    html += '<button type="button" class="bell-btn" aria-label="Alerts" onclick="ChurchUI.openBell()"><i data-lucide="bell"></i><span class="bell-count" id="bellCount" hidden></span></button>';
    if (A.configured) {
      if (s && s.user) html += '<button type="button" class="nav-user" onclick="ChurchUI.accountMenu()"><i data-lucide="user"></i> ' + eh((s.user.name || 'Me').split(' ')[0]) + '</button>';
      else html += '<button type="button" onclick="openJoinPrompt(\'signin\')"><i data-lucide="log-in"></i><span class="lbl-sm"> Member sign in</span></button>';
    }
    html += '<button type="button" title="Share on WhatsApp" onclick="shareApp()" aria-label="Share on WhatsApp"><i data-lucide="share-2"></i><span class="lbl"> Share</span></button>';
    if (!inStandalone()) html += '<button type="button" title="Install app" aria-label="Install app" onclick="ChurchUI.install()"><i data-lucide="download"></i><span class="lbl"> Install app</span></button>';
    nav.innerHTML = html;
    var ab = $('adminBell'); if (ab) ab.innerHTML = s ? '<button type="button" class="bell-btn" aria-label="Alerts" onclick="ChurchUI.openBell()" style="position:relative"><i data-lucide="bell"></i><span class="bell-count" id="bellCount2" hidden></span></button>' : '';
    paintCount(); icons();
  }
  function paintCount() {
    ['bellCount', 'bellCount2'].forEach(function (id) { var el = $(id); if (!el) return; el.hidden = !(unread > 0 && sess()); el.textContent = unread > 9 ? '9+' : String(unread); });
  }
  function accountMenu() {
    var s = sess(); if (!s) return;
    viewItem('Your account', '<p style="font-size:16px;margin-bottom:14px"><strong>' + eh(s.user.name) + '</strong><br><span style="color:var(--gray-500)">' + eh(s.user.email) + '</span></p>' +
      '<div style="display:flex;flex-direction:column;gap:10px"><button class="btn btn-outline-purple" style="justify-content:center" onclick="closeModal(\'viewModal\');ChurchUI.openBell()">Alerts and settings</button>' +
      '<button class="btn btn-outline-purple" style="justify-content:center" onclick="ChurchUI.signOut(false)">Sign out</button>' +
      '<button class="btn btn-ghost" style="justify-content:center" onclick="ChurchUI.signOut(true)">Sign out on all my devices</button></div>');
  }
  function signOut(everywhere) {
    closeModal('viewModal');
    var done = function () { A.clearSession(); afterSignOut(); loadDataFromBackend(); toast('Signed out', 'info'); };
    if (everywhere) A.call('logoutEverywhere', []).then(done, done); else done();
  }
  function afterSignIn() { refreshAuthUI(); startBell(); if (window.ChurchPush) ChurchPush.sync(); if (A.configured) loadDataFromBackend(); offerAlerts(); }
  function afterSignOut() { unread = 0; feed = []; stopBell(); refreshAuthUI(); if (window.ChurchPush) ChurchPush.sync(); }

  // ================= bell =================
  function timeAgo(iso) {
    var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' hours ago';
    return Math.round(s / 86400) + ' days ago';
  }
  function refreshBell(cb) {
    if (!sess() || !A.isOnline()) { if (cb) cb(); return; }
    A.call('getMyNotifications', []).then(function (r) { feed = r.items || []; unread = r.unread || 0; paintCount(); if (cb) cb(); }).catch(function () { if (cb) cb(); });
  }
  function startBell() { stopBell(); refreshBell(); bellTimer = setInterval(function () { if (!document.hidden) refreshBell(); }, 90000); }
  function stopBell() { if (bellTimer) clearInterval(bellTimer); bellTimer = null; }
  function renderBell() {
    var list = $('bellList');
    if (!sess()) { list.innerHTML = '<p style="color:var(--gray-500)">Sign in as a member to see your alerts here.</p>'; return; }
    list.innerHTML = feed.length ? feed.map(function (n, i) {
      return '<button type="button" class="bell-item' + (n.read ? '' : ' unread') + (n.urgent ? ' urgent' : '') + '" onclick="ChurchUI.openItem(' + i + ')"><strong>' + eh(n.title) + '</strong><span>' + eh(n.body) + '</span><time>' + timeAgo(n.created) + '</time></button>';
    }).join('') : '<p style="color:var(--gray-500)">Nothing new yet.</p>';
  }
  function pushBox() {
    var box = $('pushBox'), st = window.ChurchPush ? ChurchPush.state() : 'unsupported', h = '';
    if (st === 'on') {
      h = '<strong><i data-lucide="bell-ring" style="width:18px;height:18px"></i> Alerts are ON on this phone</strong>';
      if (sess()) h += '<div id="prefBox" style="margin-top:8px"></div>';
      h += '<button class="btn btn-ghost" onclick="ChurchUI.pushOff()">Turn off alerts on this phone</button>';
    } else if (st === 'off') h = 'Get a ping on this phone for urgent notices' + (sess() ? ', new events and reminders' : '') + '.<button class="btn btn-purple" onclick="ChurchUI.pushOn()"><i data-lucide="bell"></i> Turn on alerts</button>';
    else if (st === 'ios-install') h = 'On iPhone, alerts only work after you add this app to your Home Screen and open it from the icon. <a href="install.html" style="color:var(--purple-main)">Show me how</a>';
    else if (st === 'denied') h = 'Alerts are blocked for this app. You can allow them in your phone settings.';
    else if (st === 'not-configured') h = 'Phone alerts have not been switched on for this church app yet. You will still see alerts here.';
    else h = 'This browser cannot show phone alerts. You will still see alerts here.';
    box.innerHTML = h; icons();
    if (st === 'on' && sess()) A.call('getNotifPrefs', []).then(function (r) {
      var pb = $('prefBox'); if (!pb) return; var p = r.prefs || {};
      pb.innerHTML = [['notice', 'New notices'], ['event', 'New events'], ['reminder', 'Reminders for events I RSVP to'], ['digest', 'Monday summary']].map(function (x) {
        return '<label><input type="checkbox" data-pref="' + x[0] + '"' + (p[x[0]] !== false ? ' checked' : '') + ' onchange="ChurchUI.savePref(this)"> ' + x[1] + '</label>';
      }).join('') + '<p style="font-size:13px;color:var(--gray-500)">Urgent notices always come through.</p>';
    }).catch(function () {});
  }
  function openBell() { renderBell(); pushBox(); openModal('bellModal'); refreshBell(function () { renderBell(); }); }
  function openItem(i) {
    var n = feed[i]; if (!n) return;
    if (!n.read) { n.read = true; unread = Math.max(0, unread - 1); paintCount(); A.call('markNotificationsRead', [[n.id]]).catch(function () {}); }
    closeModal('bellModal'); goTo(n.link);
    if (!n.link) viewItem(n.title, '<p style="white-space:pre-line;font-size:16px;line-height:1.6">' + eh(n.body) + '</p>');
  }
  function markAllRead() { A.call('markNotificationsRead', ['all']).then(function () { feed.forEach(function (n) { n.read = true; }); unread = 0; paintCount(); renderBell(); }).catch(function (e) { toast(e.message, 'error'); }); }
  function goTo(link) {
    link = String(link || '').replace(/^.*#/, '');
    if (!link) return;
    var staff = window.currentUser && isStaff(currentUser);
    if (link === 'approvals' && staff) { showAdminPage('approvals'); return; }
    if (link === 'rsvps' && staff) { showAdminPage('events'); return; }
    if (['events', 'notices', 'sermons', 'prayer', 'home'].indexOf(link) >= 0) { if (staff && $('adminPanel').style.display !== 'none') showPublicSite(); showPage(link); }
  }
  function savePref(el) { var o = {}; o[el.dataset.pref] = el.checked; A.call('setNotifPrefs', [o]).catch(function (e) { toast(e.message, 'error'); }); }
  function pushOn() { ChurchPush.enable().then(function () { toast('Alerts are on', 'success'); pushBox(); }).catch(function (e) { toast(e.message, 'error'); pushBox(); }); }
  function pushOff() { ChurchPush.disable().then(function () { toast('Alerts are off on this phone', 'info'); pushBox(); }); }
  // gentle, one-time reminder after sign in (permission is only asked when the person taps the button)
  function offerAlerts() {
    if (!window.ChurchPush || A.store.get('push_ask') || inAdmin()) return;
    var st = ChurchPush.state(); if (st !== 'off' && st !== 'ios-install') return;
    var b = document.createElement('div'); b.className = 'alerts-banner'; b.id = 'alertsBanner';
    b.innerHTML = '<span>Get alerts for urgent notices and events on this phone?</span><button class="go" type="button">Yes, show me</button><button class="no" type="button">Not now</button>';
    b.querySelector('.go').onclick = function () { A.store.set('push_ask', '1'); b.remove(); openBell(); };
    b.querySelector('.no').onclick = function () { A.store.set('push_ask', '1'); b.remove(); };
    document.body.appendChild(b);
  }
  function inAdmin() { var p = $('adminPanel'); return !!p && p.style.display !== 'none'; }

  // ================= staff panel: roles, approvals, send an alert =================
  function injectAdminPages() {
    if ($('admin-approvals')) return;
    var content = document.querySelector('.admin-content'); if (!content) return;
    var a = document.createElement('div'); a.className = 'admin-page'; a.id = 'admin-approvals';
    a.innerHTML = '<p style="color:var(--gray-600);margin-bottom:16px">People who registered themselves. They cannot sign in until you approve them. Approving a household head approves the whole household.</p><div id="approvalList"></div>';
    var b = document.createElement('div'); b.className = 'admin-page'; b.id = 'admin-broadcast';
    b.innerHTML = '<div style="max-width:620px"><p style="color:var(--gray-600);margin-bottom:16px">Send a message to people\'s phones and their in-app alerts. The phone ping only says "New message from the church"; the full text is read inside the app.</p>' +
      '<form id="broadcastForm" onsubmit="ChurchUI.sendBroadcast(event)"><div class="form-group"><label class="form-label">Who should get it?</label><div class="radio-row">' +
      '<label><input type="radio" name="bcAud" value="members" checked> Members</label><label><input type="radio" name="bcAud" value="admins"> Administrators</label><label><input type="radio" name="bcAud" value="all"> Everyone with the app</label></div></div>' +
      '<div class="form-group"><label class="form-label" for="bcTitle">Title</label><input class="form-input" id="bcTitle" maxlength="100" required></div>' +
      '<div class="form-group"><label class="form-label" for="bcBody">Message</label><textarea class="form-input" id="bcBody" rows="5" maxlength="500" required></textarea></div>' +
      '<button class="form-submit" id="bcBtn" type="submit"><i data-lucide="send"></i> Send alert</button></form></div>';
    content.appendChild(a); content.appendChild(b);
    var sect = document.querySelector('[data-admin-page="members"]'); if (sect) {
      var l1 = document.createElement('a'); l1.className = 'sidebar-link'; l1.setAttribute('data-admin-page', 'approvals'); l1.setAttribute('onclick', "showAdminPage('approvals')"); l1.innerHTML = '<i data-lucide="user-check"></i> Approvals <span class="nav-badge" id="pendingBadge" hidden></span>';
      var l2 = document.createElement('a'); l2.className = 'sidebar-link'; l2.setAttribute('data-admin-page', 'broadcast'); l2.setAttribute('onclick', "showAdminPage('broadcast')"); l2.innerHTML = '<i data-lucide="megaphone"></i> Send an Alert';
      sect.parentNode.insertBefore(l1, sect); sect.parentNode.appendChild(l2);
    }
  }
  function applyRoleUI() {
    injectAdminPages();
    var u = window.currentUser, admin = isAdminU(u), coord = !!u && u.role === 'coordinator';
    document.querySelectorAll('.sidebar-link[data-admin-page]').forEach(function (l) {
      var p = l.getAttribute('data-admin-page'), show = admin || p === 'dashboard' || p === 'events';
      l.style.display = show ? '' : 'none';
    });
    document.querySelectorAll('.sidebar-section').forEach(function (s) {
      var any = Array.prototype.some.call(s.querySelectorAll('.sidebar-link'), function (l) { return l.style.display !== 'none'; });
      s.style.display = any ? '' : 'none';
    });
    ['statMembers', 'statSermons', 'statPrayers', 'recentMembersList', 'activeNoticesList'].forEach(function (id) {
      var el = $(id), box = el && (el.closest('.stat-card') || el.closest('.admin-card') || el.parentElement); if (box) box.style.display = coord ? 'none' : '';
    });
    var addBtn = document.querySelector('#admin-events [onclick*="openEventModal"]'); if (addBtn) addBtn.style.display = '';
    refreshAuthUI(); startBell(); updatePendingBadge();
  }
  function updatePendingBadge() {
    var n = (window.allMembers || []).filter(function (m) { return m.approval === 'Pending'; }).length, b = $('pendingBadge');
    if (b) { b.textContent = n; b.hidden = !n; }
  }
  function loadApprovals() {
    var box = $('approvalList'); if (!box) return;
    var pend = (window.allMembers || []).filter(function (m) { return m.approval === 'Pending'; });
    updatePendingBadge();
    if (!pend.length) { box.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nobody is waiting for approval</div></div>'; return; }
    var groups = {}, order = [];
    pend.forEach(function (m) { var k = m.householdid || m.id; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(m); });
    box.innerHTML = order.map(function (k) {
      var g = groups[k].sort(function (a, b) { return (b.relationship === 'Head of household') - (a.relationship === 'Head of household'); }), m = g[0];
      return '<div class="approval-card"><h4>' + eh(m.firstname) + ' ' + eh(m.lastname) + '</h4><div class="meta">' + eh(m.email) + (m.phone ? ' &middot; ' + eh(m.phone) : '') + '<br>Registered ' + formatDate(m.registered || m.joindate) + (m.ministry ? '<br>Interested in: ' + eh(String(m.ministry).replace(/;\s*/g, ', ')) : '') + '</div>' +
        (g.length > 1 ? '<div class="kin"><strong>Household:</strong> ' + g.slice(1).map(function (x) { return eh(x.firstname) + ' (' + eh(x.relationship || 'family') + ')'; }).join(', ') + '</div>' : '') +
        '<div class="acts"><button class="btn btn-purple" onclick="ChurchUI.decide(\'' + m.id + '\',true,this)"><i data-lucide="check"></i> Approve</button><button class="btn btn-outline-purple" onclick="ChurchUI.decide(\'' + m.id + '\',false,this)">Decline</button></div></div>';
    }).join('');
    icons();
  }
  function decide(id, yes, btn) {
    if (!yes && !btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = 'Tap again to decline'; setTimeout(function () { if (btn) { delete btn.dataset.sure; btn.textContent = 'Decline'; } }, 4000); return; }
    btn.disabled = true;
    A.call(yes ? 'approveMember' : 'declineMember', [id]).then(function (r) {
      toast(r.message || 'Done', r.success ? 'success' : 'error');
      return A.call('getMembers', []).then(function (m) { window.allMembers = m || []; loadApprovals(); if (window.loadAdminMembers) loadAdminMembers(); });
    }).catch(function (e) { btn.disabled = false; toast(e.network ? 'You are offline.' : e.message, 'error'); });
  }
  function loadBroadcast() { var f = $('broadcastForm'); if (f) icons(); }
  function sendBroadcast(e) {
    e.preventDefault();
    var aud = document.querySelector('input[name="bcAud"]:checked').value, btn = $('bcBtn');
    if (aud === 'all' && !btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = 'Tap again to send to EVERYONE'; setTimeout(function () { delete btn.dataset.sure; btn.innerHTML = '<i data-lucide="send"></i> Send alert'; icons(); }, 5000); return; }
    btn.disabled = true;
    A.call('notifBroadcast', [aud, $('bcTitle').value.trim(), $('bcBody').value.trim()]).then(function (r) {
      btn.disabled = false; delete btn.dataset.sure; btn.innerHTML = '<i data-lucide="send"></i> Send alert'; icons();
      toast(r.message || 'Sent', r.success ? 'success' : 'error'); if (r.success) $('broadcastForm').reset();
    }).catch(function (er) { btn.disabled = false; toast(er.network ? 'You are offline.' : er.message, 'error'); });
  }

  // ================= install =================
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('appinstalled', function () { deferredInstall = null; refreshAuthUI(); toast('App installed', 'success'); });
  function install() {
    if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(function () { deferredInstall = null; }); return; }
    location.href = 'install.html';
  }

  // ================= offline bar + queue results =================
  function paintOffline(pending) {
    var bar = $('offlineBar'); if (!bar) return;
    var off = !A.isOnline() || navigator.onLine === false;
    if (!off && !pending) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.textContent = off ? "You're offline. Saved pages still work." + (pending ? ' ' + pending + ' item(s) will be sent when you are back online.' : ' RSVPs will be sent when you are back online.') : pending + ' item(s) waiting to send...';
  }
  var lastPending = 0;
  window.addEventListener('church:online', function () { A.pendingCount().then(paintOffline); });
  window.addEventListener('church:queue', function (e) { lastPending = e.detail.pending; paintOffline(lastPending); });
  window.addEventListener('offline', function () { paintOffline(lastPending); });
  window.addEventListener('online', function () { A.pendingCount().then(paintOffline); });
  window.addEventListener('church:queue-result', function (e) {
    var d = e.detail, what = d.item.action === 'rsvpEvent' ? 'RSVP' : d.item.action === 'registerMember' ? 'registration' : d.item.action === 'submitPrayerRequest' ? 'prayer request' : 'message';
    if (d.error) toast('A saved ' + what + ' could not be sent: ' + d.error, 'error');
    else if (d.result && d.result.success === false && !d.result.duplicate) toast('A saved ' + what + ' could not be sent: ' + d.result.message, 'error');
    else toast('Your saved ' + what + ' was sent. Thank you!', 'success');
    if (d.item.action === 'registerMember' && d.result && d.result.success) registrationSent((d.item.args[0] || {}).email || 'your email');
  });
  window.addEventListener('church:signedout', function () {
    if (window.currentUser) { window.handleLogout && handleLogout(); toast('Your session ended. Please sign in again.', 'info'); }
    else { afterSignOut(); loadDataFromBackend(); }
  });

  // ================= service worker + updates + deep links =================
  var waitingSW = null;
  function applyUpdate() { if (waitingSW) waitingSW.postMessage({ type: 'SKIP_WAITING' }); else location.reload(); }
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function watch(w) { w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) { waitingSW = w; $('updateBar').hidden = false; } }); }
      if (reg.waiting && navigator.serviceWorker.controller) { waitingSW = reg.waiting; $('updateBar').hidden = false; }
      reg.addEventListener('updatefound', function () { if (reg.installing) watch(reg.installing); });
      setInterval(function () { reg.update().catch(function () {}); }, 3600000);
    }).catch(function () {});
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloading) return; reloading = true; location.reload(); });
    navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'OPEN') { goTo(e.data.url); refreshBell(); } });
  }
  var lastRefresh = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    refreshBell();
    if (Date.now() - lastRefresh > 5 * 60000 && A.configured && !inAdmin() && A.isOnline()) { lastRefresh = Date.now(); loadDataFromBackend(); }
  });

  window.ChurchUI = { applyRoleUI: applyRoleUI, afterSignIn: afterSignIn, afterSignOut: afterSignOut, registrationSent: registrationSent, loadApprovals: loadApprovals, loadBroadcast: loadBroadcast, sendBroadcast: sendBroadcast, decide: decide, openBell: openBell, openItem: openItem, markAllRead: markAllRead, accountMenu: accountMenu, signOut: signOut, install: install, pushOn: pushOn, pushOff: pushOff, savePref: savePref, applyUpdate: applyUpdate };

  function init() {
    refreshAuthUI(); registerSW(); paintOffline(0); icons();
    var s = sess(); if (s) { startBell(); }
    if (location.hash) setTimeout(function () { goTo(location.hash); }, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
