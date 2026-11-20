/* ==========================================================
 * InventoryManager.js — Stok, kapasitas, harga beli/jual.
 * Bekerja langsung pada objek `state` (data yang disimpan).
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  class InventoryManager {
    constructor(state) {
      this.state = state;
    }

    get items() { return D.ITEMS; }

    capacity() {
      return D.START.baseCapacity + (this.state.upgrades.rak ? 15 : 0);
    }

    stock(id) { return this.state.stock[id] || 0; }

    has(id, qty) { return this.stock(id) >= qty; }

    spaceFor(id) { return Math.max(0, this.capacity() - this.stock(id)); }

    totalStock() {
      return D.ITEMS.reduce((sum, it) => sum + this.stock(it.id), 0);
    }

    /** Harga jual (minuman dingin lebih mahal bila punya kulkas). */
    sellPrice(id) {
      const it = D.itemById(id);
      if (!it) return 0;
      const cold = this.state.upgrades.kulkas && it.cat === 'Minuman' ? D.COLD_BONUS : 0;
      return it.sell + cold;
    }

    /** Harga beli dari supplier (dipengaruhi event diskon). */
    buyPrice(id) {
      const it = D.itemById(id);
      if (!it) return 0;
      const ev = this.state.event;
      if (ev && ev.id === 'diskon' && ev.itemId === id) {
        return Math.round((it.buy * 0.7) / 100) * 100;
      }
      return it.buy;
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
