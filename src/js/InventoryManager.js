/* ==========================================================
 * InventoryManager.js — Stok, kapasitas, harga beli/jual.
 * v2.0.0: mendukung ekspansi ruang, bonus harga cabang, dan
 * diskon permanen Kontrak Gudang Grosir.
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  class InventoryManager {
    constructor(state) {
      this.state = state;
    }

    get items() { return D.ITEMS; }

    activeBranchDef() {
      return D.branchById(this.state.activeBranch);
    }

    activeUpgrades() {
      const b = this.state.branches && this.state.branches[this.state.activeBranch];
      return (b && b.upgrades) || this.state.upgrades || {};
    }

    capacity() {
      const u = this.activeUpgrades();
      return D.START.baseCapacity + (u.rak ? 15 : 0) + (u.ekspansi ? 10 : 0);
    }

    stock(id) { return this.state.stock[id] || 0; }

    has(id, qty) { return this.stock(id) >= qty; }

    spaceFor(id) { return Math.max(0, this.capacity() - this.stock(id)); }

    totalStock() {
      return D.ITEMS.reduce((sum, it) => sum + this.stock(it.id), 0);
    }

    /** Harga jual (kulkas minuman dingin + bonus harga lokasi cabang). */
    sellPrice(id) {
      const it = D.itemById(id);
      if (!it) return 0;
      const u = this.activeUpgrades();
      const br = this.activeBranchDef();
      const cold = u.kulkas && it.cat === 'Minuman' ? D.COLD_BONUS : 0;
      return it.sell + cold + (br.priceBonus || 0);
    }

    /** Harga beli supplier (diskon grosir 15% + event diskon harian 30%). */
    buyPrice(id) {
      const it = D.itemById(id);
      if (!it) return 0;
      let price = it.buy;
      if (this.state.globalUpgrades && this.state.globalUpgrades.grosir) {
        price *= 0.85;
      }
      const ev = this.state.event;
      if (ev && ev.id === 'diskon' && ev.itemId === id) {
        price *= 0.7;
      }
      return Math.max(500, Math.round(price / 100) * 100);
    }

    /** Menambah stok + memperbarui harga pokok rata-rata. */
    add(id, qty, unitPrice) {
      if (qty <= 0) return false;
      if (qty > this.spaceFor(id)) return false;
      const cur = this.stock(id);
      const avg = this.state.avgCost[id] != null ? this.state.avgCost[id] : D.itemById(id).buy;
      this.state.avgCost[id] = (avg * cur + unitPrice * qty) / (cur + qty);
      this.state.stock[id] = cur + qty;
      return true;
    }

    /** Mengurangi stok. Mengembalikan harga pokok barang (HPP) atau -1 jika gagal. */
    remove(id, qty) {
      if (!this.has(id, qty) || qty <= 0) return -1;
      this.state.stock[id] -= qty;
      const avg = this.state.avgCost[id] != null ? this.state.avgCost[id] : D.itemById(id).buy;
      return Math.round(avg * qty);
    }
  }

  global.InventoryManager = InventoryManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = InventoryManager;
})(typeof window !== 'undefined' ? window : globalThis);
