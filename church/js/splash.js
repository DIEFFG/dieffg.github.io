/* Splash: shows the logo for a moment on a fresh start. Under 3 seconds, tap to skip, still when "reduce motion" is on. */
(function () {
  'use strict';
  try { if (sessionStorage.getItem('church_splash')) return; sessionStorage.setItem('church_splash', '1'); } catch (e) { /* show anyway */ }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el = document.createElement('div');
  el.id = 'churchSplash'; el.setAttribute('role', 'presentation');
  el.innerHTML = '<img src="icons/logo-256.png" alt="" width="128" height="128"><div class="sp-name">The Christian Sanctuary</div><div class="sp-tap">Tap to skip</div>';
  if (reduce) el.className = 'still';
  var started = Date.now(), gone = false;
  function hide() { if (gone) return; gone = true; el.classList.add('out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduce ? 0 : 350); }
  el.addEventListener('click', hide); el.addEventListener('keydown', hide);
  function mount() { document.body.appendChild(el); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('load', function () { setTimeout(hide, Math.max(0, 1200 - (Date.now() - started))); });
  setTimeout(hide, 2500);
})();
