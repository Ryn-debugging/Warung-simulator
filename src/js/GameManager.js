/* ==========================================================
 * GameManager.js — Pengendali utama loop game, fase harian,
 * transaksi, QRIS, supplier, 12 upgrade, buka cabang,
 * pause, dan auto-save. (v2.0.0)
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  class GameManager {
    constructor(canvas) {
      this.settings = SaveManager.loadSettings();
      this.audio = new AudioManager(this.settings);
      this.state = null;
      this.inventory = null;
      this.economy = null;
      this.transactions = null;
      this.customers = null;

      this.paused = false;
      this.closeDelay = 0;
      this.ownerMood = 'neutral';
      this.ownerMoodT = 0;
      this.lastClockMin = -1;
      this.lastTime = 0;

      this.renderer = new Renderer(canvas, this);
      this.ui = new UIManager(this);

      this.bindLifecycle();
      this.ui.showMenu();
      this.startLoop();
    }

    bindLifecycle() {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.audio.suspend();
          if (this.state) SaveManager.save(this.state);
          if (this.state && (this.state.phase === 'open' || this.state.phase === 'closing') && !this.ui.modalType) {
            this.ui.openPause();
          }
        } else {
          this.audio.resume();
        }
      });

      window.addEventListener('pagehide', () => {
        if (this.state) SaveManager.save(this.state);
      });

      const onBack = () => {
        if (!this.state) {
          if (this.ui.modalType) this.ui.closeModal();
          return;
        }
        if (this.ui.modalType === 'report') return;
        if (this.ui.modalType) this.ui.closeModal();
        else this.ui.openPause();
      };
      document.addEventListener('backbutton', onBack);
      if (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App) {
        global.Capacitor.Plugins.App.addListener('backButton', onBack);
      }

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.state) onBack();
      });
    }

    isBlocked() {
      return this.paused || !!this.ui.modalType;
    }

    onModalChange(open) {
      this.paused = open;
    }

    applySettings() {
      this.audio.setVolumes(this.settings.music, this.settings.sfx);
      SaveManager.saveSettings(this.settings);
      if (this.state) this.ui.renderPanel();
    }

    setOwnerMood(mood, dur) {
      this.ownerMood = mood;
      this.ownerMoodT = dur || 1.2;
    }

    // ---------- Mulai / Lanjut / Menu ----------
    initManagers(state) {
      SaveManager.syncActiveUpgrades(state);
      this.state = state;
      this.inventory = new InventoryManager(state);
      this.economy = new EconomyManager(state);
      this.transactions = new TransactionManager(state, this.inventory, this.economy);
      this.customers = new CustomerManager(this);
      this.closeDelay = 0;
      this.lastClockMin = Math.floor(state.clockMin);
    }

    requestNewGame() {
      if (SaveManager.hasSave()) {
        this.ui.openConfirm(
          'Mulai Permainan Baru?',
          'Progres warung dan seluruh cabang yang tersimpan akan diganti dengan warung baru dari Hari 1.',
          () => this.startNewGame()
        );
      } else {
        this.startNewGame();
      }
    }

    startNewGame() {
      const state = SaveManager.createNewState();
      this.initManagers(state);
      this.economy.startDay();
      SaveManager.save(state);
      this.audio.startMusic();
      this.ui.showGame();
      this.ui.toast('Selamat datang di Warung Berkah! Cek stok lalu tekan Buka Warung.', 'ok');
    }

    continueGame() {
      const res = SaveManager.load();
      if (!res.ok) {
        this.ui.toast('Gagal memuat data: ' + res.error, 'err');
        this.ui.showMenu();
        return;
      }
      const state = res.state;
      if (state.phase === 'closing') {
        state.phase = 'prep';
        state.clockMin = D.DAY.openHour * 60;
      }
      this.initManagers(state);
      if (!state.today) this.economy.startDay();
      this.audio.startMusic();
      this.ui.showGame();
      if (state.phase === 'open') {
        this.customers.spawnTimer = 2;
        this.ui.toast('Melanjutkan Hari ' + state.day + ' di ' + D.branchById(state.activeBranch).name + '!', 'ok');
      } else {
        this.checkSoftlockRescue();
        this.ui.toast('Selamat pagi, Hari ' + state.day + '!', 'ok');
      }
    }

    returnToMenu() {
      this.audio.stopMusic();
      this.state = null;
      this.customers = null;
      this.ui.showMenu();
    }

    // ---------- Siklus Hari ----------
    openWarung() {
      if (!this.state || this.state.phase !== 'prep') return;
      if (this.inventory.totalStock() <= 0) {
        this.audio.sfx('error');
        this.ui.toast('Stok warung kosong! Belanja di Supplier dulu ya.', 'warn');
        this.ui.openSupplier();
        return;
      }
      this.state.phase = 'open';
      this.state.clockMin = D.DAY.openHour * 60;
      this.customers.reset();
      this.customers.spawnTimer = 1.6;
      this.transactions.clear();
      this.audio.sfx('shutter');
      SaveManager.save(this.state);
      this.ui.renderAll();
      const br = D.branchById(this.state.activeBranch);
      this.ui.toast(br.name + ' dibuka! Semangat melayani pelanggan!', 'ok');
    }

    closeWarungEarly() {
      if (!this.state || this.state.phase !== 'open') return;
      this.state.phase = 'closing';
      this.closeDelay = 0.8;
      this.ui.renderAll();
      this.ui.toast('Warung mulai ditutup. Selesaikan pelanggan yang tersisa.', 'info');
    }

    rollEvent(day) {
      if (day <= 1) return { id: 'normal', itemId: null, borongDone: false };
      const total = D.EVENTS.reduce((s, e) => s + e.weight, 0);
      let r = Math.random() * total;
      let chosen = D.EVENTS[0];
      for (const e of D.EVENTS) { r -= e.weight; if (r <= 0) { chosen = e; break; } }
      return {
        id: chosen.id,
        itemId: chosen.id === 'diskon' ? pick(D.ITEMS).id : null,
        borongDone: false,
      };
    }

    finishDay() {
      const s = this.state;
      this.transactions.clear();
      this.customers.reset();
      const report = this.economy.closeDay();

      s.day += 1;
      s.phase = 'prep';
      s.clockMin = D.DAY.openHour * 60;
      s.event = this.rollEvent(s.day);
      this.economy.startDay();
      SaveManager.save(s);

      this.audio.sfx('shutter');
      setTimeout(() => this.audio.sfx('day'), 250);
      this.ui.openReport(report);
      this.ui.renderHUD();
      this.ui.el.day.textContent = 'Hari ' + report.day;
    }

    nextDay() {
      this.ui.closeModal();
      this.checkSoftlockRescue();
      this.ui.renderAll();
      const ev = this.state.event;
      if (ev.id !== 'normal') {
        const def = D.EVENTS.find((e) => e.id === ev.id);
        let msg = def.desc;
        if (ev.id === 'diskon' && ev.itemId) msg = msg.replace('{item}', D.itemById(ev.itemId).name);
        this.ui.toast(def.name + ': ' + msg, 'info');
      } else {
        this.ui.toast('Hari ' + this.state.day + ' dimulai! Bisa pindah/buka cabang sebelum buka warung.', 'ok');
      }
    }

    checkSoftlockRescue() {
      if (!this.state) return;
      const minCost = Math.min.apply(null, D.ITEMS.map((it) => this.inventory.buyPrice(it.id)));
      if (this.inventory.totalStock() === 0 && this.state.money < minCost) {
        const aid = 15000;
        this.state.money += aid;
        SaveManager.save(this.state);
        this.ui.toast('Modal menipis! Pak RT memberi bantuan modal ' + D.formatRp(aid) + '.', 'ok');
      }
    }

    // ---------- Interaksi Pelanggan & Transaksi ----------
    say(c, text) {
      c.activeLine = text;
      if (this.customers && c === this.customers.current()) this.ui.renderServe();
    }

    onCustomerArrive(c) {
      this.audio.sfx('bell');
      c.activeLine = c.line;
      this.setOwnerMood('neutral', 0);
      this.ui.renderServe();
    }

    onTapCustomer(c) {
      this.audio.sfx('ui');
      const cur = this.customers.current();
      if (c === cur) {
        if (c.state === 'ordering') {
          this.say(c, c.line);
          this.customers.emote(c, '💬', 1.6);
        } else if (c.state === 'paying') {
          this.say(c, c.isQris
            ? 'Saya bayar lewat QRIS ya Bang, pas ' + D.formatRp(c.total) + '.'
            : 'Total ' + D.formatRp(c.total) + ', ini uang saya ' + D.formatRp(c.cash) + ' ya Bang.');
        }
      } else {
        this.customers.emote(c, '💬', 1.6);
        this.ui.toast(c.name + ': "' + pick(D.LINES.waiting) + '"', 'info');
      }
    }

    pickItem(id, fromCanvas) {
      if (!this.state || (this.state.phase !== 'open' && this.state.phase !== 'closing')) return;
      const cur = this.customers.current();
      if (!cur) {
        this.audio.sfx('ui');
        this.ui.toast('Belum ada pelanggan di meja kasir.', 'info');
        return;
      }
      if (cur.state === 'paying') {
        this.audio.sfx('ui');
        this.ui.toast('Pesanan sudah pas! Tinggal selesaikan pembayaran.', 'info');
        return;
      }
      const res = this.transactions.add(id);
      const it = D.itemById(id);
      if (!res.ok) {
        this.audio.sfx('error');
        this.ui.toast('Stok ' + it.name + ' habis! Beli di 📦 Supplier.', 'err');
        return;
      }
      this.audio.sfx('pick');
      this.renderer.hop();
      this.renderer.flashShelf(id);
      const pos = this.renderer.itemCenter(id);
      this.renderer.addFloat('+1 ' + it.name.split(' ')[0], pos.x, pos.y, '#ffe066');
      if (fromCanvas) this.setOwnerMood('neutral', 0.2);
      this.ui.renderServe();
    }

    removeFromCart(id) {
      if (!this.transactions.removeOne(id)) return;
      this.audio.sfx('remove');
      this.ui.renderServe();
    }

    clearCart() {
      if (this.transactions.isEmpty()) return;
      this.transactions.clear();
      this.audio.sfx('remove');
      this.ui.renderServe();
    }

    submitOrder() {
      const cur = this.customers.current();
      if (!cur || cur.state !== 'ordering') return;
      const check = this.transactions.checkOrder(cur.order);
      if (!check.match) {
        this.audio.sfx('wrong');
        cur.mistakes += 1;
        this.state.today.wrong += 1;
        cur.patience = Math.max(4, cur.patience - cur.maxPatience * 0.12);
        const hints = [];
        if (check.missing.length) {
          hints.push('kurang ' + check.missing.map((m) => D.itemById(m.id).name + ' ' + m.qty).join(', '));
        }
        if (check.extra.length) {
          hints.push('kelebihan ' + check.extra.map((x) => D.itemById(x.id).name + ' ' + x.qty).join(', '));
        }
        this.say(cur, pick(D.LINES.wrong) + ' (' + hints.join('; ') + ')');
        this.customers.emote(cur, '❓', 2.2);
        this.setOwnerMood('angry', 0.9);
        this.renderer.addFloat('Salah pesanan!', cur.x, cur.y - 54, '#ff8a65');
        return;
      }
      if (!this.transactions.canFulfill(cur.order)) {
        this.audio.sfx('error');
        this.ui.toast('Stok tidak cukup! Cek 📦 Supplier.', 'err');
        return;
      }

      cur.total = this.transactions.total(cur.order);
      const hasQris = !!(this.state.globalUpgrades && this.state.globalUpgrades.qris);
      const pay = TransactionManager.makePayment(cur.total, Math.random, cur.type, hasQris);
      cur.cash = pay.cash;
      cur.isQris = pay.isQris;
      cur.changeGiven = 0;
      cur.state = 'paying';
      this.audio.sfx('ui');
      const need = cur.cash - cur.total;
      if (cur.isQris) {
        this.say(cur, pick(D.LINES.qris).replace('{total}', D.formatRp(cur.total)));
      } else {
        this.say(
          cur,
          need === 0
            ? 'Pas ya Bang, total ' + D.formatRp(cur.total) + '. Ini uang pasnya!'
            : 'Total ' + D.formatRp(cur.total) + ' ya. Ini uangnya ' + D.formatRp(cur.cash) + ', Bang.'
        );
      }
      this.ui.renderServe();
    }

    addChange(val) {
      const cur = this.customers.current();
      if (!cur || cur.state !== 'paying') return;
      if (cur.changeGiven + val > 200000) return;
      cur.changeGiven += val;
      this.audio.sfx('coin');
      this.ui.renderServe();
    }

    resetChange() {
      const cur = this.customers.current();
      if (!cur || cur.state !== 'paying') return;
      cur.changeGiven = 0;
      this.audio.sfx('remove');
      this.ui.renderServe();
    }

    giveChange() {
      const cur = this.customers.current();
      if (!cur || cur.state !== 'paying') return;
      const need = cur.cash - cur.total;
      const status = TransactionManager.checkChange(need, cur.changeGiven);

      if (status === 'short') {
        this.audio.sfx('wrong');
        cur.changeTries += 1;
        cur.patience = Math.max(4, cur.patience - cur.maxPatience * 0.1);
        this.say(cur, pick(D.LINES.changeShort));
        this.customers.emote(cur, '🤨', 2.0);
        this.renderer.addFloat('Kembalian kurang!', cur.x, cur.y - 54, '#ff8a65');
        return;
      }

      const sale = this.transactions.finalize(cur.order);
      if (!sale.ok) {
        this.audio.sfx('error');
        this.ui.toast('Transaksi gagal: stok tidak mencukupi.', 'err');
        return;
      }

      let line = pick(D.LINES.success);
      if (status === 'over') {
        const excess = cur.changeGiven - need;
        const honest = (cur.type === 'biasa' || cur.type === 'ibu') && Math.random() < 0.4;
        if (honest) {
          line = pick(D.LINES.honest);
          this.ui.toast(cur.name + ' jujur mengembalikan kelebihan ' + D.formatRp(excess) + '!', 'ok');
        } else {
          this.economy.spend(excess, 'change');
          line = pick(D.LINES.changeOver);
          this.ui.toast('Kelebihan kembalian ' + D.formatRp(excess) + ' dibawa pelanggan!', 'warn');
        }
      }

      let extraEarn = 0;
      if (this.state.upgrades.kasir && cur.mistakes === 0 && cur.changeTries === 0 && status === 'exact') {
        extraEarn += 500;
        this.economy.earn(500, 0);
        this.renderer.addFloat('Tip +Rp500', 312, 134, '#ffe066');
      }
      if (this.state.upgrades.gorengan) {
        extraEarn += D.GORENGAN_BONUS;
        this.economy.earn(D.GORENGAN_BONUS, 0);
        this.renderer.addFloat('+Rp1.000 Gorengan', 352, 132, '#ffb74d');
      }

      const fast = (cur.patience / cur.maxPatience) > 0.6 && cur.mistakes === 0;
      const repGain = fast ? 3 : 2;
      this.economy.changeReputation(repGain);
      this.state.today.served += 1;

      this.audio.sfx('cash');
      setTimeout(() => this.audio.sfx('success'), 140);
      this.renderer.hop();
      this.setOwnerMood('happy', 1.4);
      this.customers.emote(cur, '😊', 2.4);
      this.renderer.addFloat('+' + D.formatRp(sale.total + extraEarn), 348, 150, '#7bf08b');
      this.say(cur, line);
      this.customers.leave(cur, 'happy');

      SaveManager.save(this.state);
      this.ui.renderAll();
    }

    declareOutOfStock() {
      const cur = this.customers.current();
      if (!cur || cur.state !== 'ordering') return;
      if (this.transactions.canFulfill(cur.order)) {
        this.audio.sfx('wrong');
        cur.patience = Math.max(4, cur.patience - cur.maxPatience * 0.15);
        this.say(cur, pick(D.LINES.lie));
        this.customers.emote(cur, '😠', 2.0);
        this.renderer.addFloat('Barang ada di rak!', cur.x, cur.y - 54, '#ff8a65');
        return;
      }
      this.audio.sfx('error');
      this.transactions.clear();
      this.state.today.outOfStock += 1;
      this.economy.changeReputation(-2);
      this.say(cur, pick(D.LINES.outOfStock));
      this.customers.emote(cur, '😞', 2.2);
      this.renderer.addFloat('-2 Rep', cur.x, cur.y - 54, '#ff9f43');
      this.customers.leave(cur, 'neutral');
      SaveManager.save(this.state);
      this.ui.renderAll();
    }

    onPatienceOut(c) {
      const isCur = c === this.customers.current() || c === this.customers.queue[0];
      this.audio.sfx('angry');
      this.state.today.angry += 1;
      this.economy.changeReputation(-4);
      if (isCur) this.transactions.clear();
      this.say(c, pick(D.LINES.angry));
      this.customers.emote(c, '😡', 2.5);
      this.setOwnerMood('angry', 1.2);
      this.renderer.addFloat('-4 Rep', c.x, c.y - 54, '#ff6b6b');
      this.customers.leave(c, 'angry');
      SaveManager.save(this.state);
      this.ui.renderAll();
    }

    // ---------- Supplier, Upgrade & Cabang Warung (v2.0.0) ----------
    buyStockBatch(qtyMap) {
      let totalCost = 0;
      let totalUnits = 0;
      for (const it of D.ITEMS) {
        const q = qtyMap[it.id] || 0;
        if (q < 0 || q > this.inventory.spaceFor(it.id)) return false;
        totalCost += q * this.inventory.buyPrice(it.id);
        totalUnits += q;
      }
      if (totalUnits <= 0 || !this.economy.canAfford(totalCost)) {
        this.audio.sfx('error');
        return false;
      }
      this.economy.spend(totalCost, 'stock');
      for (const it of D.ITEMS) {
        const q = qtyMap[it.id] || 0;
        if (q > 0) this.inventory.add(it.id, q, this.inventory.buyPrice(it.id));
      }
      this.audio.sfx('buy');
      this.ui.toast('Stok +' + totalUnits + ' barang dibeli (' + D.formatRp(totalCost) + ').', 'ok');
      SaveManager.save(this.state);
      this.ui.renderAll();
      return true;
    }

    buyUpgrade(id, isGlobal) {
      if (isGlobal) {
        const u = D.GLOBAL_UPGRADES.find((x) => x.id === id);
        if (!u || this.state.globalUpgrades[id]) return false;
        if (!this.economy.spend(u.cost, 'upgrade')) {
          this.audio.sfx('error');
          this.ui.toast('Saldo belum cukup untuk ' + u.name + '.', 'err');
          return false;
        }
        this.state.globalUpgrades[id] = true;
        if (id === 'wifi') this.economy.changeReputation(4);
        this.audio.sfx('success');
        this.ui.toast('Upgrade jaringan "' + u.name + '" aktif di semua cabang!', 'ok');
        SaveManager.save(this.state);
        this.ui.renderAll();
        return true;
      }

      const u = D.UPGRADES.find((x) => x.id === id);
      if (!u || this.state.upgrades[id]) return false;
      if (!this.economy.spend(u.cost, 'upgrade')) {
        this.audio.sfx('error');
        this.ui.toast('Saldo belum cukup untuk ' + u.name + '.', 'err');
        return false;
      }
      this.state.branches[this.state.activeBranch].upgrades[id] = true;
      SaveManager.syncActiveUpgrades(this.state);
      if (id === 'papan') this.economy.changeReputation(5);
      this.audio.sfx('success');
      const br = D.branchById(this.state.activeBranch);
      this.ui.toast('Upgrade "' + u.name + '" dipasang di ' + br.shortName + '!', 'ok');
      SaveManager.save(this.state);
      this.ui.renderAll();
      return true;
    }

    unlockBranch(branchId) {
      const br = D.branchById(branchId);
      const bData = this.state.branches[branchId];
      if (!br || !bData || bData.unlocked) return false;
      if (this.state.reputation < br.minRep) {
        this.audio.sfx('error');
        this.ui.toast('Butuh Reputasi minimal ' + br.minRep + ' untuk membuka ' + br.name + '.', 'err');
        return false;
      }
      if (!this.economy.spend(br.cost, 'branch')) {
        this.audio.sfx('error');
        this.ui.toast('Saldo belum cukup untuk membuka ' + br.name + '.', 'err');
        return false;
      }
      bData.unlocked = true;
      this.economy.changeReputation(3);
      this.audio.sfx('day');
      this.ui.toast('Selamat! ' + br.name + ' resmi dibuka (+3 Rep)!', 'ok');
      SaveManager.save(this.state);
      this.ui.renderAll();
      return true;
    }

    switchBranch(branchId) {
      const bData = this.state.branches[branchId];
      if (!bData || !bData.unlocked || this.state.activeBranch === branchId) return false;
      if (this.state.phase !== 'prep') {
        this.audio.sfx('error');
        this.ui.toast('Pindah jaga cabang hanya bisa saat Persiapan Pagi (sebelum buka warung).', 'warn');
        return false;
      }
      this.state.activeBranch = branchId;
      SaveManager.syncActiveUpgrades(this.state);
      this.audio.sfx('shutter');
      const br = D.branchById(branchId);
      this.ui.toast('Berpindah ke ' + br.name + '!', 'ok');
      SaveManager.save(this.state);
      this.ui.renderAll();
      return true;
    }

    // ---------- Loop utama ----------
    startLoop() {
      const tick = (now) => {
        const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0.016;
        this.lastTime = now;
        this.update(dt);
        this.renderer.render(dt);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    update(dt) {
      if (this.ownerMoodT > 0) {
        this.ownerMoodT -= dt;
        if (this.ownerMoodT <= 0) this.ownerMood = 'neutral';
      }
      if (!this.state || this.isBlocked()) return;

      const s = this.state;
      if (s.phase === 'open') {
        const minPerSec = ((D.DAY.closeHour - D.DAY.openHour) * 60) / D.DAY.realSeconds;
        s.clockMin += minPerSec * (this.settings.daySpeed || 1) * dt;
        if (s.clockMin >= D.DAY.closeHour * 60) {
          s.clockMin = D.DAY.closeHour * 60;
          s.phase = 'closing';
          this.closeDelay = 0.9;
          this.ui.renderAll();
          this.ui.toast('Jam 20:00 — Jam tutup! Layani pelanggan terakhir.', 'info');
        } else {
          const m = Math.floor(s.clockMin);
          if (m !== this.lastClockMin) {
            this.lastClockMin = m;
            this.ui.renderHUD();
          }
        }
        this.customers.update(dt);
      } else if (s.phase === 'closing') {
        this.customers.update(dt);
        if (this.customers.queue.length === 0) {
          this.closeDelay -= dt;
          if (this.closeDelay <= 0) this.finishDay();
        }
      }
    }
  }

  global.GameManager = GameManager;
})(typeof window !== 'undefined' ? window : globalThis);
