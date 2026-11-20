/* ==========================================================
 * Sprites.js — Pixel art prosedural (karakter chibi & ikon barang).
 * Semua sprite digambar dari peta karakter -> canvas kecil.
 * ========================================================== */
(function (global) {
  'use strict';

  // ---------- Karakter 16 x 23 (tampak depan, chibi) ----------
  const HEAD = [
    '....kkkkkkkk....',
    '...khhhhhhhhk...',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..khsssssssshk..',
    '..kssssssssssk..',
    '..kssessssessk..',
    '..kssssssssssk..',
    '..ksssskkssssk..',
    '...kssssssssk...',
    '....kksssskk....',
  ];
  const BODY = [
    '...kcccccccck...',
    '..kcccccccccck..',
    '.kcccccccccccck.',
    '.kcccccccccccck.',
    '.ksccccccccccsk.',
    '..kCCCCCCCCCCk..',
    '...kppppppppk...',
    '...kppppppppk...',
  ];
  const LEGS = {
    stand: [
      '...kppk..kppk...',
      '...kppk..kppk...',
      '..kfffk..kfffk..',
      '..kkkkk..kkkkk..',
    ],
    walk1: [
      '...kppk..kppk...',
      '..kfffk..kppk...',
      '..kkkkk..kfffk..',
      '.........kkkkk..',
    ],
    walk2: [
      '...kppk..kppk...',
      '...kppk..kfffk..',
      '..kfffk..kkkkk..',
      '..kkkkk.........',
    ],
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * (1 + amt))));
    g = Math.max(0, Math.min(255, Math.round(g * (1 + amt))));
    b = Math.max(0, Math.min(255, Math.round(b * (1 + amt))));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /**
   * Bangun sprite karakter.
   * look: { style, skin, hair, shirt, pants, acc }
   * mood: 'neutral' | 'happy' | 'angry'
   * frame: 'stand' | 'walk1' | 'walk2'
   */
  function buildCharacter(look, mood, frame) {
    let g = HEAD.concat(BODY).map((r) => r.split(''));
    const set = (r, c, ch) => { if (g[r] && c >= 0 && c < 16) g[r][c] = ch; };
    const style = look.style;

    if (style === 'long' || style === 'curly') {
      if (style === 'curly') {
        g[0] = '..kkkkkkkkkkkk..'.split('');
        g[1] = '.khhhhhhhhhhhhk.'.split('');
        g[2] = '.khhhhhhhhhhhhk.'.split('');
        g[3] = '.khhhhhhhhhhhhk.'.split('');
      }
      for (let r = 3; r <= 11; r++) { set(r, 1, 'k'); set(r, 2, 'h'); set(r, 13, 'h'); set(r, 14, 'k'); }
    } else if (style === 'hijab') {
      g = g.map((row) => row.map((ch) => (ch === 'h' ? 'a' : ch)));
      for (let r = 3; r <= 11; r++) { set(r, 1, 'k'); set(r, 2, 'a'); set(r, 13, 'a'); set(r, 14, 'k'); }
      for (let c = 2; c <= 13; c++) { set(10, c, 'a'); set(11, c, c === 2 || c === 13 ? 'k' : 'a'); }
      set(10, 1, 'k'); set(10, 14, 'k');
    } else if (style === 'helmet') {
      for (let r = 0; r <= 4; r++) g[r] = g[r].map((ch) => (ch === 'h' ? 'a' : ch));
      for (let c = 3; c <= 12; c++) set(4, c, 'v');
      for (let r = 1; r <= 4; r++) { set(r, 1, 'k'); set(r, 2, 'a'); set(r, 13, 'a'); set(r, 14, 'k'); }
    } else if (style === 'peci') {
      for (let r = 0; r <= 2; r++) g[r] = g[r].map((ch) => (ch === 'h' ? 'a' : ch));
      set(3, 3, 'a'); set(3, 12, 'a');
    } else if (style === 'kid') {
      // dasi merah seragam SD
      set(11, 7, 'r'); set(11, 8, 'r'); set(12, 7, 'r'); set(12, 8, 'r'); set(13, 7, 'r');
      g.splice(18, 1); // lebih pendek
    }

    // Ekspresi
    if (mood === 'angry') {
      set(5, 4, 'k'); set(5, 5, 'k'); set(5, 10, 'k'); set(5, 11, 'k');
      set(8, 7, 'k'); set(8, 8, 'k');
    } else if (mood === 'happy') {
      set(7, 6, 'k'); set(7, 9, 'k'); set(8, 6, 's'); set(8, 7, 'm'); set(8, 8, 'm'); set(8, 9, 's');
      set(7, 4, 'b'); set(7, 11, 'b');
    }

    g = g.concat((LEGS[frame] || LEGS.stand).map((r) => r.split('')));

    const pal = {
      k: '#24170f',
      s: look.skin, h: look.hair, e: '#1b1b2a',
      c: look.shirt, C: shade(look.shirt, -0.25),
      p: look.pants, f: '#3a2a20', a: look.acc || look.hair,
      v: '#2c3e50', r: '#c0392b', m: '#9b2d2d', b: '#f19c9c', w: '#ffffff',
    };
    const h = g.length;
    const cv = makeCanvas(16, h);
    const ctx = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < 16; x++) {
        const ch = g[y][x];
        if (ch === '.' || !pal[ch]) continue;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  }

  // ---------- Ikon barang 12 x 12 ----------
  const ICONS = {
    air: {
      map: [
        '....kkkk....',
        '....kwwk....',
        '...kbbbbk...',
        '...kbwbbk...',
        '..kbbbbbbk..',
        '..kbwbbbbk..',
        '..krrrrrrk..',
        '..krwwwwrk..',
        '..krrrrrrk..',
        '..kbwbbbbk..',
        '..kbbbbbbk..',
        '...kkkkkk...',
      ],
      pal: { k: '#1d2b3a', w: '#ffffff', b: '#9fd8f0', r: '#2a6fdb' },
    },
    mie: {
      map: [
        '............',
        '............',
        'kkkkkkkkkkkk',
        'kyyyyyyyyyyk',
        'kyrrrryyyyyk',
        'kyrwwryoooyk',
        'kyrrrryoooyk',
        'kyyyyyyoooyk',
        'kyggggyyyyyk',
        'kyyyyyyyyyyk',
        'kkkkkkkkkkkk',
        '............',
      ],
      pal: { k: '#3b2410', y: '#f7d046', r: '#d9342b', w: '#ffffff', o: '#e8a33a', g: '#2f8f3a' },
    },
    kopi: {
      map: [
        '..kkkkkkkk..',
        '..kzzzzzzk..',
        '..knnnnnnk..',
        '..knwwwwnk..',
        '..knwccwnk..',
        '..knwccwnk..',
        '..knwwwwnk..',
        '..knnnnnnk..',
        '..knyyyynk..',
        '..knnnnnnk..',
        '..kzzzzzzk..',
        '..kkkkkkkk..',
      ],
      pal: { k: '#21130a', z: '#c9a27a', n: '#6b3e1f', w: '#f3e3c8', c: '#3b1f0e', y: '#f2c12e' },
    },
    susu: {
      map: [
        '........kk..',
        '.......kw...',
        '..kkkkkkwk..',
        '..kwwwwwwk..',
        '..kwwwwwwk..',
        '..kbbbbbbk..',
        '..kbwwwwbk..',
        '..kbwbbwbk..',
        '..kbwwwwbk..',
        '..kbbbbbbk..',
        '..kwwwwwwk..',
        '..kkkkkkkk..',
      ],
      pal: { k: '#1d2b3a', w: '#ffffff', b: '#4a90d9' },
    },
    keripik: {
      map: [
        '............',
        '..kkkkkkkk..',
        '.kooooooook.',
        '.korrrrrrok.',
        '.korwwwwrok.',
        '.korrrrrrok.',
        '.kooyyyyook.',
        '.kooyyyyook.',
        '.kooooooook.',
        '.kooooooook.',
        '..kkkkkkkk..',
        '............',
      ],
      pal: { k: '#3b1d0a', o: '#f08a24', r: '#c62828', w: '#ffffff', y: '#ffe066' },
    },
  };

  const iconCache = {};
  function icon(id) {
    if (iconCache[id]) return iconCache[id];
    const def = ICONS[id];
    const cv = makeCanvas(12, 12);
    const ctx = cv.getContext('2d');
    def.map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = def.pal[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    });
    iconCache[id] = cv;
    return cv;
  }

  const urlCache = {};
  /** Data URL ikon diperbesar (untuk tombol HTML). */
  function iconURL(id, scale) {
    const k = id + '@' + (scale || 4);
    if (urlCache[k]) return urlCache[k];
    const s = scale || 4;
    const src = icon(id);
    const cv = makeCanvas(12 * s, 12 * s);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, 12 * s, 12 * s);
    urlCache[k] = cv.toDataURL();
    return urlCache[k];
  }

  global.Sprites = { buildCharacter, icon, iconURL, shade };
})(typeof window !== 'undefined' ? window : globalThis);
