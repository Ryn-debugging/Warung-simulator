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

describe('PRD 5.3 & v2.0.0 — Data barang, cabang & InventoryManager', () => {
  it('memuat 5 barang awal, 4 cabang, dan 12 upgrade (8 cabang + 4 global)', () => {
    assert.equal(DATA.APP_VERSION, '2.0.0');
    assert.equal(DATA.ITEMS.length, 5);
    assert.equal(DATA.BRANCHES.length, 4);
    assert.equal(DATA.UPGRADES.length, 8);
    assert.equal(DATA.GLOBAL_UPGRADES.length, 4);

    const byId = Object.fromEntries(DATA.ITEMS.map((i) => [i.id, i]));
    assert.deepEqual([byId.air.buy, byId.air.sell], [2000, 3000]);
    assert.deepEqual([byId.mie.buy, byId.mie.sell], [2500, 3500]);
    assert.deepEqual([byId.kopi.buy, byId.kopi.sell], [1500, 2500]);
    assert.deepEqual([byId.susu.buy, byId.susu.sell], [3000, 4000]);
    assert.deepEqual([byId.keripik.buy, byId.keripik.sell], [2000, 3000]);
  });

  it('menghitung kapasitas (rak + ekspansi), kulkas, bonus harga cabang, grosir & diskon', () => {
    const state = SaveManager.createNewState();
    const inv = new InventoryManager(state);

    assert.equal(inv.capacity(), 20);
    state.upgrades.rak = true;
    assert.equal(inv.capacity(), 35);
    state.upgrades.ekspansi = true;
    assert.equal(inv.capacity(), 45);

    // Kulkas menambah harga jual minuman Rp500
    assert.equal(inv.sellPrice('air'), 3000);
    state.upgrades.kulkas = true;
    assert.equal(inv.sellPrice('air'), 3500);
    assert.equal(inv.sellPrice('mie'), 3500);

    // Cabang Kampus menambah harga jual semua barang +Rp500
    state.branches.kampus.unlocked = true;
    state.activeBranch = 'kampus';
    SaveManager.syncActiveUpgrades(state);
    assert.equal(inv.sellPrice('air'), 3500); // kampus (+500), kulkas belum dibeli di kampus
    assert.equal(inv.sellPrice('mie'), 4000);
    state.branches.kampus.upgrades.kulkas = true;
    assert.equal(inv.sellPrice('air'), 4000); // kampus (+500) + kulkas (+500)

    // Diskon Grosir global (-15%) + Event diskon (-30%)
    state.globalUpgrades.grosir = true;
    assert.equal(inv.buyPrice('air'), 1700);
    state.event = { id: 'diskon', itemId: 'air' };
    assert.equal(inv.buyPrice('air'), 1200);

    // Stok & HPP rata-rata
    state.stock.air = 2;
    state.avgCost.air = 2000;
    assert.equal(inv.add('air', 2, 1200), true);
    assert.equal(inv.stock('air'), 4);
    assert.equal(inv.remove('air', 2), 3200);
    assert.equal(inv.remove('air', 5), -1);
  });
});

describe('PRD 5.2 & v2.0.0 — TransactionManager & QRIS', () => {
  it('memvalidasi keranjang, batas stok, dan memproses penjualan', () => {
    const state = SaveManager.createNewState();
    state.stock = { air: 2, mie: 1, kopi: 0, susu: 3, keripik: 2 };
    const inv = new InventoryManager(state);
    const eco = new EconomyManager(state);
    const tx = new TransactionManager(state, inv, eco);
    const startMoney = state.money;

    assert.deepEqual(tx.add('kopi'), { ok: false, reason: 'stock' });
    assert.deepEqual(tx.add('air'), { ok: true });
    assert.deepEqual(tx.add('air'), { ok: true });
    assert.deepEqual(tx.add('air'), { ok: false, reason: 'stock' });
    assert.deepEqual(tx.add('mie'), { ok: true });

    const order = { air: 2, mie: 1 };
    assert.equal(tx.checkOrder(order).match, true);
    assert.equal(tx.total(), 9500);

    assert.equal(tx.removeOne('mie'), true);
    assert.equal(tx.checkOrder(order).match, false);
    tx.add('mie');

    const res = tx.finalize(order);
    assert.equal(res.ok, true);
    assert.equal(state.money, startMoney + 9500);
    assert.equal(inv.stock('air'), 0);
    assert.equal(tx.isEmpty(), true);
  });

  it('mendukung pembayaran QRIS uang pas dan pemeriksaan kembalian', () => {
    assert.equal(TransactionManager.checkChange(3000, 3000), 'exact');
    assert.equal(TransactionManager.checkChange(3000, 2000), 'short');
    assert.equal(TransactionManager.checkChange(3000, 5000), 'over');

    const qrisPay = TransactionManager.makePayment(13500, () => 0.1, 'biasa', true);
    assert.deepEqual(qrisPay, { cash: 13500, isQris: true });

    const cashPay = TransactionManager.makePayment(13500, () => 0.5, 'biasa', false);
    assert.equal(cashPay.isQris, false);
    assert.ok(cashPay.cash >= 13500);
  });
});

describe('PRD 5.5 & v2.0.0 — EconomyManager & Setoran Cabang Lain', () => {
  it('menghitung keuntungan kotor, operasional, dan setoran otomatis cabang lain', () => {
    const state = SaveManager.createNewState();
    state.reputation = 60;
    state.branches.sekolah.unlocked = true;
    state.branches.sekolah.upgrades.gorengan = true;
    state.globalUpgrades.karyawan = true;

    const eco = new EconomyManager(state);
    eco.startDay();

    const passiveSekolah = eco.branchPassiveIncome('sekolah');
    assert.ok(passiveSekolah > 20000, 'Cabang sekolah dengan gorengan + karyawan menghasilkan setoran > Rp20.000');

    eco.earn(30000, 20000, { air: 10 });
    state.today.served = 5;

    const rep = eco.closeDay();
    assert.equal(rep.grossProfit, 10000);
    assert.equal(rep.branchReports.length, 1);
    assert.equal(rep.branchReports[0].id, 'sekolah');
    assert.equal(rep.branchIncomeTotal, passiveSekolah);
    assert.equal(rep.netProfit, 10000 - DATA.OPERATIONAL_COST + passiveSekolah);
  });
});

describe('PRD 10 & v2.0.0 — SaveManager & Migrasi v1 -> v2', () => {
  it('memigrasikan data simpan v1.1.0 ke v2.0.0 tanpa kehilangan progres', () => {
    SaveManager._storage = makeMemoryStorage();

    // Simpan format lama versi 1
    const v1Save = {
      version: 1,
      day: 7,
      money: 185000,
      reputation: 72,
      phase: 'prep',
      clockMin: 480,
      stock: { air: 10, mie: 8, kopi: 12, susu: 5, keripik: 9 },
      upgrades: { rak: true, kulkas: true, kasir: false, kursi: true, lampu: false, papan: true },
      stats: { totalRevenue: 400000, totalServed: 65, totalAngry: 2, daysPlayed: 6, bestDayRevenue: 90000 },
    };
    SaveManager._storage.setItem(SaveManager.SAVE_KEY, JSON.stringify(v1Save));

    const loaded = SaveManager.load();
    assert.equal(loaded.ok, true);
    assert.equal(loaded.state.version, 2);
    assert.equal(loaded.state.day, 7);
    assert.equal(loaded.state.money, 185000);
    assert.equal(loaded.state.activeBranch, 'pusat');
    assert.equal(loaded.state.branches.pusat.unlocked, true);
    assert.equal(loaded.state.branches.pusat.upgrades.rak, true);
    assert.equal(loaded.state.branches.pusat.upgrades.kulkas, true);
    assert.equal(loaded.state.branches.pusat.upgrades.gorengan, false);
    assert.equal(loaded.state.branches.sekolah.unlocked, false);
    assert.equal(loaded.state.globalUpgrades.qris, false);

    // Data JSON rusak & stok negatif tetap ditolak
    SaveManager._storage.setItem(SaveManager.SAVE_KEY, '{rusak');
    assert.equal(SaveManager.load().ok, false);
    const bad = SaveManager.createNewState();
    bad.stock.air = -1;
    SaveManager._storage.setItem(SaveManager.SAVE_KEY, JSON.stringify(bad));
    assert.equal(SaveManager.load().ok, false);
  });
});
