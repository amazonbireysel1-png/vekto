// Ses kimliği: tamamı Web Audio ile gerçek zamanlı sentezlenir (dosya yok, ~0 KB).
// Yumuşak, kısa, düşük seviyeli tonlar. Pentatonik dizi: art arda doğru hamleler
// hafifçe yükselen bir melodi oluşturur.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const BASE = 392; // G4

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = true;
    this.musicOn = false;
    this.combo = 0;
    this.comboAt = 0;
    this.music = null;
  }

  /** Tarayıcı kuralları gereği ilk kullanıcı dokunuşunda başlatılır. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(this.ctx.destination);
    if (this.musicOn) this.startMusic();
  }

  suspend() { this.ctx?.suspend?.(); }
  resume() { if (this.ctx && (this.sfx || this.musicOn)) this.ctx.resume(); }

  setSfx(on) { this.sfx = on; }
  setMusic(on) {
    this.musicOn = on;
    if (on) { this.unlock(); this.startMusic(); } else this.stopMusic();
  }

  tone({ f, type = 'sine', at = 0, dur = 0.18, gain = 0.2, attack = 0.006, slide = 0, filter = 0 }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filter) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filter; node = g.connect(lp); }
    node.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ at = 0, dur = 0.16, gain = 0.06, from = 900, to = 3200 }) {
    const c = this.ctx; if (!c) return;
    if (!this.nbuf) {
      const len = c.sampleRate * 0.4;
      this.nbuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.nbuf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.sfx || !this.ctx) return;
    const note = (k) => BASE * 2 ** (PENTA[Math.min(PENTA.length - 1, k)] / 12);
    switch (name) {
      case 'select': this.tone({ f: 1320, dur: 0.05, gain: 0.05, type: 'triangle' }); break;
      case 'move': {
        const now = performance.now();
        this.combo = now - this.comboAt < 1800 ? this.combo + 1 : 0;
        this.comboAt = now;
        const f = note(this.combo % PENTA.length);
        this.noise({ dur: 0.2, gain: 0.035, from: 700, to: 4200 });
        this.tone({ f, dur: 0.32, gain: 0.13, type: 'sine' });
        this.tone({ f: f * 2, dur: 0.18, gain: 0.025, type: 'sine', at: 0.005 });
        break;
      }
      case 'blocked':
        this.tone({ f: 170, dur: 0.16, gain: 0.16, type: 'triangle', slide: 0.75, filter: 900 });
        this.tone({ f: 120, dur: 0.12, gain: 0.08, type: 'sine', at: 0.02 });
        break;
      case 'refuse':
        this.tone({ f: 330, dur: 0.09, gain: 0.07, type: 'triangle', filter: 1400 });
        this.tone({ f: 294, dur: 0.12, gain: 0.07, type: 'triangle', at: 0.08, filter: 1400 });
        break;
      case 'unlock':
        this.tone({ f: 988, dur: 0.12, gain: 0.06 }); this.tone({ f: 1319, dur: 0.2, gain: 0.05, at: 0.07 });
        break;
      case 'win': {
        const seq = [0, 2, 3, 5];
        seq.forEach((k, i) => {
          this.tone({ f: note(k), at: i * 0.085, dur: 0.6, gain: 0.12 });
          this.tone({ f: note(k) * 2, at: i * 0.085, dur: 0.35, gain: 0.025 });
        });
        this.tone({ f: note(7), at: 0.36, dur: 0.9, gain: 0.08 });
        break;
      }
      case 'reward':
        this.tone({ f: 1175, dur: 0.16, gain: 0.07 }); this.tone({ f: 1568, dur: 0.28, gain: 0.06, at: 0.08 });
        this.tone({ f: 2093, dur: 0.3, gain: 0.03, at: 0.16 });
        break;
      case 'tap': this.tone({ f: 880, dur: 0.045, gain: 0.04, type: 'triangle', filter: 2400 }); break;
      case 'back': this.tone({ f: 660, dur: 0.05, gain: 0.035, type: 'triangle', filter: 2000 }); break;
      case 'undo': this.tone({ f: 523, dur: 0.12, gain: 0.07, slide: 0.8 }); break;
      case 'hint': this.tone({ f: 784, dur: 0.22, gain: 0.07 }); this.tone({ f: 1046, dur: 0.3, gain: 0.05, at: 0.09 }); break;
      case 'fail': this.tone({ f: 294, dur: 0.4, gain: 0.08, slide: 0.85, filter: 1200 }); break;
      default: break;
    }
  }

  // --- Sakin, üretken arka plan müziği: yavaş akorlar, alçak geçiren filtre ---
  startMusic() {
    if (!this.ctx || this.music) return;
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.09, c.currentTime + 3);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    out.connect(lp).connect(this.master);
    const chords = [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]];
    let step = 0;
    const play = () => {
      const t = c.currentTime;
      chords[step % chords.length].forEach((s, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = 196 * 2 ** (s / 12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18 / (i + 1), t + 2.2);
        g.gain.linearRampToValueAtTime(0, t + 7.6);
        o.connect(g).connect(out);
        o.start(t); o.stop(t + 7.8);
      });
      step++;
    };
    play();
    const id = setInterval(play, 7000);
    this.music = { out, id };
  }

  stopMusic() {
    if (!this.music) return;
    const { out, id } = this.music;
    clearInterval(id);
    try { out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); } catch { /* yok */ }
    setTimeout(() => out.disconnect(), 1500);
    this.music = null;
  }
}
