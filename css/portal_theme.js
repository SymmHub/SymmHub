/*
 * portal_theme.js — Tiny zero-dependency theme initializer & toggle binder for
 * SymmHub portal and index pages. Shares localStorage key 'symmhub_theme' with
 * lib/uilib/ThemeManager.js ('light' | 'dark' | 'system', default 'light').
 */
(function () {
  var KEY = 'symmhub_theme';
  var MODES = ['light', 'dark', 'system'];
  var LABELS = {
    light:  { icon: '\u2600', text: 'Light',  title: 'Theme: Light (click for Dark)' },
    dark:   { icon: '\u263E', text: 'Dark',   title: 'Theme: Dark (click for System)' },
    system: { icon: '\u25D0', text: 'System', title: 'Theme: System (click for Light)' },
  };

  function readMode() {
    try {
      var v = localStorage.getItem(KEY);
      return MODES.indexOf(v) >= 0 ? v : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function applyMode(mode) {
    document.documentElement.dataset.theme = mode;
    var info = LABELS[mode] || LABELS.light;
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = info.icon + ' ' + info.text;
      btns[i].title = info.title;
      btns[i].setAttribute('aria-label', info.title);
    }
  }

  function setMode(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
    applyMode(mode);
  }

  function cycleMode() {
    var cur = readMode();
    setMode(MODES[(MODES.indexOf(cur) + 1) % MODES.length]);
  }

  // Apply immediately to avoid flash
  applyMode(readMode());

  function wireButtons() {
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      if (!btns[i].dataset.themeBound) {
        btns[i].dataset.themeBound = '1';
        btns[i].addEventListener('click', cycleMode);
      }
    }
    applyMode(readMode());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButtons);
  } else {
    wireButtons();
  }

  window.addEventListener('storage', function (e) {
    if (e && e.key === KEY) applyMode(readMode());
  });
})();
