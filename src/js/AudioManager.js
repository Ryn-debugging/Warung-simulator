/* ==========================================================
 * AudioManager.js — Musik & efek suara sintetis (Web Audio API).
 * Tidak memerlukan file audio sehingga ringan & offline. (PRD 9)
 * ========================================================== */
(function (global) {
  'use strict';

  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

  class AudioManager {
    constructor(settings) {
      this.ctx = null;
      this.musicVol = settings.music;
      this.sfxVol = settings.sfx;
      this.musicWanted = false;
      this.timer = null;
      this.step = 0;
      this.nextTime = 0;
      this.melody = this.makeMelody();
    }

    unlock() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        this.sfxGain.connect(this.master);
        this.applyVolumes();
        if (this.musicWanted) this.startMusic();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    setVolumes(music, sfx) {
      this.musicVol = music;
      this.sfxVol = sfx;
      this.applyVolumes();
    }

    applyVolumes() {
      if (!this.ctx) return;
      this.musicGain.gain.value = this.musicVol * 0.35;
      this.sfxGain.gain.value = this.sfxVol * 0.6;
    }

    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

    tone(freq, start, dur, type, vol, slideTo, dest) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g); g.connect(dest || this.sfxGain);
      o.start(start); o.stop(start + dur + 0.02);
    }

    noise(start, dur, vol, freq) {
      const c = this.ctx;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq || 1200;
      const g = c.createGain();
      g.gain.setValueAtTime(vol || 0.2, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(start);
    }

    /** Efek suara berdasarkan nama. */
    sfx(name) {
      if (!this.ctx || this.sfxVol <= 0) return;
      const t = this.ctx.currentTime + 0.01;
      switch (name) {
        case 'ui': this.tone(1100, t, 0.05, 'square', 0.08); break;
        case 'pick': this.tone(520, t, 0.07, 'square', 0.12, 880); break;
        case 'remove': this.tone(700, t, 0.07, 'square', 0.1, 400); break;
        case 'bell': // pelanggan datang: "ting-tung"
          this.tone(1318, t, 0.35, 'sine', 0.25);
          this.tone(988, t + 0.18, 0.5, 'sine', 0.25);
          break;
        case 'step': this.noise(t, 0.05, 0.08, 400); this.noise(t + 0.15, 0.05, 0.08, 400); break;
        case 'success':
          [0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(72 + n), t + i * 0.07, 0.15, 'square', 0.12));
          break;
        case 'cash': // uang diterima: "cring!"
          this.noise(t, 0.08, 0.15, 3000);
          this.tone(1568, t + 0.05, 0.12, 'triangle', 0.2);
          this.tone(2093, t + 0.12, 0.3, 'triangle', 0.2);
          break;
        case 'coin': this.tone(1760, t, 0.06, 'triangle', 0.15, 2400); break;
        case 'error': // stok habis
          this.tone(160, t, 0.22, 'sawtooth', 0.15);
          this.tone(120, t + 0.12, 0.22, 'sawtooth', 0.12);
          break;
        case 'wrong': this.tone(440, t, 0.15, 'square', 0.12, 300); this.tone(300, t + 0.14, 0.2, 'square', 0.12, 200); break;
        case 'angry': [67, 63, 60].forEach((n, i) => this.tone(NOTE(n), t + i * 0.1, 0.16, 'sawtooth', 0.1)); break;
        case 'shutter': // pintu warung (rolling door)
          for (let i = 0; i < 14; i++) this.noise(t + i * 0.045, 0.04, 0.12, 700 + i * 60);
          break;
        case 'buy': this.tone(660, t, 0.08, 'square', 0.12); this.tone(990, t + 0.08, 0.12, 'square', 0.12); break;
        case 'day':
          [60, 64, 67, 72, 76].forEach((n, i) => this.tone(NOTE(n), t + i * 0.12, 0.3, 'triangle', 0.15));
          break;
        default: break;
      }
    }

    // ---------- Musik latar santai ----------
    makeMelody() {
      // Pentatonik mayor C (C D E G A), random walk dengan jeda — terasa santai.
      const scale = [0, 2, 4, 7, 9, 12, 14, 16];
      let idx = 3;
      const mel = [];
      let seed = 7;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 64; i++) {
        if (rnd() < 0.35) { mel.push(null); continue; }
        idx = Math.max(0, Math.min(scale.length - 1, idx + Math.floor(rnd() * 5) - 2));
        mel.push(scale[idx]);
      }
      return mel;
    }

    startMusic() {
      this.musicWanted = true;
      if (!this.ctx || this.timer) return;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 60);
    }

    stopMusic() {
      this.musicWanted = false;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    schedule() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const eighth = 60 / 92 / 2;
      const chords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]]; // C Am F G
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        const s = this.step;
        const bar = Math.floor(s / 8) % 4;
        const beat = s % 8;
        const ch = chords[bar];
        const t = this.nextTime;
        if (beat === 0 || beat === 4) this.tone(NOTE(ch[0] - 12), t, eighth * 3, 'triangle', 0.35, null, this.musicGain);
        if (beat % 2 === 1) {
          this.tone(NOTE(ch[1] + 12), t, eighth * 0.8, 'square', 0.04, null, this.musicGain);
          this.tone(NOTE(ch[2] + 12), t, eighth * 0.8, 'square', 0.04, null, this.musicGain);
        }
        const m = this.melody[s % this.melody.length];
        if (m != null && Math.floor(s / 64) % 2 === 0 || (m != null && beat % 2 === 0)) {
          this.tone(NOTE(72 + m), t, eighth * 1.6, 'triangle', 0.12, null, this.musicGain);
        }
        this.nextTime += eighth;
        this.step++;
      }
    }
  }

  global.AudioManager = AudioManager;
})(typeof window !== 'undefined' ? window : globalThis);
