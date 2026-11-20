/* ==========================================================
 * main.js — Titik masuk aplikasi Warung Simulator 2D.
 * ========================================================== */
(function () {
  'use strict';

  function boot() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    window.game = new GameManager(canvas);

    // Kunci orientasi landscape bila didukung (Android WebView / Capacitor)
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
