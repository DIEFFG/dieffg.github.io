/* RECON opening splash: breathing logo, gold ring, "OPENING RECON". Shows once per browser session; tap to skip. */
(function () {
  'use strict';
  try { if (sessionStorage.getItem('reconSplash') === '1') return; sessionStorage.setItem('reconSplash', '1'); } catch (e) {}
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIN = reduce ? 900 : 2900, MAX = 6000, FADE = 650, t0 = Date.now(), done = false;

  var css = '' +
  '#reconSplash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
  'background:radial-gradient(ellipse at 50% 42%,#1f6a1b 0%,#0e3409 48%,#061a05 100%);color:#fff;opacity:1;transition:opacity ' + FADE + 'ms ease;overflow:hidden;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
  '#reconSplash.out{opacity:0;pointer-events:none}' +
  '#reconSplash:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,rgba(230,198,92,.22),transparent 55%);animation:rsGlow 3.2s ease-in-out infinite}' +
  '#reconSplash .rs-stage{position:relative;width:220px;height:220px;display:flex;align-items:center;justify-content:center}' +
  '#reconSplash .rs-logo{width:150px;height:150px;object-fit:contain;animation:rsBreath 3.2s ease-in-out infinite;filter:drop-shadow(0 0 18px rgba(230,198,92,.45));opacity:0;animation-delay:0s;animation-fill-mode:both}' +
  '#reconSplash .rs-ring{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);animation:rsSpin 24s linear infinite}' +
  '#reconSplash .rs-ring circle{fill:none;stroke:url(#rsGold);stroke-width:2.2;stroke-linecap:round;stroke-dasharray:640;stroke-dashoffset:640;animation:rsDraw 1.9s .25s cubic-bezier(.65,0,.25,1) forwards}' +
  '#reconSplash .rs-ring .faint{stroke:rgba(230,198,92,.25);stroke-width:1;stroke-dasharray:none;stroke-dashoffset:0;animation:none}' +
  '#reconSplash .rs-title{margin-top:34px;font-size:15px;font-weight:600;letter-spacing:.9em;padding-left:.9em;color:#e6c65c;opacity:0;animation:rsTitle 1.6s .7s ease forwards;text-transform:uppercase}' +
  '#reconSplash .rs-sub{margin-top:10px;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.7);opacity:0;animation:rsFade 1.2s 1.3s ease forwards}' +
  '#reconSplash .rs-bar{margin-top:30px;width:170px;height:2px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden;opacity:0;animation:rsFade .6s 1s ease forwards}' +
  '#reconSplash .rs-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#c9a227,#f3dc8a);animation:rsLoad ' + (MIN - 400) + 'ms 1s cubic-bezier(.3,.1,.2,1) forwards}' +
  '#reconSplash .rs-skip{position:absolute;bottom:22px;font-size:11px;letter-spacing:.2em;color:rgba(255,255,255,.4);text-transform:uppercase}' +
  '@keyframes rsBreath{0%{opacity:0;transform:scale(.86)}25%{opacity:1}50%{transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}' +
  '@keyframes rsGlow{0%,100%{opacity:.55}50%{opacity:1}}' +
  '@keyframes rsDraw{to{stroke-dashoffset:0}}@keyframes rsSpin{to{transform:rotate(270deg)}}' +
  '@keyframes rsTitle{0%{opacity:0;letter-spacing:1.4em}100%{opacity:1;letter-spacing:.9em}}' +
  '@keyframes rsFade{to{opacity:1}}@keyframes rsLoad{to{width:100%}}' +
  '@media (max-width:480px){#reconSplash .rs-title{letter-spacing:.6em;padding-left:.6em;font-size:13px}@keyframes rsTitle{0%{opacity:0;letter-spacing:1em}100%{opacity:1;letter-spacing:.6em}}}' +
  (reduce ? '#reconSplash *,#reconSplash:before{animation:none!important}#reconSplash .rs-logo,#reconSplash .rs-title,#reconSplash .rs-sub,#reconSplash .rs-bar{opacity:1}#reconSplash .rs-ring circle{stroke-dashoffset:0}' : '');

  var html = '<div class="rs-stage"><svg class="rs-ring" viewBox="0 0 220 220"><defs><linearGradient id="rsGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dc8a"/><stop offset="1" stop-color="#c9a227"/></linearGradient></defs>' +
    '<circle class="faint" cx="110" cy="110" r="102"/><circle cx="110" cy="110" r="102"/></svg>' +
    '<img class="rs-logo" src="img/icon-512.png" alt="TTCF"></div>' +
    '<div class="rs-title">Opening RECON</div><div class="rs-sub">Trinidad and Tobago Cadet Force</div><div class="rs-bar"><i></i></div><div class="rs-skip">Tap to skip</div>';

  function mount() {
    var st = document.createElement('style'); st.id = 'reconSplashCss'; st.textContent = css;
    var el = document.createElement('div'); el.id = 'reconSplash'; el.setAttribute('role', 'status'); el.setAttribute('aria-label', 'Opening RECON'); el.innerHTML = html;
    (document.head || document.documentElement).appendChild(st); document.documentElement.appendChild(el);
    el.addEventListener('click', hide); document.addEventListener('keydown', hide, { once: true });
    var ready = document.readyState === 'complete';
    function check() { if (ready && Date.now() - t0 >= MIN) hide(); }
    if (!ready) window.addEventListener('load', function () { ready = true; check(); });
    var iv = setInterval(function () { if (done) return clearInterval(iv); check(); if (Date.now() - t0 >= MAX) hide(); }, 120);
  }
  function hide() {
    if (done) return; done = true;
    var el = document.getElementById('reconSplash'); if (!el) return;
    el.classList.add('out');
    setTimeout(function () { var s = document.getElementById('reconSplash'), c = document.getElementById('reconSplashCss'); if (s) s.remove(); if (c) c.remove(); }, FADE + 80);
  }
  mount();
})();
