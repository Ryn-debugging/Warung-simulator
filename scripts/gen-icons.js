'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');

// 16x16 pixel-art Warung Berkah
const GRID = [
  'kkkkkkkkkkkkkkkk',
  'kbbbbbbbbbbbbbbk',
  'kbRRRRRRRRRRRRbk',
  'krrrrrrrrrrrrrrk',
  'krrrrrrrrrrrrrrk',
  'kggwwggwwggwwggk',
  'kggwwggwwggwwggk',
  'kbeeeeeeeeeeeebk',
  'kbeYRRdeeeKKeebk',
  'kbeTTddeeeSSeebk',
  'kbeBOddeeeWWeebk',
  'kbeTTddeMMmmMebk',
  'kbeTTddeMMYYMebk',
  'kbeeeeeeMMYYMebk',
  'kssssssssssssssk',
  'kkkkkkkkkkkkkkkk',
];

const PAL = {
  k: [36, 23, 15, 255],
  b: [110, 198, 240, 255],
  R: [143, 63, 34, 255],
  r: [181, 83, 47, 255],
  g: [46, 139, 87, 255],
  w: [253, 244, 223, 255],
  e: [232, 214, 160, 255],
  T: [122, 79, 42, 255],
  d: [107, 68, 35, 255],
  Y: [247, 208, 70, 255],
  B: [74, 144, 217, 255],
  O: [240, 138, 36, 255],
  K: [24, 24, 24, 255],
  S: [224, 168, 120, 255],
  W: [245, 245, 245, 255],
  M: [139, 90, 43, 255],
  m: [90, 52, 26, 255],
  s: [75, 79, 88, 255],
};

// CRC32 table for PNG chunks
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function renderIcon(size, opts = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = opts.padRatio ? Math.floor(size * opts.padRatio) : 0;
  const inner = size - pad * 2;
  const bg = opts.bg || [59, 35, 20, 255];
  const r2 = (size / 2) * (size / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (opts.round) {
        const dx = x + 0.5 - size / 2;
        const dy = y + 0.5 - size / 2;
        if (dx * dx + dy * dy > r2) continue;
      }
      let col = opts.transparent ? [0, 0, 0, 0] : bg;
      if (x >= pad && x < size - pad && y >= pad && y < size - pad) {
        const gx = Math.min(15, Math.floor(((x - pad) / inner) * 16));
        const gy = Math.min(15, Math.floor(((y - pad) / inner) * 16));
        col = PAL[GRID[gy][gx]] || bg;
      }
      buf[idx] = col[0]; buf[idx + 1] = col[1]; buf[idx + 2] = col[2]; buf[idx + 3] = col[3];
    }
  }
  return encodePNG(size, size, buf);
}

function renderSplash(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  const bg = [59, 35, 20, 255];
  const iconSize = Math.floor(Math.min(w, h) * 0.42);
  const ox = Math.floor((w - iconSize) / 2);
  const oy = Math.floor((h - iconSize) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let col = bg;
      if (x >= ox && x < ox + iconSize && y >= oy && y < oy + iconSize) {
        const gx = Math.min(15, Math.floor(((x - ox) / iconSize) * 16));
        const gy = Math.min(15, Math.floor(((y - oy) / iconSize) * 16));
        col = PAL[GRID[gy][gx]] || bg;
      }
      buf[idx] = col[0]; buf[idx + 1] = col[1]; buf[idx + 2] = col[2]; buf[idx + 3] = col[3];
    }
  }
  return encodePNG(w, h, buf);
}

// 1. Web/Store 512px PNG
fs.writeFileSync(path.join(ROOT, 'src/assets/ui/icon-512.png'), renderIcon(512));

// 2. Android mipmaps
const resDir = path.join(ROOT, 'android/app/src/main/res');
if (fs.existsSync(resDir)) {
  const densities = [
    ['mdpi', 48, 108],
    ['hdpi', 72, 162],
    ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324],
    ['xxxhdpi', 192, 432],
  ];
  for (const [d, s, fg] of densities) {
    const dir = path.join(resDir, 'mipmap-' + d);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), renderIcon(s));
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), renderIcon(s, { round: true }));
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), renderIcon(fg, { transparent: true, padRatio: 0.22 }));
  }

  // Splash screens (warm wood brown + centered pixel warung)
  const splashes = [
    ['drawable/splash.png', 480, 320],
    ['drawable-land-mdpi/splash.png', 480, 320],
    ['drawable-land-hdpi/splash.png', 800, 480],
    ['drawable-land-xhdpi/splash.png', 1280, 720],
    ['drawable-land-xxhdpi/splash.png', 1600, 960],
    ['drawable-land-xxxhdpi/splash.png', 1920, 1280],
    ['drawable-port-mdpi/splash.png', 320, 480],
    ['drawable-port-hdpi/splash.png', 480, 800],
    ['drawable-port-xhdpi/splash.png', 720, 1280],
    ['drawable-port-xxhdpi/splash.png', 960, 1600],
    ['drawable-port-xxxhdpi/splash.png', 1280, 1920],
  ];
  for (const [rel, w, h] of splashes) {
    const out = path.join(resDir, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, renderSplash(w, h));
  }
}

console.log('Ikon & splash pixel-art selesai dibuat.');
