'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const DATA = require('../src/js/data.js');
const InventoryManager = require('../src/js/InventoryManager.js');
const EconomyManager = require('../src/js/EconomyManager.js');
const TransactionManager = require('../src/js/TransactionManager.js');
const SaveManager = require('../src/js/SaveManager.js');

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('PRD 5.3 — Data barang & InventoryManager', () => {
  it('memuat 5 barang awal sesuai PRD dengan harga beli dan jual', () => {
    assert.equal(DATA.ITEMS.length, 5);
    const byId = Object.fromEntries(DATA.ITEMS.map((i) => [i.id, i]));
    assert.deepEqual([byId.air.buy, byId.air.sell], [2000, 3000]);
    assert.deepEqual([byId.mie.buy, byId.mie.sell], [2500, 3500]);
    assert.deepEqual([byId.kopi.buy, byId.kopi.sell], [1500, 2500]);
    assert.deepEqual([byId.susu.buy, byId.susu.sell], [3000, 4000]);
    assert.deepEqual([byId.keripik.buy, byId.keripik.sell], [2000, 3000]);
  });

  it('menghitung kapasitas, stok, kulkas, diskon, dan HPP rata-rata', () => {
    const state = SaveManager.createNewState();
    const inv = new InventoryManager(state);

    assert.equal(inv.capacity(), 20);
    state.upgrades.rak = true;
    assert.equal(inv.capacity(), 35);

    // Kulkas menambah harga jual minuman Rp500, bukan makanan
    assert.equal(inv.sellPrice('air'), 3000);
    assert.equal(inv.sellPrice('mie'), 3500);
    state.upgrades.kulkas = true;
    assert.equal(inv.sellPrice('air'), 3500);
    assert.equal(inv.sellPrice('susu'), 4500);
    assert.equal(inv.sellPrice('mie'), 3500);

    // Diskon supplier 30%
    state.event = { id: 'diskon', itemId: 'air' };
    assert.equal(inv.buyPrice('air'), 1400);
    assert.equal(inv.buyPrice('mie'), 2500);

    // Stok & HPP rata-rata
    state.stock.air = 2;
    state.avgCost.air = 2000;
    assert.equal(inv.add('air', 2, 1400), true);
    assert.equal(inv.stock('air'), 4);
    assert.equal(inv.remove('air', 2), 3400); // rata-rata 1700 * 2
    assert.equal(inv.stock('air'), 2);
    assert.equal(inv.remove('air', 5), -1); // tidak bisa jual melebihi stok
  });
});

describe('PRD 5.2 — TransactionManager', () => {
  it('memvalidasi keranjang, batas stok, dan memproses penjualan', () => {
    const state = SaveManager.createNewState();
    state.stock = { air: 2, mie: 1, kopi: 0, susu: 3, keripik: 2 };
    const inv = new InventoryManager(state);
    const eco = new EconomyManager(state);
    const tx = new TransactionManager(state, inv, eco);
    const startMoney = state.money;

    // Tidak bisa tambah barang stok nol
    assert.deepEqual(tx.add('kopi'), { ok: false, reason: 'stock' });
    // Bisa tambah hingga batas stok
    assert.deepEqual(tx.add('air'), { ok: true });
    assert.deepEqual(tx.add('air'), { ok: true });
    assert.deepEqual(tx.add('air'), { ok: false, reason: 'stock' });
    assert.deepEqual(tx.add('mie'), { ok: true });

    const order = { air: 2, mie: 1 };
    assert.equal(tx.checkOrder(order).match, true);
    assert.equal(tx.total(), 2 * 3000 + 3500);

    // Kurangi 1 -> tidak cocok
    assert.equal(tx.removeOne('mie'), true);
    const mismatch = tx.checkOrder(order);
    assert.equal(mismatch.match, false);
    assert.deepEqual(mismatch.missing, [{ id: 'mie', qty: 1 }]);

    // Kembalikan -> cocok dan selesaikan
    tx.add('mie');
    const res = tx.finalize(order);
    assert.equal(res.ok, true);
    assert.equal(res.total, 9500);
    assert.equal(res.cogs, 2 * 2000 + 2500);
    assert.equal(state.money, startMoney + 9500);
    assert.equal(inv.stock('air'), 0);
    assert.equal(inv.stock('mie'), 0);
    assert.equal(tx.isEmpty(), true);
  });

  it('menghitung uang pelanggan dan pemeriksaan kembalian', () => {
    assert.equal(TransactionManager.checkChange(3000, 3000), 'exact');
    assert.equal(TransactionManager.checkChange(3000, 2000), 'short');
    assert.equal(TransactionManager.checkChange(3000, 5000), 'over');

    for (const total of [2500, 7000, 18500, 62000]) {
      const cash = TransactionManager.makeCustomerCash(total, () => 0.5, 'biasa');
      assert.ok(cash >= total, `cash ${cash} harus >= total ${total}`);
    }
  });
});

describe('PRD 5.5 & 6.1 — EconomyManager & Laporan Harian', () => {
  it('menghitung keuntungan kotor (Pendapatan - HPP) dan laporan harian', () => {
    const state = SaveManager.createNewState();
    const eco = new EconomyManager(state);
    eco.startDay();

    eco.earn(30000, 20000, { air: 10 });
    state.today.served = 5;
    assert.equal(eco.spend(10000, 'stock'), true);
    assert.equal(eco.spend(999999, 'upgrade'), false); // saldo tidak cukup

    const rep = eco.closeDay();
    assert.equal(rep.revenue, 30000);
    assert.equal(rep.cogs, 20000);
    assert.equal(rep.grossProfit, 10000); // PRD 5.5: Pendapatan - HPP
    assert.equal(rep.operational, DATA.OPERATIONAL_COST);
    assert.equal(rep.netProfit, 10000 - DATA.OPERATIONAL_COST);
    assert.equal(rep.reached, true); // target hari 1 = 25000
    assert.equal(rep.endRep, DATA.START.reputation + 2);
  });
});

describe('PRD 10 — SaveManager & Validasi Data Rusak', () => {
  it('menyimpan, memuat, dan menolak data simpan tidak valid', () => {
    SaveManager._storage = makeMemoryStorage();

    assert.equal(SaveManager.hasSave(), false);
    assert.equal(SaveManager.load().empty, true);

    const state = SaveManager.createNewState();
    state.day = 4;
    state.money = 123500;
    state.reputation = 78;
    assert.equal(SaveManager.save(state), true);
    assert.equal(SaveManager.hasSave(), true);

    const loaded = SaveManager.load();
    assert.equal(loaded.ok, true);
    assert.equal(loaded.state.day, 4);
    assert.equal(loaded.state.money, 123500);
    assert.equal(loaded.state.reputation, 78);

    // Data JSON rusak
    SaveManager._storage.setItem(SaveManager.SAVE_KEY, '{bukan json');
    assert.equal(SaveManager.load().ok, false);

    // Data stok negatif -> tidak valid
    const bad = SaveManager.createNewState();
    bad.stock.air = -3;
    SaveManager._storage.setItem(SaveManager.SAVE_KEY, JSON.stringify(bad));
    assert.equal(SaveManager.load().ok, false);

    // Pengaturan audio
    SaveManager.saveSettings({ music: 0.7, sfx: 0.4, easyChange: false, daySpeed: 2 });
    const st = SaveManager.loadSettings();
    assert.deepEqual(st, { music: 0.7, sfx: 0.4, easyChange: false, daySpeed: 2 });
  });
});
