/* ==========================================================
 * data.js — Data statis Warung Simulator 2D v2.0.0
 * Barang, cabang warung, tipe pelanggan, dialog, 12 upgrade,
 * event harian, dan konstanta.
 * ========================================================== */
(function (global) {
  'use strict';

  const APP_VERSION = '2.0.0';

  /** PRD 5.3 — Data barang awal. */
  const ITEMS = [
    { id: 'air',     name: 'Air Mineral', cat: 'Minuman', buy: 2000, sell: 3000 },
    { id: 'mie',     name: 'Mi Instan',   cat: 'Makanan', buy: 2500, sell: 3500 },
    { id: 'kopi',    name: 'Kopi Sachet', cat: 'Minuman', buy: 1500, sell: 2500 },
    { id: 'susu',    name: 'Susu Kotak',  cat: 'Minuman', buy: 3000, sell: 4000 },
    { id: 'keripik', name: 'Keripik',     cat: 'Jajanan', buy: 2000, sell: 3000 },
  ];

  /** PRD 6.1 — Satu hari ±5 menit nyata. Jam buka 08.00, tutup 20.00. */
  const DAY = { openHour: 8, closeHour: 20, realSeconds: 300 };

  const START = {
    money: 60000,
    reputation: 50,
    baseCapacity: 20,
    stock: { air: 6, mie: 6, kopi: 8, susu: 4, keripik: 6 },
  };

  const OPERATIONAL_COST = 5000; // biaya operasional dasar cabang pusat
  const COLD_BONUS = 500;        // tambahan harga minuman dingin (upgrade kulkas)
  const GORENGAN_BONUS = 1000;   // tambahan jajan spontan per transaksi (upgrade gorengan)
  const MAX_QUEUE = 4;           // 1 di kasir + 3 antre (5 jika upgrade ekspansi)
  const EXPANDED_MAX_QUEUE = 5;

  /** v2.0.0 — Cabang Warung khas Indonesia. */
  const BRANCHES = [
    {
      id: 'pusat',
      shortName: 'Pusat',
      name: 'Warung Berkah Pusat',
      signTitle: 'WARUNG BERKAH',
      signSub: 'Cabang Pusat • Gang Permukiman',
      cost: 0,
      minRep: 0,
      opCost: 5000,
      priceBonus: 0,
      spawnMul: 1.0,
      basePassive: 10000,
      awning: ['#2e8b57', '#f0efe6'],
      signBg: '#1f6f8b',
      theme: 'pusat',
      typeBoost: {},
      desc: 'Warung pertama di gang perumahan. Biaya operasional ringan dan pelanggan seimbang.',
    },
    {
      id: 'sekolah',
      shortName: 'Sekolah',
      name: 'Cabang Depan Sekolah',
      signTitle: 'WARUNG SEKOLAH',
      signSub: 'Depan SDN 01 • Jajanan & Susu',
      cost: 150000,
      minRep: 55,
      opCost: 6500,
      priceBonus: 0,
      spawnMul: 0.82,
      basePassive: 16000,
      awning: ['#c8372d', '#f5f2ea'],
      signBg: '#9b2226',
      theme: 'sekolah',
      typeBoost: { anak: 2.5, ibu: 1.3 },
      desc: 'Ramai saat jam berangkat & pulang sekolah! Kedatangan +20% lebih cepat, jajanan laris manis.',
    },
    {
      id: 'kampus',
      shortName: 'Kampus',
      name: 'Cabang Kosan & Kampus',
      signTitle: 'WARUNG KAMPUS',
      signSub: 'Area Kosan • Kopi & Mi 24 Jam',
      cost: 280000,
      minRep: 65,
      opCost: 8000,
      priceBonus: 500,
      spawnMul: 0.78,
      basePassive: 26000,
      awning: ['#2b6cb0', '#f0f4f8'],
      signBg: '#1d4e89',
      theme: 'kampus',
      typeBoost: { biasa: 1.5, ojek: 1.8, cerewet: 1.3 },
      desc: 'Surganya anak kos! Harga jual seluruh barang +Rp500, kopi & mi instan sangat dicari.',
    },
    {
      id: 'pasar',
      shortName: 'Pasar',
      name: 'Cabang Pinggir Pasar',
      signTitle: 'WARUNG PASAR',
      signSub: 'Pangkalan Ojek • Grosir & Eceran',
      cost: 450000,
      minRep: 75,
      opCost: 10000,
      priceBonus: 500,
      spawnMul: 0.68,
      basePassive: 42000,
      awning: ['#d97706', '#fef3c7'],
      signBg: '#7c2d12',
      theme: 'pasar',
      typeBoost: { ibu: 2.0, ojek: 2.0, cerewet: 1.5 },
      bigOrderChance: 0.3,
      desc: 'Lokasi paling ramai (+35% traffic), harga jual +Rp500, dan pelanggan sering belanja banyak!',
    },
  ];

  /** PRD 5.1 — Tipe pelanggan. MVP: biasa, anak sekolah, cerewet + ibu & ojek. */
  const CUSTOMER_TYPES = {
    biasa: {
      label: 'Pelanggan Biasa', patience: 45, minDay: 1, weight: 4,
      prefs: { air: 1, mie: 1.4, kopi: 1, susu: 0.6, keripik: 0.8 },
      distinct: [1, 2], qty: [1, 2], styles: ['short', 'long'],
      names: ['Pak Budi', 'Mas Joko', 'Mbak Sari', 'Pak Darto', 'Mas Andi', 'Mbak Rina', 'Pak Slamet'],
      lines: ['Permisi, Bang. Beli {order} ya.', 'Mas, {order}, berapa?', 'Beli {order}, Bang.', 'Bang, {order} ada?'],
    },
    anak: {
      label: 'Anak Sekolah', patience: 32, minDay: 1, weight: 3,
      prefs: { air: 0.6, mie: 0.3, kopi: 0, susu: 1.5, keripik: 2 },
      distinct: [1, 2], qty: [1, 2], styles: ['kid'],
      names: ['Dimas', 'Putri', 'Bayu', 'Nisa', 'Rizky', 'Ayu', 'Fajar'],
      lines: ['Bang! Beli {order}! Cepetan, nanti telat!', 'Mau {order}, uangnya dari Ibu.', 'Om, {order} dong. Hehe.'],
    },
    cerewet: {
      label: 'Pelanggan Cerewet', patience: 65, minDay: 1, weight: 2, chatty: true,
      prefs: { air: 1, mie: 1, kopi: 1, susu: 1, keripik: 1 },
      distinct: [2, 3], qty: [1, 2], styles: ['curly'],
      names: ['Bu Tejo', 'Bu Ijah', 'Tante Lilis', 'Bu Romlah', 'Mbak Yuyun'],
      lines: ['Eh Bang, saya mau {order}. Harganya nggak naik kan?', 'Saya mau {order}. Di warung sebelah habis, makanya ke sini.', 'Bang, {order}. Eh, tadi lihat Pak RT lewat nggak?'],
    },
    ibu: {
      label: 'Ibu Rumah Tangga', patience: 50, minDay: 2, weight: 2,
      prefs: { air: 0.8, mie: 2, kopi: 1, susu: 1.2, keripik: 0.6 },
      distinct: [2, 3], qty: [1, 3], styles: ['hijab'],
      names: ['Bu Siti', 'Bu Ani', 'Bu Wati', 'Bu Endang', 'Bu Yati'],
      lines: ['Bang, titip belanja: {order}.', '{order} ya Bang, buat masak nanti.', 'Bang, {order}. Anak saya minta terus.'],
    },
    ojek: {
      label: 'Tukang Ojek', patience: 28, minDay: 3, weight: 2,
      prefs: { air: 1.5, mie: 0.3, kopi: 2, susu: 0.2, keripik: 0.4 },
      distinct: [1, 2], qty: [1, 2], styles: ['helmet'],
      names: ['Bang Ucup', 'Mas Bejo', 'Bang Roni', 'Pak Kardi'],
      lines: ['Bang, {order}, cepet ya, lagi narik.', 'Ngaso dulu ah. {order}, Bang.', '{order}! Orderan lagi sepi nih.'],
    },
  };

  const LINES = {
    success: ['Makasih, Bang!', 'Mantap, cepet pelayanannya!', 'Sip, langganan deh.', 'Pas! Makasih ya.'],
    wrong: ['Lho, bukan itu pesanan saya, Bang.', 'Kok gini? Coba dicek lagi.', 'Bang, kurang fokus ya? Salah itu.', 'Hmm... kayaknya ada yang salah deh.'],
    angry: ['Lama banget! Ke warung sebelah aja ah.', 'Nggak jadi deh!', 'Ya ampun, keburu lapar.', 'Huh, pelayanannya lambat!'],
    impatient: ['Bang, masih lama?', 'Cepetan dong, Bang...', 'Duh, buru-buru nih.'],
    outOfStock: ['Yah, habis ya. Ya udah deh.', 'Lain kali stoknya ditambah, Bang.', 'Yaah... nggak jadi deh.'],
    lie: ['Lho, itu ada di rak! Nggak mau jualan?', 'Bohong! Itu kelihatan kok barangnya.'],
    changeShort: ['Kembaliannya kurang, Bang!', 'Eh, kurang nih kembaliannya.', 'Hitung lagi dong, Bang.'],
    changeOver: ['Wah kelebihan, rezeki nomplok!', 'Hehe, makasih ya Bang.'],
    honest: ['Bang, kembaliannya kelebihan nih, saya balikin.', 'Kelebihan, Bang. Nih saya kembalikan.'],
    qris: ['Saya scan QRIS ya Bang, pas {total}!', 'Bayar pakai QRIS aja ya Bang, langsung pas!'],
    chatter: [
      'Ini mi-nya yang baru apa yang lama?', 'Kok harganya naik sih?', 'Kemarin di warung sebelah lebih murah lho.',
      'Bisa ngutang nggak? Bercanda, bercanda.', 'Kopinya enak nggak? Yang kemarin pahit.',
      'Anaknya Bu Tini udah nikah lho, Bang.', 'Wah warungnya makin rame ya, udah buka cabang?',
    ],
    waiting: ['Sabar, saya antre kok.', 'Masih lama, Bang?', 'Antreannya panjang juga ya.', 'Santai, Bang.'],
  };

  /** v2.0.0 — 8 Upgrade Fasilitas Warung (per cabang). */
  const UPGRADES = [
    { id: 'rak',      name: 'Rak Tambahan',         cost: 75000,  passive: 3500, desc: 'Kapasitas stok tiap barang +15 di cabang ini.' },
    { id: 'kulkas',   name: 'Kulkas Minuman',       cost: 120000, passive: 4500, desc: 'Minuman dingin: harga jual minuman +Rp500. Listrik +Rp1.500/hari.' },
    { id: 'kasir',    name: 'Meja Kasir & Etalase', cost: 90000,  passive: 3500, desc: 'Pelayanan makin rapi: bonus tip +Rp500 tiap transaksi tanpa salah.' },
    { id: 'kursi',    name: 'Kursi Plastik',        cost: 60000,  passive: 2500, desc: 'Pelanggan lebih sabar (kesabaran turun 20% lebih lambat).' },
    { id: 'lampu',    name: 'Lampu Tambahan',       cost: 40000,  passive: 2000, desc: 'Warung terang di sore & malam. Pelanggan +10% lebih sabar.' },
    { id: 'papan',    name: 'Papan Nama Neon',      cost: 100000, passive: 4000, desc: 'Reputasi +5 dan pelanggan datang 15% lebih sering.' },
    { id: 'gorengan', name: 'Etalase Gorengan & Kopi', cost: 110000, passive: 5500, desc: 'Tambahan jajan gorengan spontan +Rp1.000 di setiap transaksi sukses!' },
    { id: 'ekspansi', name: 'Ekspansi Ruangan',     cost: 180000, passive: 7500, desc: 'Area warung luas: antrean maks 5 pelanggan, kapasitas stok +10 lagi.' },
  ];

  /** v2.0.0 — 4 Upgrade Jaringan Warung (berlaku di semua cabang). */
  const GLOBAL_UPGRADES = [
    { id: 'qris',     name: 'QRIS & Bayar Digital',    cost: 85000,  desc: '35% pelanggan di semua cabang bayar QRIS (uang pas otomatis, lebih cepat!).' },
    { id: 'wifi',     name: 'Kipas Angin & Free Wi-Fi', cost: 95000, desc: 'Reputasi +4 dan pelanggan di semua cabang 20% lebih sabar mengantre.' },
    { id: 'grosir',   name: 'Kontrak Gudang Grosir',   cost: 160000, desc: 'Harga beli semua barang di Supplier diskon 15% permanen!' },
    { id: 'karyawan', name: 'Pelatihan Karyawan Cabang', cost: 200000, desc: 'Setoran harian semua cabang yang beroperasi otomatis meningkat +40%!' },
  ];

  /** PRD 7 — Random events harian. */
  const EVENTS = [
    { id: 'normal', name: 'Hari Biasa',       weight: 5, desc: 'Tidak ada kejadian khusus. Semangat jualan!' },
    { id: 'diskon', name: 'Supplier Diskon',  weight: 2, desc: 'Harga beli {item} turun 30% hari ini.' },
    { id: 'hujan',  name: 'Hujan Deras',      weight: 2, desc: 'Pelanggan lebih jarang datang hari ini.' },
    { id: 'borong', name: 'Pelanggan Borong', weight: 2, desc: 'Ada kabar seseorang mau belanja banyak hari ini.' },
  ];

  const CASH_DENOMS = [2000, 5000, 10000, 20000, 50000];
  const CHANGE_DENOMS = [500, 1000, 2000, 5000, 10000, 20000];

  const PALETTE = {
    skin: ['#f5c9a0', '#e8b083', '#c98d5e', '#a8714a'],
    hair: ['#2b1d14', '#3d2817', '#1a1a1a', '#5a3a22'],
    shirt: ['#d9483b', '#3a7bd5', '#4caf50', '#f2a03d', '#8e5bc4', '#e86fa0', '#2d9c9c'],
    pants: ['#2f3b59', '#4a3b2a', '#3d3d3d', '#5b6b8a'],
    hijab: ['#c0392b', '#8e44ad', '#16a085', '#d35400', '#2c3e50', '#b5838d'],
  };

  function formatRp(n) {
    const neg = n < 0;
    const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-Rp' : 'Rp') + s;
  }

  function itemById(id) { return ITEMS.find((it) => it.id === id); }
  function branchById(id) { return BRANCHES.find((b) => b.id === id) || BRANCHES[0]; }

  const DATA = {
    APP_VERSION, ITEMS, DAY, START, OPERATIONAL_COST, COLD_BONUS, GORENGAN_BONUS,
    MAX_QUEUE, EXPANDED_MAX_QUEUE, BRANCHES, CUSTOMER_TYPES, LINES,
    UPGRADES, GLOBAL_UPGRADES, EVENTS, CASH_DENOMS, CHANGE_DENOMS, PALETTE,
    formatRp, itemById, branchById,
  };

  global.DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
