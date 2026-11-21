/* ==========================================================
 * TransactionManager.js — Keranjang, pemeriksaan pesanan,
 * pembayaran dan kembalian. (PRD 5.2)
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  class TransactionManager {
    constructor(state, inventory, economy) {
      this.state = state;
      this.inventory = inventory;
      this.economy = economy;
      this.cart = {};
    }

    inCart(id) { return this.cart[id] || 0; }

    isEmpty() { return Object.keys(this.cart).length === 0; }

    /** Tambah 1 barang ke keranjang; gagal bila stok tidak cukup. */
    add(id) {
      if (!D.itemById(id)) return { ok: false, reason: 'unknown' };
      if (this.inventory.stock(id) - this.inCart(id) <= 0) return { ok: false, reason: 'stock' };
      this.cart[id] = this.inCart(id) + 1;
      return { ok: true };
    }

    removeOne(id) {
      if (!this.cart[id]) return false;
      this.cart[id] -= 1;
      if (this.cart[id] <= 0) delete this.cart[id];
      return true;
    }

    clear() { this.cart = {}; }

    total(cart) {
      const c = cart || this.cart;
      let sum = 0;
      for (const id in c) sum += this.inventory.sellPrice(id) * c[id];
      return sum;
    }

    /** Bandingkan keranjang dengan pesanan (barang & jumlah harus sama persis). */
    checkOrder(order, cart) {
      const c = cart || this.cart;
      const missing = [];
      const extra = [];
      const ids = new Set([...Object.keys(order), ...Object.keys(c)]);
      ids.forEach((id) => {
        const want = order[id] || 0;
        const got = c[id] || 0;
        if (got < want) missing.push({ id, qty: want - got });
        else if (got > want) extra.push({ id, qty: got - want });
      });
      return { match: missing.length === 0 && extra.length === 0, missing, extra };
    }

    /** Apakah stok cukup untuk seluruh pesanan? */
    canFulfill(order) {
      return Object.keys(order).every((id) => this.inventory.has(id, order[id]));
    }

    /**
     * Selesaikan penjualan: kurangi stok, tambah saldo.
     * Mengembalikan { ok, total, cogs }.
     */
    finalize(order) {
      const check = this.checkOrder(order);
      if (!check.match) return { ok: false, reason: 'mismatch' };
      if (!this.canFulfill(order)) return { ok: false, reason: 'stock' };
      const total = this.total(order);
      let cogs = 0;
      for (const id in order) cogs += this.inventory.remove(id, order[id]);
      this.economy.earn(total, cogs, order);
      this.clear();
      return { ok: true, total, cogs };
    }

    /** Uang yang diberikan pelanggan (termasuk opsi QRIS uang pas otomatis). */
    static makePayment(total, rng, typeId, hasQris) {
      const r = rng || Math.random;
      if (hasQris && r() < 0.35) return { cash: total, isQris: true };
      return { cash: TransactionManager.makeCustomerCash(total, r, typeId), isQris: false };
    }

    /** Uang yang diberikan pelanggan untuk total tertentu. */
    static makeCustomerCash(total, rng, typeId) {
      const r = rng || Math.random;
      if (r() < 0.25) return total; // uang pas
      const denoms = D.CASH_DENOMS;
      let idx = denoms.findIndex((d) => d >= total);
      if (idx === -1) return Math.ceil(total / 50000) * 50000;
      const bigBill = typeId === 'cerewet' ? 0.5 : 0.2;
      if (idx < denoms.length - 1 && r() < bigBill) idx += 1; // "Nggak ada uang kecil, Bang"
      return denoms[idx];
    }

    /** 'exact' | 'short' | 'over' */
    static checkChange(expected, given) {
      if (given === expected) return 'exact';
      return given < expected ? 'short' : 'over';
    }
  }

  global.TransactionManager = TransactionManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = TransactionManager;
})(typeof window !== 'undefined' ? window : globalThis);
