/* ==========================================================
 * CustomerManager.js — Kedatangan pelanggan, antrean, pesanan,
 * kesabaran, dan pergerakan.
 * v2.0.0: mendukung profil tiap cabang, 5 slot antrean (ekspansi),
 * dan bonus kesabaran Wi-Fi / kipas angin global.
 * ========================================================== */
(function (global) {
  'use strict';
  const D = global.DATA;

  const SLOT_X = [350, 384, 416, 446, 474];
  const FEET_Y = 212;
  const WALK_SPEED = 60;
  const QTY_WORDS = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan'];

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function weightedPick(entries) {
    const total = entries.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const e of entries) { r -= e.w; if (r <= 0) return e; }
    return entries[entries.length - 1];
  }

  let nextId = 1;

  class CustomerManager {
    constructor(game) {
      this.game = game;
      this.list = [];
      this.queue = [];
      this.spawnTimer = 2;
    }

    get state() { return this.game.state; }

    branchDef() { return D.branchById(this.state.activeBranch); }

    maxQueue() {
      return this.state.upgrades && this.state.upgrades.ekspansi ? D.EXPANDED_MAX_QUEUE : D.MAX_QUEUE;
    }

    reset() { this.list = []; this.queue = []; this.spawnTimer = 2; }

    current() {
      const c = this.queue[0];
      return c && (c.state === 'ordering' || c.state === 'paying') ? c : null;
    }

    extra() { return this.game.renderer ? this.game.renderer.extra : 0; }

    // ---------- Pembuatan pelanggan ----------
    pickType() {
      const day = this.state.day;
      const boost = this.branchDef().typeBoost || {};
      const entries = Object.keys(D.CUSTOMER_TYPES)
        .map((id) => ({
          id,
          w: D.CUSTOMER_TYPES[id].weight * (boost[id] || 1),
          t: D.CUSTOMER_TYPES[id],
        }))
        .filter((e) => e.t.minDay <= day || boost[e.id]);
      return weightedPick(entries).id;
    }

    makeLook(typeId) {
      const P = D.PALETTE;
      const t = D.CUSTOMER_TYPES[typeId];
      const look = {
        style: pick(t.styles), skin: pick(P.skin), hair: pick(P.hair),
        shirt: pick(P.shirt), pants: pick(P.pants), acc: null,
      };
      if (typeId === 'anak') { look.shirt = '#f4f4f4'; look.pants = '#c0392b'; }
      if (typeId === 'cerewet') { look.hair = pick(['#7a2e1f', '#2b1d14', '#5a3a22']); look.shirt = pick(['#e86fa0', '#f2a03d', '#8e5bc4']); }
      if (typeId === 'ibu') { look.acc = pick(P.hijab); look.pants = Sprites.shade(look.shirt, -0.35); }
      if (typeId === 'ojek') { look.acc = '#2e8b3a'; look.shirt = '#2e8b3a'; look.pants = '#2f3b59'; }
      return look;
    }

    makeOrder(typeId, big) {
      const t = D.CUSTOMER_TYPES[typeId];
      const br = this.branchDef();
      let pool = D.ITEMS.map((it) => {
        let w = t.prefs[it.id] || 0;
        if (br.id === 'kampus' && (it.id === 'mie' || it.id === 'kopi')) w *= 1.6;
        if (br.id === 'sekolah' && (it.id === 'keripik' || it.id === 'susu')) w *= 1.5;
        return { id: it.id, w };
      }).filter((e) => e.w > 0);
      const isBig = big || (br.bigOrderChance && Math.random() < br.bigOrderChance);
      const nDistinct = isBig ? randInt(3, 4) : randInt(t.distinct[0], t.distinct[1]);
      const order = {};
      for (let i = 0; i < nDistinct && pool.length; i++) {
        const e = weightedPick(pool);
        order[e.id] = isBig ? randInt(2, 4) : randInt(t.qty[0], t.qty[1]);
        pool = pool.filter((p) => p.id !== e.id);
      }
      return order;
    }

    static orderText(order) {
      const parts = Object.keys(order).map((id) => {
        const q = order[id];
        return D.itemById(id).name + ' ' + (QTY_WORDS[q] || q);
      });
      if (parts.length <= 1) return parts.join('');
      return parts.slice(0, -1).join(', ') + ' sama ' + parts[parts.length - 1];
    }

    spawn(forceBorong) {
      const typeId = forceBorong ? (D.CUSTOMER_TYPES.ibu ? 'ibu' : 'biasa') : this.pickType();
      const t = D.CUSTOMER_TYPES[typeId];
      const order = this.makeOrder(typeId, forceBorong);
      const u = this.state.upgrades || {};
      const g = this.state.globalUpgrades || {};
      let patience = t.patience * (forceBorong ? 1.8 : 1);
      if (u.kursi) patience *= 1.1;
      if (g.wifi) patience *= 1.1;
      const c = {
        id: nextId++,
        type: typeId,
        typeLabel: forceBorong ? 'Pelanggan Borong' : t.label,
        name: forceBorong ? 'Bu RT' : pick(t.names),
        look: this.makeLook(typeId),
        x: 480 + this.extra() + 24,
        y: FEET_Y,
        targetX: 0,
        state: 'walking',
        mood: 'neutral',
        order,
        orderText: CustomerManager.orderText(order),
        line: '',
        patience, maxPatience: patience,
        mistakes: 0, changeTries: 0,
        cash: 0, isQris: false, total: 0, changeGiven: 0,
        walkT: 0, moving: true, bob: Math.random() * 6,
        emote: null, emoteT: 0,
        chatterT: rand(6, 9), saidImpatient: false,
        sprites: {},
      };
      if (forceBorong) c.look.acc = '#b8860b';
      c.line = forceBorong
        ? 'Bang, saya borong ya! ' + c.orderText + '. Buat arisan nanti sore.'
        : pick(t.lines).replace('{order}', c.orderText);
      this.queue.push(c);
      this.list.push(c);
      c.targetX = SLOT_X[Math.min(SLOT_X.length - 1, this.queue.length - 1)];
      return c;
    }

    nextInterval() {
      const s = this.state;
      const br = this.branchDef();
      const h = s.clockMin / 60;
      let base = 10 * (br.spawnMul || 1);
      base *= 1.4 - (s.reputation / 100) * 0.8;
      if ((h >= 8 && h < 9.5) || (h >= 12 && h < 13.5) || (h >= 16 && h < 18)) base *= 0.7;
      else if (h >= 19) base *= br.id === 'kampus' ? 0.85 : 1.3;
      if (s.event.id === 'hujan') base *= 1.6;
      if (s.upgrades && s.upgrades.papan) base *= 0.85;
      base *= Math.max(0.75, 1 - (s.day - 1) * 0.03);
      return base * rand(0.6, 1.4);
    }

    // ---------- Pergerakan & kesabaran ----------
    leave(c, mood) {
      if (c.state === 'leaving') return;
      c.state = 'leaving';
      c.mood = mood || 'neutral';
      const i = this.queue.indexOf(c);
      if (i >= 0) this.queue.splice(i, 1);
      c.targetX = -this.extra() - 30;
      c.y = FEET_Y + 6;
      this.queue.forEach((q, idx) => { q.targetX = SLOT_X[Math.min(SLOT_X.length - 1, idx)]; });
    }

    emote(c, symbol, dur) { c.emote = symbol; c.emoteT = dur || 2.2; }

    update(dt) {
      const s = this.state;
      const totalMin = (D.DAY.closeHour - D.DAY.openHour) * 60;
      const progress = (s.clockMin - D.DAY.openHour * 60) / totalMin;

      if (s.phase === 'open') {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          if (this.queue.length < this.maxQueue()) {
            const borong = s.event.id === 'borong' && !s.event.borongDone && progress > 0.25;
            if (borong) s.event.borongDone = true;
            this.spawn(borong);
            this.game.audio.sfx('step');
          }
          this.spawnTimer = this.nextInterval();
        }
      }

      const u = s.upgrades || {};
      const g = s.globalUpgrades || {};
      let drainMul = 1;
      if (u.kursi) drainMul *= 0.8;
      if (u.lampu) drainMul *= 0.9;
      if (g.wifi) drainMul *= 0.8;

      for (let i = this.list.length - 1; i >= 0; i--) {
        const c = this.list[i];
        const dx = c.targetX - c.x;
        if (Math.abs(dx) > 0.6) {
          const step = Math.sign(dx) * Math.min(Math.abs(dx), WALK_SPEED * dt * (c.state === 'leaving' && c.mood === 'angry' ? 1.4 : 1));
          c.x += step;
          c.walkT += dt;
          c.moving = true;
        } else {
          c.x = c.targetX;
          c.moving = false;
          if (c.state === 'leaving') {
            this.list.splice(i, 1);
            continue;
          }
          if (c.state === 'walking' || c.state === 'queue') {
            if (this.queue[0] === c) {
              c.state = 'ordering';
              this.game.onCustomerArrive(c);
            } else {
              c.state = 'queue';
            }
          }
        }

        if (c.emoteT > 0) { c.emoteT -= dt; if (c.emoteT <= 0) c.emote = null; }

        if (c.state !== 'leaving') {
          let rate = 0.4;
          if (c.state === 'ordering') rate = 1;
          else if (c.state === 'paying') rate = 0.5;
          c.patience -= rate * drainMul * dt;
          const ratio = c.patience / c.maxPatience;
          if (ratio < 0.3 && !c.saidImpatient) {
            c.saidImpatient = true;
            this.emote(c, '💢', 3);
            if (c === this.current()) this.game.say(c, pick(D.LINES.impatient));
          }
          if (c.patience <= 0) {
            this.game.onPatienceOut(c);
            continue;
          }
          if (c.state === 'ordering' && D.CUSTOMER_TYPES[c.type].chatty) {
            c.chatterT -= dt;
            if (c.chatterT <= 0) {
              c.chatterT = rand(8, 12);
              this.game.say(c, pick(D.LINES.chatter));
              this.emote(c, '💬', 2);
            }
          }
        }
      }
    }

    hitTest(x, y) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const c = this.list[i];
        if (c.state === 'leaving') continue;
        if (x >= c.x - 16 && x <= c.x + 16 && y >= c.y - 48 && y <= c.y + 2) return c;
      }
      return null;
    }
  }

  CustomerManager.SLOT_X = SLOT_X;
  CustomerManager.FEET_Y = FEET_Y;
  global.CustomerManager = CustomerManager;
})(typeof window !== 'undefined' ? window : globalThis);
