/* ==========================================================
 * EconomyManager.js — Saldo, pendapatan, pengeluaran, reputasi,
 * laporan harian. Rumus PRD 5.5:
 *   Keuntungan kotor = Pendapatan penjualan - Harga pokok barang terjual
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  function freshToday(state) {
    return {
      revenue: 0, cogs: 0, stockSpend: 0, operational: 0, upgradeSpend: 0, changeLoss: 0,
      served: 0, angry: 0, wrong: 0, outOfStock: 0, sold: {},
      startMoney: state.money, startRep: state.reputation,
    };
  }

  class EconomyManager {
    constructor(state) {
      this.state = state;
      if (!state.today) state.today = freshToday(state);
    }

    get money() { return this.state.money; }

    canAfford(amount) { return this.state.money >= amount; }

    /** Pemasukan dari penjualan. */
    earn(amount, cogs, soldMap) {
      this.state.money += amount;
      const t = this.state.today;
      t.revenue += amount;
      t.cogs += cogs;
      if (soldMap) {
        for (const id in soldMap) t.sold[id] = (t.sold[id] || 0) + soldMap[id];
      }
      this.state.stats.totalRevenue += amount;
    }

    /**
     * Pengeluaran. category: 'stock' | 'operational' | 'upgrade' | 'change'
     * Mengembalikan false jika saldo tidak cukup (kecuali operasional/kembalian yang wajib).
     */
    spend(amount, category) {
      const mandatory = category === 'operational' || category === 'change';
      if (!mandatory && !this.canAfford(amount)) return false;
      this.state.money -= amount;
      const t = this.state.today;
      if (category === 'stock') t.stockSpend += amount;
      else if (category === 'operational') t.operational += amount;
      else if (category === 'upgrade') t.upgradeSpend += amount;
      else if (category === 'change') t.changeLoss += amount;
      return true;
    }

    changeReputation(delta) {
      const s = this.state;
      s.reputation = Math.max(0, Math.min(100, s.reputation + delta));
      return s.reputation;
    }

    /** Bintang reputasi 0..5 (boleh setengah). */
    stars() { return Math.round((this.state.reputation / 20) * 2) / 2; }

    target(day) { return 25000 + ((day || this.state.day) - 1) * 7500; }

    operationalCost() {
      const u = this.state.upgrades;
      return D.OPERATIONAL_COST + (u.lampu ? 1000 : 0) + (u.kulkas ? 1500 : 0);
    }

    startDay() { this.state.today = freshToday(this.state); }

    /** Menutup hari: bayar biaya operasional, buat laporan. */
    closeDay() {
      const s = this.state;
      const t = s.today;
      const op = this.operationalCost();
      this.spend(op, 'operational');
      const target = this.target(s.day);
      const reached = t.revenue >= target;
      if (reached) this.changeReputation(2);
      const grossProfit = t.revenue - t.cogs;
      const netProfit = grossProfit - t.operational - t.changeLoss;
      s.stats.daysPlayed += 1;
      s.stats.totalServed += t.served;
      s.stats.totalAngry += t.angry;
      if (t.revenue > s.stats.bestDayRevenue) s.stats.bestDayRevenue = t.revenue;
      return {
        day: s.day,
        revenue: t.revenue, cogs: t.cogs, grossProfit, netProfit,
        stockSpend: t.stockSpend, operational: t.operational, upgradeSpend: t.upgradeSpend,
        changeLoss: t.changeLoss,
        served: t.served, angry: t.angry, wrong: t.wrong, outOfStock: t.outOfStock,
        sold: Object.assign({}, t.sold),
        startMoney: t.startMoney, endMoney: s.money,
        startRep: t.startRep, endRep: s.reputation,
        target, reached,
      };
    }
  }

  EconomyManager.freshToday = freshToday;
  global.EconomyManager = EconomyManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = EconomyManager;
})(typeof window !== 'undefined' ? window : globalThis);
