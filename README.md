# Warung Simulator 2D

> *"Modal pas-pasan, pelanggan banyak maunya."*

Game simulasi mengelola warung kelontong khas Indonesia bergaya **2D Pixel Art 16-bit** (orientasi **landscape**, resolusi dasar `480×270`), dibangun dengan **HTML5, CSS3, JavaScript, Canvas API, Web Audio API**, dan dibungkus menjadi aplikasi Android (APK) menggunakan **Capacitor**. 100% dapat dimainkan secara **offline**.

## Roadmap PRD yang Diimplementasikan (Berurutan)

1. **Phase 1 — Prototype**
   - Struktur HTML5 & layout mobile landscape responsif (`index.html`, `src/css/style.css`, `src/css/mobile.css`).
   - Latar warung Indonesia 2D side-view (`src/js/Renderer.js`): papan nama *Warung Berkah*, atap genteng, terpal hijau-putih, rak mi instan & jajanan, rentengan kopi & sampo, tabung gas 3kg, galon air, meja kasir, toples kerupuk, rolling door buka/tutup, rumah tetangga, pohon pisang, tiang listrik, siklus siang–sore–malam & hujan.
   - Sprite karakter chibi pixel art & ikon 5 barang dagangan (`src/js/Sprites.js`).
   - Kontrol sentuh dasar pada tombol panel bawah maupun langsung mengetuk rak barang & pelanggan di kanvas.
2. **Phase 2 — Core Gameplay**
   - Sistem kedatangan & antrean pelanggan otomatis (`src/js/CustomerManager.js`): 3 tipe MVP (*Pelanggan Biasa*, *Anak Sekolah*, *Pelanggan Cerewet*) ditambah *Ibu Rumah Tangga* (Hari 2) dan *Tukang Ojek* (Hari 3).
   - Dialog humoris, daftar pesanan, kesabaran, dan emote karakter.
   - Sistem inventaris 5 barang awal (`Air Mineral`, `Mi Instan`, `Kopi Sachet`, `Susu Kotak`, `Keripik`) di `src/js/InventoryManager.js`.
   - Sistem keranjang, validasi pesanan (dengan kesempatan memperbaiki jika salah), serta pembayaran & hitung kembalian di `src/js/TransactionManager.js`.
3. **Phase 3 — Economy & Save**
   - Sistem saldo, pendapatan, HPP rata-rata, biaya operasional, target harian, reputasi, dan rumus **Keuntungan Kotor = Pendapatan Penjualan − Harga Pokok Barang Terjual** (`src/js/EconomyManager.js`).
   - Menu **Supplier** (pilih jumlah, diskon harian, total biaya, validasi saldo & kapasitas) dan **Upgrade Warung** (`Rak Tambahan`, `Kulkas Minuman`, `Meja Kasir & Etalase`, `Kursi Plastik`, `Lampu Tambahan`, `Papan Nama Baru`) beserta perubahan visual langsung di warung.
   - Laporan harian lengkap, pergantian hari otomatis, random events ringan (*Hari Biasa*, *Supplier Diskon*, *Hujan Deras*, *Pelanggan Borong*).
   - Simpan & lanjutkan progres otomatis via `LocalStorage` dengan validasi data rusak & konfirmasi Permainan Baru (`src/js/SaveManager.js`).
4. **Phase 4 — Android (Capacitor)**
   - Konfigurasi `package.json`, `capacitor.config.json`, dan platform `android/`.
   - Penguncian orientasi `sensorLandscape`, mode layar penuh imersif (`MainActivity.java`), dukungan tombol Back Android, serta ikon & splash pixel-art *Warung Berkah*.
   - Otomatisasi build Debug APK melalui GitHub Actions (`.github/workflows/build-apk.yml`).
5. **Phase 5 — Polish**
   - Musik latar santai & efek suara lengkap berbasis Web Audio API (bel pelanggan, ambil barang, uang diterima, transaksi berhasil, stok habis, tombol UI, rolling door) dengan pengaturan volume (`src/js/AudioManager.js`).
   - Auto-pause saat membuka modal atau berpindah aplikasi, bantuan hitung kembalian, opsi kecepatan hari, serta pengujian otomatis unit & E2E.

## Struktur Project

```text
Warung-simulator/
├── index.html
├── package.json
├── capacitor.config.json
├── scripts/
│   ├── serve.js          # Server lokal ringan untuk browser
│   ├── prepare-web.js    # Bundler folder www/ untuk Capacitor
│   └── gen-icons.js      # Generator ikon & splash pixel-art Android
├── src/
│   ├── css/
│   │   ├── style.css
│   │   └── mobile.css
│   ├── js/
│   │   ├── main.js
│   │   ├── data.js
│   │   ├── Sprites.js
│   │   ├── Renderer.js
│   │   ├── AudioManager.js
│   │   ├── InventoryManager.js
│   │   ├── EconomyManager.js
│   │   ├── TransactionManager.js
│   │   ├── CustomerManager.js
│   │   ├── SaveManager.js
│   │   ├── UIManager.js
│   │   └── GameManager.js
│   └── assets/
├── tests/
│   ├── game.test.js      # Unit test logika inventaris, transaksi, ekonomi & save
│   └── e2e.mjs           # Pengujian end-to-end di browser Chromium
├── android/              # Project Android Capacitor siap build APK
└── .github/workflows/
    └── build-apk.yml     # CI otomatis build & upload Debug APK
```

## Menjalankan & Menguji

```bash
# 1. Jalankan di browser lokal (http://127.0.0.1:8080)
npm run dev

# 2. Jalankan unit tests
npm test

# 3. Jalankan E2E browser test (membutuhkan Chromium/Chrome)
npm run test:e2e
```

## Build APK Android

### Melalui GitHub Actions (otomatis)
Setiap push ke branch `main` menjalankan workflow **Build Android APK** dan menghasilkan artifact **`warung-simulator-2d-debug-apk`** yang dapat langsung diunduh dan dipasang di perangkat Android.

### Lokal (Android Studio / Gradle)
Membutuhkan Node.js, JDK 17, dan Android SDK (API 34):

```bash
npm install
npm run android:apk
# Output APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Atau buka di Android Studio:

```bash
npm run cap:sync
npm run android:open
```
