# Warung Simulator 2D (v2.0.0)

> *"Modal pas-pasan, pelanggan banyak maunya."*

Game simulasi mengelola warung kelontong & jaringan cabang khas Indonesia bergaya **2D Pixel Art 16-bit** (orientasi **landscape**, resolusi dasar `480×270`), dibangun dengan **HTML5, CSS3, JavaScript, Canvas API, Web Audio API**, dan dibungkus menjadi aplikasi Android (APK) menggunakan **Capacitor**. 100% dapat dimainkan secara **offline**.

## Pembaruan Utama v2.0.0 — Buka Cabang & 12 Upgrade

### 1. Sistem Buka Cabang Warung (4 Lokasi Unik)
- **Warung Berkah Pusat** *(awal)* — Gang perumahan, terpal hijau-putih, operasional ringan.
- **Cabang Depan Sekolah** *(Rp150.000, Rep ≥ 55)* — Depan SDN 01 lengkap dengan pagar sekolah & bendera Merah Putih berkibar; kedatangan +20% lebih cepat dan jajanan sangat laris.
- **Cabang Kosan & Kampus** *(Rp280.000, Rep ≥ 65)* — Area ruko kos 2 lantai; harga jual seluruh barang **+Rp500**, mi instan & kopi sachet laris hingga malam.
- **Cabang Pinggir Pasar** *(Rp450.000, Rep ≥ 75)* — Kios pasar ramai; kedatangan +35%, harga jual **+Rp500**, dan pelanggan sering borongan.
- **Setoran Otomatis Cabang Lain:** Cabang yang sudah dibuka namun tidak sedang dijaga hari itu tetap beroperasi otomatis dan menyetor keuntungan harian langsung ke Laporan Harian & saldo!

### 2. 12 Upgrade Warung (Per Cabang & Jaringan Global)
- **8 Upgrade Fasilitas per Cabang** *(tampil langsung secara visual di warung)*:
  1. **Rak Tambahan** (+15 kapasitas stok/barang)
  2. **Kulkas Minuman** (harga minuman dingin +Rp500)
  3. **Meja Kasir & Etalase** (bonus tip +Rp500 transaksi tanpa salah)
  4. **Kursi Plastik** (kesabaran turun 20% lebih lambat)
  5. **Lampu Tambahan** (pencahayaan sore/malam + kesabaran)
  6. **Papan Nama Neon** (+5 reputasi & +15% kedatangan)
  7. **Etalase Gorengan & Kopi Seduh** *(BARU)* — tambahan jajan spontan +Rp1.000 setiap transaksi sukses!
  8. **Ekspansi Ruangan** *(BARU)* — kanopi & bendera hias, antrean maksimal naik jadi **5 pelanggan**, kapasitas stok +10 lagi!
- **4 Upgrade Jaringan Semua Cabang**:
  9. **QRIS & Bayar Digital** *(BARU)* — 35% pelanggan membayar QRIS (uang pas otomatis, 1 tap!)
  10. **Kipas Angin & Free Wi-Fi** *(BARU)* — kipas dinding berputar, stiker Wi-Fi, +4 reputasi & kesabaran +20% di semua cabang
  11. **Kontrak Gudang Grosir** *(BARU)* — diskon harga beli Supplier **15% permanen** di semua cabang
  12. **Pelatihan Karyawan Cabang** *(BARU)* — setoran harian semua cabang otomatis naik **+40%**!

### 3. Migrasi Data Simpan Otomatis
Progres tersimpan dari `v1.1.0` otomatis dimigrasikan ke format `v2.0.0` tanpa kehilangan saldo, hari, stok, maupun upgrade cabang Pusat.

## Menjalankan & Menguji

```bash
# 1. Jalankan di browser lokal (http://127.0.0.1:8080)
npm run dev

# 2. Jalankan unit tests
npm test

# 3. Jalankan E2E browser test (membutuhkan Chromium/Chrome)
npm run test:e2e
```

## Build & Unduh APK Android

- **Unduh langsung (GitHub Releases):** Tersedia di halaman [Releases](https://github.com/Ryn-debugging/Warung-simulator/releases) (`warung-simulator-2d-v2.0.0-debug.apk`).
- **Build lokal (Android Studio / Gradle):**
  ```bash
  npm install
  npm run android:apk
  # Output: android/app/build/outputs/apk/debug/app-debug.apk
  ```
