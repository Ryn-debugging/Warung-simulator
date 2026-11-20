/* ==========================================================
 * SaveManager.js — Simpan & muat progres (LocalStorage). PRD 10.
 * Termasuk validasi data simpan yang tidak valid.
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  const SAVE_KEY = 'warungsim_save_v1';
  const SETTINGS_KEY = 'warungsim_settings_v1';
  const VERSION = 1;
  const DEFAULT_SETTINGS = { music: 0.5, sfx: 0.8, easyChange: true, daySpeed: 1 };

  function storage() {
    if (SaveManager._storage) return SaveManager._storage;
    try { return global.localStorage || null; } catch (e) { return null; }
  }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  const SaveManager = {
    VERSION, SAVE_KEY, SETTINGS_KEY,
    _storage: null, // dapat diganti (mis. untuk pengujian)

    createNewState() {
      const stock = {};
      const avgCost = {};
      D.ITEMS.forEach((it) => { stock[it.id] = D.START.stock[it.id] || 0; avgCost[it.id] = it.buy; });
      const upgrades = {};
      D.UPGRADES.forEach((u) => { upgrades[u.id] = false; });
      return {
        version: VERSION,
        day: 1,
        money: D.START.money,
        reputation: D.START.reputation,
        phase: 'prep',
        clockMin: D.DAY.openHour * 60,
        stock, avgCost, upgrades,
        event: { id: 'normal', itemId: null, borongDone: false },
        today: null,
        stats: { totalRevenue: 0, totalServed: 0, totalAngry: 0, daysPlayed: 0, bestDayRevenue: 0 },
        savedAt: Date.now(),
      };
    },

    /** Validasi + perbaiki ringan. Mengembalikan { ok, state, error }. */
    validate(obj) {
      if (!obj || typeof obj !== 'object') return { ok: false, error: 'Data kosong' };
      if (obj.version !== VERSION) return { ok: false, error: 'Versi data tidak dikenali' };
      if (!isNum(obj.money) || !isNum(obj.day) || obj.day < 1 || !isNum(obj.reputation)) {
        return { ok: false, error: 'Data keuangan/hari rusak' };
      }
      if (!obj.stock || typeof obj.stock !== 'object') return { ok: false, error: 'Data inventaris rusak' };
      for (const it of D.ITEMS) {
        const v = obj.stock[it.id];
        if (!isNum(v) || v < 0) return { ok: false, error: 'Stok ' + it.name + ' tidak valid' };
      }
      // Lengkapi field opsional dengan nilai default.
      const base = SaveManager.createNewState();
      const s = Object.assign({}, base, obj);
      s.day = Math.floor(s.day);
      s.reputation = Math.max(0, Math.min(100, s.reputation));
      s.avgCost = Object.assign({}, base.avgCost, obj.avgCost || {});
      s.upgrades = Object.assign({}, base.upgrades, obj.upgrades || {});
      s.stats = Object.assign({}, base.stats, obj.stats || {});
      s.event = Object.assign({}, base.event, obj.event || {});
      if (['prep', 'open', 'closing'].indexOf(s.phase) === -1) s.phase = 'prep';
      if (!isNum(s.clockMin)) s.clockMin = D.DAY.openHour * 60;
      return { ok: true, state: s };
    },

    save(state) {
      const st = storage();
      if (!st || !state) return false;
      try {
        const copy = Object.assign({}, state, { savedAt: Date.now() });
        st.setItem(SAVE_KEY, JSON.stringify(copy));
        return true;
      } catch (e) {
        console.warn('Gagal menyimpan', e);
        return false;
      }
    },

    load() {
      const st = storage();
      if (!st) return { ok: false, error: 'Penyimpanan tidak tersedia' };
      const raw = st.getItem(SAVE_KEY);
      if (!raw) return { ok: false, error: 'Belum ada data simpan', empty: true };
      let obj;
      try { obj = JSON.parse(raw); } catch (e) { return { ok: false, error: 'Data simpan rusak' }; }
      return SaveManager.validate(obj);
    },

    hasSave() {
      const st = storage();
      return !!(st && st.getItem(SAVE_KEY));
    },

    clear() {
      const st = storage();
      if (st) st.removeItem(SAVE_KEY);
    },

    loadSettings() {
      const st = storage();
      try {
        const raw = st && st.getItem(SETTINGS_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        const s = Object.assign({}, DEFAULT_SETTINGS, obj);
        s.music = isNum(s.music) ? Math.max(0, Math.min(1, s.music)) : DEFAULT_SETTINGS.music;
        s.sfx = isNum(s.sfx) ? Math.max(0, Math.min(1, s.sfx)) : DEFAULT_SETTINGS.sfx;
        return s;
      } catch (e) {
        return Object.assign({}, DEFAULT_SETTINGS);
      }
    },

    saveSettings(settings) {
      const st = storage();
      if (st) try { st.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* abaikan */ }
    },
  };

  global.SaveManager = SaveManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = SaveManager;
})(typeof window !== 'undefined' ? window : globalThis);
