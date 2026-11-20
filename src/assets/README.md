# Aset Warung Simulator 2D

Sesuai PRD Bagian 12, direktori ini menampung struktur aset permainan:

- `ui/` — Ikon aplikasi pixel-art (`icon.svg` dan ikon launcher PNG untuk Android).
- `backgrounds/` — Latar warung 2D dirender secara prosedural pada resolusi dasar `480×270` 16-bit melalui `src/js/Renderer.js` agar ringan dan 100% offline.
- `characters/` — Sprite karakter chibi 16×23 (jalan, diam, senang, marah, peci, hijab, seragam sekolah, helm ojek) dibangun di `src/js/Sprites.js`.
- `items/` — Ikon 5 barang dagangan 12×12 (`Air Mineral`, `Mi Instan`, `Kopi Sachet`, `Susu Kotak`, `Keripik`) dibangun di `src/js/Sprites.js`.
- `audio/` — Musik santai dan seluruh efek suara disintesis secara real-time melalui Web Audio API di `src/js/AudioManager.js` (tanpa file audio besar sehingga ukuran APK sangat kecil).
