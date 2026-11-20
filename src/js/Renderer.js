/* ==========================================================
 * Renderer.js — Rendering dunia 2D (Canvas API).
 * Dunia digambar ke buffer pixel (tinggi 270px) lalu diperbesar
 * tanpa smoothing; teks & emoji digambar di lapisan resolusi tinggi.
 * Koordinat "inti" (core) selebar 480px berada di tengah layar.
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA;
  const H = 270;

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lerpColor(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }
  function lerpHex(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
  }
  function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

  class Renderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.game = game;
      this.buf = document.createElement('canvas');
      this.b = this.buf.getContext('2d');
      this.bw = 480; this.extra = 0; this.scale = 1; this.dpr = 1; this.offY = 0;
      this.time = 0;
      this.floats = [];
      this.ownerHop = 0;
      this.shutterPos = 0; // 0 = terbuka, 1 = tertutup
      this.flashItem = null;
      this.flashT = 0;
      this.drops = [];
      this.hitRegions = [];
      this.labels = [];
      this.demoState = null;
      this.ownerLook = { style: 'peci', skin: '#e0a878', hair: '#2b1d14', shirt: '#f2f2f2', pants: '#3d3d3d', acc: '#151515' };
      this.ownerSprites = {};
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
      canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    }

    resize() {
      const parent = this.canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      const cssW = Math.max(1, rect.width), cssH = Math.max(1, rect.height);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(cssW * this.dpr);
      this.canvas.height = Math.round(cssH * this.dpr);
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      this.scale = cssH / H;
      this.offY = 0;
      if (cssW / this.scale < 480) { // layar sempit: muat lebar, rata bawah
        this.scale = cssW / 480;
        this.offY = cssH - H * this.scale;
      }
      this.bw = Math.min(1200, Math.max(480, Math.ceil(cssW / this.scale)));
      this.extra = Math.floor((this.bw - 480) / 2);
      this.buf.width = this.bw;
      this.buf.height = H;
      this.cssW = cssW; this.cssH = cssH;
    }

    toWorld(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / this.scale - this.extra,
        y: (clientY - rect.top - this.offY) / this.scale,
      };
    }

    onPointer(e) {
      const g = this.game;
      if (!g.state || g.isBlocked()) return;
      g.audio.unlock();
      const p = this.toWorld(e.clientX, e.clientY);
      const c = g.customers && g.customers.hitTest(p.x, p.y);
      if (c) { g.onTapCustomer(c); return; }
      for (const r of this.hitRegions) {
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          g.pickItem(r.id, true);
          return;
        }
      }
    }

    addFloat(text, x, y, color) {
      this.floats.push({ text, x, y, life: 1.6, color: color || '#ffe066' });
    }

    hop() { this.ownerHop = 0.18; }

    flashShelf(id) { this.flashItem = id; this.flashT = 0.22; }

    itemCenter(id) {
      const r = this.hitRegions.find((h) => h.id === id);
      return r ? { x: r.x + r.w / 2, y: r.y + 8 } : { x: 240, y: 120 };
    }

    // ---------- Primitif ----------
    r(x, y, w, h, col) {
      this.b.fillStyle = col;
      this.b.fillRect(Math.round(x + this.extra), Math.round(y), Math.round(w), Math.round(h));
    }
    img(cv, x, y, s) {
      const sc = s || 1;
      this.b.drawImage(cv, Math.round(x + this.extra), Math.round(y), cv.width * sc, cv.height * sc);
    }

    // ---------- Loop render ----------
    render(dt) {
      this.time += dt;
      if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
      const g = this.game;
      let state = g.state;
      const inMenu = !state;
      if (!state) {
        if (!this.demoState) {
          this.demoState = SaveManager.createNewState();
          this.demoState.clockMin = 16.9 * 60;
          D.ITEMS.forEach((it) => { this.demoState.stock[it.id] = 12; });
        }
        state = this.demoState;
      }
      const wantClosed = !inMenu && (state.phase === 'prep' || state.phase === 'report');
      const targetShutter = wantClosed ? 0.88 : 0;
      const diff = targetShutter - this.shutterPos;
      if (Math.abs(diff) > 0.005) {
        this.shutterPos += Math.sign(diff) * Math.min(Math.abs(diff), dt * 2.4);
      } else {
        this.shutterPos = targetShutter;
      }
      const customers = g.state && g.customers ? g.customers.list : [];
      this.labels = [];
      this.drawWorld(state, customers, dt);
      this.present(state, customers, dt);
    }

    drawWorld(s, customers, dt) {
      const b = this.b;
      b.imageSmoothingEnabled = false;
      const hour = s.clockMin / 60;
      const rain = s.event && s.event.id === 'hujan' && (s.phase === 'open' || s.phase === 'closing');

      this.drawSky(hour, rain);
      this.drawBackground(hour);
      this.drawWarung(s);
      this.drawStreet(s);

      // Pelanggan (urut berdasarkan y)
      const sorted = customers.slice().sort((a, c) => a.y - c.y || c.x - a.x);
      for (const c of sorted) this.drawCustomer(c);

      if (rain) this.drawRain(dt);
      this.drawLighting(s, hour, rain);
    }

    drawSky(hour, rain) {
      const day = ['#6ec6f0', '#cfeefa'], dusk = ['#f08a4b', '#ffd8a0'], night = ['#141a3a', '#3b3f72'];
      let top, bot;
      if (hour < 16.5) { top = day[0]; bot = day[1]; }
      else if (hour < 18) { const t = (hour - 16.5) / 1.5; top = lerpHex(day[0], dusk[0], t); bot = lerpHex(day[1], dusk[1], t); }
      else if (hour < 19.3) { const t = (hour - 18) / 1.3; top = lerpHex(dusk[0], night[0], t); bot = lerpHex(dusk[1], night[1], t); }
      else { top = night[0]; bot = night[1]; }
      if (rain) { top = lerpHex(top, '#6b7684', 0.6); bot = lerpHex(bot, '#9aa3ad', 0.6); }
      const band = 6;
      for (let y = 0; y < 200; y += band) {
        this.b.fillStyle = lerpColor(top, bot, y / 200);
        this.b.fillRect(0, y, this.bw, band);
      }
      // Matahari / bulan
      if (!rain) {
        if (hour < 18.2) {
          const t = Math.min(1, (hour - 8) / 10);
          const sx = 60 + t * 380, sy = 70 - Math.sin(t * Math.PI) * 50 + (hour > 17 ? (hour - 17) * 20 : 0);
          this.r(sx - 6, sy - 6, 12, 12, hour > 16.5 ? '#ffb347' : '#fff2a8');
          this.r(sx - 8, sy - 4, 16, 8, hour > 16.5 ? '#ffb347' : '#fff2a8');
          this.r(sx - 4, sy - 8, 8, 16, hour > 16.5 ? '#ffb347' : '#fff2a8');
        } else {
          this.r(400, 20, 10, 10, '#f4f1d0'); this.r(398, 22, 14, 6, '#f4f1d0'); this.r(404, 20, 6, 6, '#3b3f72');
          for (let i = 0; i < 18; i++) {
            const x = hash(i) * this.bw - this.extra, y = hash(i + 50) * 60;
            if (Math.sin(this.time * 2 + i) > -0.3) this.r(x, y, 1, 1, '#ffffff');
          }
        }
      }
      // Awan
      const cloudCol = rain ? '#8a929c' : (hour > 18.5 ? '#4a4f7a' : '#ffffff');
      for (let i = 0; i < 5; i++) {
        const span = this.bw + 80;
        const x = ((hash(i + 9) * span + this.time * (4 + i)) % span) - 40 - this.extra;
        const y = 10 + hash(i + 3) * 40;
        this.r(x, y, 26, 6, cloudCol); this.r(x + 5, y - 4, 14, 5, cloudCol); this.r(x + 3, y + 5, 20, 3, cloudCol);
      }
    }

    drawBackground(hour) {
      const walls = ['#e7c8a0', '#c9d8b6', '#f0d9a8', '#b8cfd8', '#e3b5a4', '#d6c6e1'];
      const roofs = ['#9c4a2f', '#7d3f2a', '#a85d3c', '#5f6b73'];
      const night = hour > 18.5;
      const startX = -this.extra - 64;
      for (let i = 0; startX + i * 66 < 480 + this.extra + 66; i++) {
        const x = startX + i * 66;
        const hgt = 60 + Math.floor(hash(i + 1) * 40);
        const top = 196 - hgt;
        const wall = walls[Math.floor(hash(i + 7) * walls.length)];
        const roof = roofs[Math.floor(hash(i + 11) * roofs.length)];
        this.r(x, top, 60, hgt, wall);
        for (let k = 0; k < 8; k++) this.r(x - 4 + k, top - 8 + k, 68 - k * 2, 1, roof);
        this.r(x - 4, top - 1, 68, 2, Sprites.shade(roof, -0.3));
        const winCol = night ? '#ffd27a' : '#5a7d95';
        this.r(x + 10, top + 16, 12, 12, '#5b4030'); this.r(x + 11, top + 17, 10, 10, winCol);
        this.r(x + 38, top + 16, 12, 12, '#5b4030'); this.r(x + 39, top + 17, 10, 10, winCol);
        this.r(x + 24, 196 - 30, 12, 30, '#6b4a33');
      }
      // pohon pisang di sisi kanan & kiri
      this.drawBanana(458, 120);
      this.drawBanana(-30, 130);
      // tiang listrik
      this.r(12, 18, 4, 199, '#6d6d6d');
      this.r(2, 24, 24, 3, '#555555');
      for (let x = -this.extra; x < 480 + this.extra; x++) {
        const t = ((x + 1000) % 240) / 240;
        const sag = Math.sin(t * Math.PI) * 8;
        this.r(x, 24 + sag, 1, 1, '#2c2c2c');
        this.r(x, 28 + sag * 0.8, 1, 1, '#2c2c2c');
      }
    }

    drawBanana(x, y) {
      this.r(x + 8, y, 4, 196 - y, '#7a8f3a');
      const leaf = '#4f9a3a';
      this.r(x - 6, y - 4, 16, 4, leaf); this.r(x - 10, y, 8, 3, leaf);
      this.r(x + 10, y - 8, 16, 4, leaf); this.r(x + 22, y - 4, 6, 3, leaf);
      this.r(x + 2, y - 14, 12, 4, '#5fb04a'); this.r(x + 6, y - 18, 6, 4, '#5fb04a');
    }

    drawWarung(s) {
      const stock = s.stock;
      const u = s.upgrades;
      this.hitRegions = [];
      // Dinding dalam
      this.r(40, 46, 400, 150, '#e8d6a0');
      for (let x = 40; x < 440; x += 16) this.r(x, 46, 1, 150, '#dcc78f');
      this.r(40, 176, 400, 20, '#b98b5a');
      this.r(40, 176, 400, 2, '#8f6339');
      // Kalender & jam dinding
      this.r(160, 72, 22, 26, '#ffffff'); this.r(160, 72, 22, 6, '#d9342b'); this.r(164, 82, 14, 1, '#999'); this.r(164, 86, 14, 1, '#999'); this.r(164, 90, 10, 1, '#999');
      this.r(300, 76, 14, 14, '#5a3a22'); this.r(302, 78, 10, 10, '#ffffff'); this.r(306, 80, 1, 4, '#222'); this.r(307, 83, 3, 1, '#222');

      // ---- Rak kiri ----
      this.r(50, 70, 100, 126, '#a8743f');
      this.r(50, 70, 3, 126, '#6b4423'); this.r(147, 70, 3, 126, '#6b4423'); this.r(50, 68, 100, 3, '#6b4423');
      const rows = [{ id: 'mie', y: 92 }, { id: 'keripik', y: 122 }, { id: 'susu', y: 152 }];
      const perRow = 7;
      rows.forEach((row) => {
        this.r(50, row.y, 100, 3, '#7a4f2a');
        const n = Math.min(stock[row.id] || 0, perRow);
        const ic = Sprites.icon(row.id);
        for (let i = 0; i < n; i++) this.img(ic, 55 + i * 13, row.y - 12);
        this.hitRegions.push({ id: row.id, x: 50, y: row.y - 22, w: 100, h: 25 });
        if (!stock[row.id]) this.labels.push({ text: 'HABIS', x: 100, y: row.y - 6 });
      });
      this.r(50, 182, 100, 3, '#7a4f2a');
      const deco = ['#d9342b', '#3a7bd5', '#f2c12e', '#4caf50', '#e86fa0', '#ffffff', '#8e5bc4'];
      for (let i = 0; i < 7; i++) { this.r(55 + i * 13, 172, 10, 10, deco[i]); this.r(57 + i * 13, 175, 6, 3, '#ffffff'); }

      // ---- Rak tambahan (upgrade) atau tabung gas ----
      if (u.rak) {
        this.r(152, 104, 40, 92, '#a8743f');
        this.r(152, 104, 2, 92, '#6b4423'); this.r(190, 104, 2, 92, '#6b4423'); this.r(152, 102, 40, 3, '#6b4423');
        [{ id: 'mie', y: 126 }, { id: 'keripik', y: 152 }, { id: 'susu', y: 178 }].forEach((row) => {
          this.r(152, row.y, 40, 3, '#7a4f2a');
          const n = Math.max(0, Math.min((stock[row.id] || 0) - perRow, 3));
          const ic = Sprites.icon(row.id);
          for (let i = 0; i < n; i++) this.img(ic, 154 + i * 12, row.y - 12);
        });
      } else {
        this.drawGas(158, 172); this.drawGas(172, 174);
      }

      // ---- Kopi sachet renteng (gantung) ----
      const kopi = stock.kopi || 0;
      const kIc = Sprites.icon('kopi');
      const strips = [Math.min(6, Math.ceil(kopi / 2)), Math.min(6, Math.floor(kopi / 2))];
      strips.forEach((n, si) => {
        const x = 198 + si * 14;
        this.r(x + 5, 58, 1, 4, '#555');
        for (let j = 0; j < n; j++) this.img(kIc, x, 61 + j * 10);
      });
      this.hitRegions.push({ id: 'kopi', x: 194, y: 56, w: 32, h: 72 });
      if (!kopi) this.labels.push({ text: 'HABIS', x: 211, y: 72 });

      // ---- Air mineral: kulkas atau peti ----
      const air = stock.air || 0;
      const aIc = Sprites.icon('air');
      if (u.kulkas) {
        this.r(228, 96, 40, 100, '#d63c3c');
        this.r(228, 96, 40, 10, '#ffffff');
        this.r(232, 108, 32, 82, '#bfe6f5');
        this.r(232, 108, 2, 82, '#e9f7fc');
        [130, 156, 182].forEach((sy, ri) => {
          this.r(232, sy, 32, 2, '#8fb8c8');
          const n = Math.max(0, Math.min(2, air - ri * 2));
          for (let i = 0; i < n; i++) this.img(aIc, 235 + i * 14, sy - 12);
        });
        this.r(264, 130, 2, 14, '#888');
        this.labels.push({ text: 'DINGIN', x: 248, y: 102, small: true, color: '#d63c3c' });
        this.hitRegions.push({ id: 'air', x: 228, y: 96, w: 40, h: 100 });
      } else {
        this.r(230, 182, 34, 14, '#9a6a3a');
        this.r(230, 182, 34, 2, '#6b4423'); this.r(230, 188, 34, 1, '#6b4423');
        const pos = [[231, 170], [242, 170], [253, 170], [236, 158], [247, 158], [242, 146]];
        for (let i = 0; i < Math.min(air, pos.length); i++) this.img(aIc, pos[i][0], pos[i][1]);
        this.hitRegions.push({ id: 'air', x: 228, y: 140, w: 40, h: 56 });
      }
      if (!air) this.labels.push({ text: 'HABIS', x: 247, y: 176 });

      // ---- Renteng dekorasi (sachet sampo dll) ----
      const sachet = ['#e86fa0', '#3a7bd5', '#f2c12e', '#2d9c9c', '#d9342b', '#8e5bc4'];
      for (let i = 0; i < 10; i++) {
        const x = 286 + i * 14;
        const len = 3 + Math.floor(hash(i + 20) * 3);
        this.r(x + 3, 58, 1, 2, '#555');
        for (let j = 0; j < len; j++) {
          this.r(x, 60 + j * 7, 8, 6, sachet[(i + j) % sachet.length]);
          this.r(x + 2, 62 + j * 7, 4, 2, '#ffffff');
        }
      }

      // ---- Pemilik warung (di belakang meja) ----
      this.drawOwner();

      // ---- Galon air mineral di samping meja ----
      this.drawGalon(204, 174);

      // ---- Meja kasir / Etalase ----
      if (u.kasir) {
        // Etalase kaca + kasir rapi (upgrade)
        this.r(270, 168, 162, 28, '#9a6838');
        this.r(266, 164, 170, 5, '#c9d6df');
        this.r(266, 164, 170, 1, '#ffffff');
        // kaca etalase di depan
        this.r(274, 170, 98, 22, '#cce8f4');
        this.r(276, 171, 4, 20, '#ebf7fc');
        this.r(274, 180, 98, 2, '#7fa4b5');
        // jajanan & gorengan di dalam etalase
        const snackCol = ['#e8a33a', '#d9534f', '#f0ad4e', '#e67e22', '#c0392b', '#f2c12e'];
        for (let i = 0; i < 6; i++) {
          this.r(278 + i * 15, 174, 10, 6, snackCol[i]);
          this.r(278 + i * 15, 184, 10, 6, snackCol[(i + 2) % 6]);
        }
        // spanduk rapi di sisi kanan
        this.r(376, 173, 52, 18, '#f7d046');
        this.r(376, 173, 52, 1, '#c9a227'); this.r(376, 190, 52, 1, '#c9a227');
        // mesin kasir modern mini
        this.r(274, 152, 24, 12, '#2d3a4b'); this.r(276, 154, 20, 4, '#7bf0a0'); this.r(276, 159, 20, 3, '#1c2633');
      } else {
        this.r(270, 170, 162, 26, '#8b5a2b');
        this.r(266, 166, 170, 5, '#5a341a');
        for (let x = 270; x < 432; x += 18) this.r(x, 171, 1, 25, '#6e4520');
        this.r(286, 176, 132, 15, '#f7d046');
        this.r(286, 176, 132, 1, '#c9a227'); this.r(286, 190, 132, 1, '#c9a227');
        // kaleng uang / kalkulator
        this.r(276, 156, 20, 10, '#3d5a80'); this.r(278, 158, 16, 3, '#9ad0a0'); this.r(278, 162, 16, 3, '#2c405c');
      }
      // toples kerupuk
      const fill = ['#f2d27a', '#e86fa0', '#f08a24'];
      for (let i = 0; i < 3; i++) {
        const x = 384 + i * 15;
        this.r(x, 150, 12, 16, '#d8eef5');
        this.r(x + 1, 156, 10, 9, fill[i]);
        this.r(x + 1, 151, 2, 13, '#ffffff');
        this.r(x - 1, 147, 14, 4, '#c0392b');
      }

      // Highlight rak yang baru disentuh
      if (this.flashT > 0 && this.flashItem) {
        const hr = this.hitRegions.find((h) => h.id === this.flashItem);
        if (hr) {
          this.b.fillStyle = 'rgba(255, 240, 150, ' + (this.flashT * 1.8).toFixed(2) + ')';
          this.b.fillRect(Math.round(hr.x + this.extra), Math.round(hr.y), Math.round(hr.w), Math.round(hr.h));
        }
      }

      // ---- Pintu rolling door (tutup saat persiapan / selesai) ----
      if (this.shutterPos > 0.01) {
        const sh = Math.round(136 * this.shutterPos);
        this.r(40, 60, 400, sh, '#637a72');
        for (let y = 64; y < 60 + sh; y += 6) {
          this.r(40, y, 400, 1, '#4b5f58');
          this.r(40, y + 1, 400, 1, '#7c948b');
        }
        this.r(40, 60 + sh - 4, 400, 4, '#3b4a45');
        if (this.shutterPos > 0.65) {
          // papan kecil "TUTUP"
          this.r(214, 114, 52, 22, '#24170f');
          this.r(216, 116, 48, 18, '#c8372d');
          this.labels.push({ text: 'TUTUP', x: 240, y: 125, color: '#fff6d6' });
        }
      }

      // ---- Tiang depan & spanduk kecil ----
      this.r(34, 44, 6, 152, '#7a4a26'); this.r(35, 44, 1, 152, '#9a643a');
      this.r(440, 44, 6, 152, '#7a4a26'); this.r(441, 44, 1, 152, '#9a643a');
      // spanduk vertikal kecil di tiang kiri
      this.r(22, 68, 14, 52, '#d9342b');
      this.r(23, 69, 12, 16, '#f7d046');
      this.r(24, 90, 10, 3, '#ffffff');
      this.r(24, 96, 10, 3, '#ffffff');
      this.r(24, 102, 10, 3, '#ffe066');
      this.r(24, 108, 10, 3, '#ffffff');

      // ---- Terpal / awning bergaris ----
      for (let x = 30, i = 0; x < 450; x += 10, i++) {
        const col = i % 2 ? '#f0efe6' : '#2e8b57';
        this.r(x, 46, 10, 12, col);
        this.r(x + 1, 58, 8, 2, col);
        this.r(x + 3, 60, 4, 1, col);
      }
      this.r(30, 46, 420, 1, '#1d5e3a');

      // ---- Atap genteng ----
      for (let y = 30; y < 46; y++) {
        const inset = Math.floor((46 - y) / 3);
        this.r(28 + inset, y, 424 - inset * 2, 1, (y % 4 === 0) ? '#8f3f22' : '#b5532f');
      }
      for (let x = 32; x < 448; x += 8) this.r(x + ((x / 8) % 2) * 4, 32, 1, 12, '#9a4527');
      this.r(26, 44, 428, 3, '#6b3a22');

      // ---- Papan nama ----
      const papan = u.papan;
      this.r(170, 24, 3, 8, '#4a3020'); this.r(307, 24, 3, 8, '#4a3020');
      this.r(148, 3, 184, 26, papan ? '#d4a017' : '#2b1d14');
      this.r(150, 5, 180, 22, papan ? '#b8262b' : '#1f6f8b');
      if (papan) {
        for (let x = 152; x < 330; x += 8) {
          const on = Math.floor(this.time * 3 + x / 8) % 2 === 0;
          this.r(x, 4, 2, 1, on ? '#fff6a0' : '#a07d10');
          this.r(x, 27, 2, 1, on ? '#a07d10' : '#fff6a0');
        }
      }

      // ---- Lampu ----
      const bulbs = u.lampu ? [110, 240, 360] : [240];
      bulbs.forEach((x) => { this.r(x, 60, 1, 6, '#333'); this.r(x - 2, 66, 5, 5, '#fff4c2'); this.r(x - 1, 65, 3, 1, '#777'); });
      this.bulbs = bulbs;
    }

    drawGas(x, y) {
      this.r(x, y + 4, 12, 18, '#4caf50');
      this.r(x + 1, y + 2, 10, 2, '#4caf50');
      this.r(x + 4, y - 1, 4, 3, '#8a8a8a');
      this.r(x + 2, y + 8, 2, 10, '#7bd27f');
      this.r(x, y + 14, 12, 2, '#ffffff');
    }

    drawGalon(x, y) {
      this.r(x + 4, y, 6, 3, '#2a6fdb');
      this.r(x + 2, y + 3, 10, 3, '#7cc6e8');
      this.r(x, y + 6, 14, 16, '#62b6de');
      this.r(x + 2, y + 8, 3, 12, '#a8e0f7');
      this.r(x, y + 12, 14, 3, '#ffffff');
      this.r(x + 2, y + 13, 10, 1, '#2a6fdb');
    }

    drawOwner() {
      const bob = Math.sin(this.time * 2) > 0.6 ? -1 : 0;
      let hop = 0;
      if (this.ownerHop > 0) hop = -3;
      const mood = this.game.ownerMood || 'neutral';
      const key = mood;
      if (!this.ownerSprites[key]) this.ownerSprites[key] = Sprites.buildCharacter(this.ownerLook, mood, 'stand');
      this.img(this.ownerSprites[key], 312 - 16, 138 + bob + hop, 2);
    }

    drawStreet(s) {
      this.r(-this.extra, 196, this.bw, 18, '#b9b2a3');
      for (let x = -this.extra - ((this.extra) % 16); x < 480 + this.extra; x += 16) this.r(x, 196, 1, 18, '#a39c8e');
      this.r(-this.extra, 205, this.bw, 1, '#a39c8e');
      this.r(-this.extra, 214, this.bw, 3, '#8d867a');
      this.r(-this.extra, 217, this.bw, 53, '#4b4f58');
      for (let x = -this.extra; x < 480 + this.extra; x += 36) this.r(x, 246, 18, 2, '#d8d8c8');
      this.r(-this.extra, 217, this.bw, 1, '#3a3d44');
      // Kursi plastik (upgrade)
      if (s.upgrades.kursi) {
        this.drawStool(64, 198, '#d9342b');
        this.drawStool(92, 198, '#3a7bd5');
        this.drawStool(120, 198, '#d9342b');
      }
    }

    drawStool(x, y, col) {
      this.r(x, y, 14, 3, col);
      this.r(x + 1, y + 3, 2, 9, col); this.r(x + 11, y + 3, 2, 9, col);
      this.r(x + 3, y + 7, 8, 1, Sprites.shade(col, -0.3));
    }

    drawCustomer(c) {
      let frame = 'stand';
      if (c.moving) frame = Math.floor(c.walkT * 6) % 2 ? 'walk1' : 'walk2';
      const key = c.mood + '|' + frame;
      if (!c.sprites[key]) c.sprites[key] = Sprites.buildCharacter(c.look, c.mood, frame);
      const sp = c.sprites[key];
      const bob = !c.moving && Math.sin(this.time * 2.2 + c.bob) > 0.75 ? -1 : 0;
      const h = sp.height * 2;
      // bayangan
      this.b.fillStyle = 'rgba(0,0,0,0.18)';
      this.b.fillRect(Math.round(c.x - 11 + this.extra), c.y - 1, 22, 3);
      this.img(sp, c.x - 16, c.y - h + bob, 2);
      // kantong kresek belanjaan saat pulang senang
      if (c.state === 'leaving' && c.mood === 'happy') {
        const bx = c.x - 18, by = c.y - 18 + bob;
        this.r(bx, by, 7, 9, '#d9342b');
        this.r(bx + 1, by - 2, 1, 2, '#d9342b');
        this.r(bx + 5, by - 2, 1, 2, '#d9342b');
        this.r(bx + 1, by + 2, 5, 2, '#f5f5f5');
      }
      // bar kesabaran
      if (c.state !== 'leaving' && c.state !== 'walking') {
        const ratio = Math.max(0, c.patience / c.maxPatience);
        const col = ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#f2c12e' : '#e53935';
        this.r(c.x - 11, c.y - h - 6, 22, 4, '#24170f');
        this.r(c.x - 10, c.y - h - 5, Math.round(20 * ratio), 2, col);
      }
      c._h = h;
    }

    drawRain(dt) {
      if (this.drops.length < 120) {
        for (let i = 0; i < 6; i++) this.drops.push({ x: Math.random() * this.bw, y: -10 - Math.random() * 60, v: 220 + Math.random() * 80 });
      }
      this.b.fillStyle = 'rgba(190,215,240,0.7)';
      for (const d of this.drops) {
        d.y += d.v * dt; d.x -= 30 * dt;
        if (d.y > H) { d.y = -10; d.x = Math.random() * this.bw; }
        // hujan tidak masuk ke bawah atap
        const cx = d.x - this.extra;
        if (cx > 28 && cx < 452 && d.y > 30 && d.y < 196) continue;
        this.b.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
      }
    }

    drawLighting(s, hour, rain) {
      let a = 0;
      if (hour > 17.3) a = Math.min(0.5, (hour - 17.3) / 2.2 * 0.5);
      if (rain) a += 0.12;
      if (a <= 0) return;
      const b = this.b;
      b.fillStyle = 'rgba(16,20,52,' + a.toFixed(3) + ')';
      b.fillRect(0, 0, this.bw, H);
      b.globalCompositeOperation = 'lighter';
      const k = Math.min(1, a / 0.4);
      const strong = s.upgrades.lampu;
      b.fillStyle = 'rgba(255,190,110,' + (0.08 * k * (strong ? 1.6 : 1)).toFixed(3) + ')';
      b.fillRect(40 + this.extra, 58, 400, 138);
      (this.bulbs || [240]).forEach((x) => {
        const gx = x + this.extra, gy = 70;
        const rad = strong ? 90 : 70;
        const grd = b.createRadialGradient(gx, gy, 2, gx, gy, rad);
        grd.addColorStop(0, 'rgba(255,220,150,' + (0.45 * k).toFixed(3) + ')');
        grd.addColorStop(1, 'rgba(255,200,120,0)');
        b.fillStyle = grd;
        b.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
      });
      b.globalCompositeOperation = 'source-over';
    }

    // ---------- Lapisan resolusi tinggi ----------
    present(s, customers, dt) {
      const ctx = this.ctx;
      const k = this.scale * this.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#4b4f58';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.buf, 0, Math.round(this.offY * this.dpr), Math.round(this.bw * k), Math.round(H * k));

      ctx.setTransform(k, 0, 0, k, this.extra * k, this.offY * this.dpr);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Papan nama
      ctx.font = 'bold 13px "Trebuchet MS", Verdana, sans-serif';
      ctx.fillStyle = '#1a1206';
      ctx.fillText('WARUNG BERKAH', 240.6, 13.6);
      ctx.fillStyle = s.upgrades.papan ? '#ffe9a0' : '#ffe066';
      ctx.fillText('WARUNG BERKAH', 240, 13);
      ctx.font = 'bold 6px Verdana, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Sembako • Jajanan • Kopi', 240, 23);
      // Spanduk meja (hanya terlihat saat pintu tidak menutupi)
      if (this.shutterPos < 0.72) {
        ctx.fillStyle = '#b8262b';
        if (s.upgrades.kasir) {
          ctx.font = 'bold 7px Verdana, sans-serif';
          ctx.fillText('KASIR', 402, 182);
        } else {
          ctx.font = 'bold 8px Verdana, sans-serif';
          ctx.fillText('SEDIA KOPI • MIE • JAJAN', 352, 183.5);
        }
      }

      // Label (HABIS, DINGIN, TUTUP)
      const shutterBottom = 60 + 136 * this.shutterPos;
      for (const l of this.labels) {
        if (l.text !== 'TUTUP' && this.shutterPos > 0.05 && l.y < shutterBottom + 4) continue;
        ctx.font = 'bold ' + (l.small ? 6 : 7) + 'px Verdana, sans-serif';
        if (!l.small && l.text !== 'TUTUP') {
          ctx.fillStyle = 'rgba(200,30,30,0.9)';
          ctx.fillRect(l.x - 16, l.y - 5, 32, 10);
        }
        ctx.fillStyle = l.color || '#ffffff';
        ctx.fillText(l.text, l.x, l.y + 0.5);
      }

      // Emote & penanda pelanggan
      const cur = this.game.customers ? this.game.customers.current() : null;
      for (const c of customers) {
        const hy = c.y - (c._h || 46) - 14;
        if (c.emote) {
          ctx.font = '13px sans-serif';
          ctx.fillText(c.emote, c.x, hy - Math.abs(Math.sin(this.time * 4)) * 2);
        } else if (c === cur) {
          const yy = hy - Math.abs(Math.sin(this.time * 3)) * 2;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(c.x - 9, yy - 6, 18, 11, 3) : ctx.rect(c.x - 9, yy - 6, 18, 11);
          ctx.fill();
          ctx.strokeStyle = '#24170f'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#24170f';
          ctx.font = 'bold 9px Verdana, sans-serif';
          ctx.fillText(c.state === 'paying' ? 'Rp' : '...', c.x, yy - 0.5);
        }
      }

      // Teks melayang
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.life -= dt; f.y -= 16 * dt;
        if (f.life <= 0) { this.floats.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, f.life / 0.5);
        ctx.font = 'bold 10px Verdana, sans-serif';
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#24170f';
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      }
      if (this.ownerHop > 0) this.ownerHop -= dt;
    }
  }

  global.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
