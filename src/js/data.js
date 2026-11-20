/* ==========================================================
 * data.js — Data statis Warung Simulator 2D
 * Barang, tipe pelanggan, dialog, upgrade, event, konstanta.
 * ========================================================== */
(function (global) {
  'use strict';

  /** PRD 5.3 — Data barang awal (harga dapat diubah saat balancing). */
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

  const OPERATIONAL_COST = 5000; // listrik + kebersihan per hari
  const COLD_BONUS = 500;        // tambahan harga minuman dingin (upgrade kulkas)
  const MAX_QUEUE = 4;           // 1 di kasir + 3 antre

  /** PRD 5.1 — Tipe pelanggan. MVP: biasa, anak sekolah, cerewet. */
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
    chatter: [
      'Ini mi-nya yang baru apa yang lama?', 'Kok harganya naik sih?', 'Kemarin di warung sebelah lebih murah lho.',
      'Bisa ngutang nggak? Bercanda, bercanda.', 'Kopinya enak nggak? Yang kemarin pahit.',
      'Anaknya Bu Tini udah nikah lho, Bang.', 'Wah warungnya makin rame ya sekarang.',
    ],
    waiting: ['Sabar, saya antre kok.', 'Masih lama, Bang?', 'Antreannya panjang juga ya.', 'Santai, Bang.'],
  };

  /** PRD 6.2 — Upgrade warung. */
  const UPGRADES = [
    { id: 'rak',    name: 'Rak Tambahan',    cost: 75000,  desc: 'Kapasitas stok tiap barang +15.' },
    { id: 'kulkas', name: 'Kulkas Minuman',  cost: 120000, desc: 'Minuman dingin: harga jual minuman +Rp500. Listrik +Rp1.500/hari.' },
    { id: 'kasir',  name: 'Meja Kasir & Etalase', cost: 90000, desc: 'Pelayanan makin rapi: bonus tip +Rp500 tiap transaksi tanpa salah.' },
    { id: 'kursi',  name: 'Kursi Plastik',   cost: 60000,  desc: 'Pelanggan lebih sabar (kesabaran turun 20% lebih lambat).' },
    { id: 'lampu',  name: 'Lampu Tambahan',  cost: 40000,  desc: 'Warung terang di sore & malam. Pelanggan sedikit lebih sabar.' },
    { id: 'papan',  name: 'Papan Nama Baru', cost: 100000, desc: 'Reputasi +5 dan pelanggan datang lebih sering.' },
  ];

  /** PRD 7 — Random events (versi sederhana). */
  const EVENTS = [
    { id: 'normal', name: 'Hari Biasa',      weight: 5, desc: 'Tidak ada kejadian khusus. Semangat jualan!' },
    { id: 'diskon', name: 'Supplier Diskon', weight: 2, desc: 'Harga beli {item} turun 30% hari ini.' },
    { id: 'hujan',  name: 'Hujan Deras',     weight: 2, desc: 'Pelanggan lebih jarang datang hari ini.' },
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

  const DATA = {
    ITEMS, DAY, START, OPERATIONAL_COST, COLD_BONUS, MAX_QUEUE, CUSTOMER_TYPES, LINES,
    UPGRADES, EVENTS, CASH_DENOMS, CHANGE_DENOMS, PALETTE, formatRp, itemById,
  };

  global.DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
