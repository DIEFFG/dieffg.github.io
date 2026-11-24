/* notify.js - turns phone alerts (push) on and off. Nothing here runs until the person taps the button. */
(function () {
  'use strict';
  var CFG = window.CHURCH_CONFIG || {}, A = window.ChurchApi, FB_VER = '10.14.1';
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  function platform() { return isIOS ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop'; }
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function configured() { var f = CFG.firebase || {}; return !!(f.projectId && f.apiKey && f.messagingSenderId && f.appId && CFG.vapidKey); }

  function state() {
    if (isIOS && !standalone) return 'ios-install';          // iPhone only allows alerts from the Home Screen icon
    if (!supported()) return 'unsupported';
    if (!configured() || !A.configured) return 'not-configured';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted' && A.store.get('push_on') === '1' && A.store.get('fcm_token')) return 'on';
    return 'off';
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load the alerts service. Check your connection.')); };
      document.head.appendChild(s);
    });
  }
  function loadFirebase() {
    if (window.firebase && firebase.messaging) return Promise.resolve();
    var base = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
    return loadScript(base + 'firebase-app-compat.js').then(function () { return loadScript(base + 'firebase-messaging-compat.js'); });
  }

  function enable() {                                         // must be called from a tap
    var st = state();
    if (st === 'ios-install') return Promise.reject(new Error('On iPhone, first add this app to your Home Screen, then open it from the icon and try again.'));
    if (st === 'unsupported') return Promise.reject(new Error('This browser cannot show alerts.'));
    if (st === 'not-configured') return Promise.reject(new Error('Alerts have not been switched on for this church app yet.'));
    if (st === 'denied') return Promise.reject(new Error('Alerts are blocked. Allow them in your phone settings for this app.'));
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Alerts were not allowed.');
      return loadFirebase();
    }).then(function () {
      if (!firebase.apps.length) firebase.initializeApp(CFG.firebase);
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return firebase.messaging().getToken({ vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg });
    }).then(function (token) {
      if (!token) throw new Error('Could not turn on alerts. Please try again.');
      A.store.set('fcm_token', token); A.store.set('push_on', '1');
      return A.call('registerDevice', [token, platform()]);
    });
  }
  function disable() {
    var token = A.store.get('fcm_token');
    A.store.del('push_on'); A.store.del('fcm_token');
    return token ? A.call('unregisterDevice', [token]).catch(function () {}) : Promise.resolve();
  }
  // after signing in or out: tell the server who this phone belongs to
  function sync() {
    var token = A.store.get('fcm_token');
    if (token && A.store.get('push_on') === '1' && 'Notification' in window && Notification.permission === 'granted') return A.call('registerDevice', [token, platform()]).catch(function () {});
    return Promise.resolve();
  }
  window.ChurchPush = { state: state, enable: enable, disable: disable, sync: sync, isIOS: isIOS, standalone: standalone };
})();
