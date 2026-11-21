/* ==========================================================
 * EconomyManager.js — Saldo, pendapatan, pengeluaran, reputasi,
 * setoran cabang lain, dan laporan harian. (v2.0.0)
 * Rumus PRD 5.5:
 *   Keuntungan kotor = Pendapatan penjualan - Harga pokok barang terjual
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  function freshToday(state) {
    return {
      revenue: 0, cogs: 0, stockSpend: 0, operational: 0, upgradeSpend: 0, branchSpend: 0, changeLoss: 0,
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

    activeBranchDef() {
      return D.branchById(this.state.activeBranch);
    }

    activeUpgrades() {
      const b = this.state.branches && this.state.branches[this.state.activeBranch];
      return (b && b.upgrades) || this.state.upgrades || {};
    }

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
     * Pengeluaran. category: 'stock' | 'operational' | 'upgrade' | 'branch' | 'change'
     */
    spend(amount, category) {
      const mandatory = category === 'operational' || category === 'change';
      if (!mandatory && !this.canAfford(amount)) return false;
      this.state.money -= amount;
      const t = this.state.today;
      if (category === 'stock') t.stockSpend += amount;
      else if (category === 'operational') t.operational += amount;
      else if (category === 'upgrade') t.upgradeSpend += amount;
      else if (category === 'branch') t.branchSpend = (t.branchSpend || 0) + amount;
      else if (category === 'change') t.changeLoss += amount;
      return true;
    }

    changeReputation(delta) {
      const s = this.state;
      s.reputation = Math.max(0, Math.min(100, s.reputation + delta));
      return s.reputation;
    }

    /** Bintang reputasi 0..5. */
    stars() { return Math.round((this.state.reputation / 20) * 2) / 2; }

    target(day) {
      const d = day || this.state.day;
      const br = this.activeBranchDef();
      const bonus = br.id === 'pusat' ? 0 : (br.id === 'sekolah' ? 5000 : (br.id === 'kampus' ? 12000 : 20000));
      return 25000 + (d - 1) * 7500 + bonus;
    }

    operationalCost() {
      const br = this.activeBranchDef();
      const u = this.activeUpgrades();
      const base = br.opCost != null ? br.opCost : D.OPERATIONAL_COST;
      return base + (u.lampu ? 1000 : 0) + (u.kulkas ? 1500 : 0) + (u.ekspansi ? 1500 : 0);
    }

    /**
     * Estimasi setoran bersih harian dari cabang yang berjalan otomatis
     * (saat pemain sedang menjaga cabang lain).
     */
    branchPassiveIncome(branchId) {
      const def = D.branchById(branchId);
      const bData = this.state.branches && this.state.branches[branchId];
      if (!def || !bData || !bData.unlocked) return 0;
      const up = bData.upgrades || {};
      let sum = def.basePassive || 10000;
      D.UPGRADES.forEach((u) => {
        if (up[u.id]) sum += (u.passive || 3000);
      });
      // Dipengaruhi reputasi (0.75x - 1.25x)
      const repMul = 0.75 + (this.state.reputation / 100) * 0.5;
      sum *= repMul;
      // Pelatihan Karyawan Cabang (+40%)
      if (this.state.globalUpgrades && this.state.globalUpgrades.karyawan) {
        sum *= 1.4;
      }
      // Cuaca hujan sedikit menurunkan setoran
      if (this.state.event && this.state.event.id === 'hujan') {
        sum *= 0.85;
      }
      return Math.round(sum / 500) * 500;
    }

    /** Total estimasi setoran semua cabang lain yang sedang buka otomatis. */
    otherBranchesReport() {
      const list = [];
      if (!this.state.branches) return { list, total: 0 };
      let total = 0;
      D.BRANCHES.forEach((b) => {
        if (b.id === this.state.activeBranch) return;
        if (this.state.branches[b.id] && this.state.branches[b.id].unlocked) {
          const income = this.branchPassiveIncome(b.id);
          list.push({ id: b.id, name: b.name, shortName: b.shortName, income });
          total += income;
        }
      });
      return { list, total };
    }

    startDay() { this.state.today = freshToday(this.state); }

    /** Menutup hari: bayar operasional, terima setoran cabang lain, buat laporan. */
    closeDay() {
      const s = this.state;
      const t = s.today;
      const op = this.operationalCost();
      this.spend(op, 'operational');

      const other = this.otherBranchesReport();
      if (other.total > 0) {
        s.money += other.total;
        s.stats.totalRevenue += other.total;
        s.stats.branchIncomeTotal = (s.stats.branchIncomeTotal || 0) + other.total;
      }

      const target = this.target(s.day);
      const reached = t.revenue >= target;
      if (reached) this.changeReputation(2);
      const grossProfit = t.revenue - t.cogs;
      const netProfit = grossProfit - t.operational - t.changeLoss + other.total;
      s.stats.daysPlayed += 1;
      s.stats.totalServed += t.served;
      s.stats.totalAngry += t.angry;
      if (t.revenue > s.stats.bestDayRevenue) s.stats.bestDayRevenue = t.revenue;
      return {
        day: s.day,
        branchName: this.activeBranchDef().name,
        revenue: t.revenue, cogs: t.cogs, grossProfit, netProfit,
        branchReports: other.list,
        branchIncomeTotal: other.total,
        stockSpend: t.stockSpend, operational: t.operational,
        upgradeSpend: t.upgradeSpend, branchSpend: t.branchSpend || 0,
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
