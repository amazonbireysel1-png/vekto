// Tahta çizici (Canvas 2D): kıvrımlı renkli oklar, şekil silüeti, yakınlaştırma/kaydırma.
// Çizim yalnızca animasyon veya etkileşim varken yapılır; boşta CPU/pil tüketmez.

import { Animator, ease } from './js-render-anim.js';
import { DX, DY } from './js-core-rules.js';
import { PALETTES } from './js-core-levels.js';
import { BASE_PALETTE as P } from './js-systems-themes.js';

const TAU = Math.PI * 2;
export const MAX_ZOOM = 6;

export class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.anim = new Animator((now) => this.draw(now));
    this.level = null; this.state = null; this.theme = null;
    this.particles = [];
    this.hint = null;
    this.lastNow = performance.now();
    this.dpr = 1; this.cs = 20; this.z = 1; this.ox = 0; this.oy = 0;
    this.onViewChange = null;
    this.ro = new ResizeObserver(() => this.resize(true));
    this.ro.observe(canvas.parentElement);
  }

  destroy() { this.ro.disconnect(); this.anim.clear(); }

  setTheme(theme) { this.theme = theme; if (this.level) this.computeColors(); this.anim.wake(); }

  setLevel(level, state) {
    this.level = level; this.state = state;
    const n = level.n;
    this.v = {
      s: new Float32Array(n),            // yol üzerindeki ilerleme (hücre)
      a: new Float32Array(n).fill(1),    // saydamlık
      press: new Float32Array(n), flash: new Float32Array(n),
      flying: new Uint8Array(n), queued: new Uint8Array(n),
    };
    // Her ok için uzatılmış yol: gövde + başın yönünde tahtanın dışına kadar
    this.paths = [];
    for (let i = 0; i < n; i++) {
      const pts = Array.from(level.cells[i], (c) => [c % level.w, (c / level.w) | 0]);
      const d = level.pd[i];
      const [hx, hy] = pts[pts.length - 1];
      const toEdge = d === 0 ? hy + 1 : d === 2 ? level.h - hy : d === 1 ? level.w - hx : hx + 1;
      const ext = toEdge + pts.length + 2;
      for (let k = 1; k <= ext; k++) pts.push([hx + DX[d] * k, hy + DY[d] * k]);
      this.paths.push({ pts, len: level.cells[i].length, toEdge });
    }
    this.computeColors();
    this.hint = null;
    this.particles.length = 0;
    this.winGlow = 0;
    this.resize(false);
    this.fit();
  }

  setState(state) { this.state = state; this.anim.wake(); }

  computeColors() {
    const L = this.level, T = this.theme || {};
    const pal = PALETTES[L.meta.palette ?? 0].colors;
    const pattern = L.meta.pattern || 'diagonal';
    this.colors = [];
    for (let i = 0; i < L.n; i++) {
      if (T.mono) { this.colors.push(T.mono); continue; }
      let cx = 0, cy = 0;
      for (const c of L.cells[i]) { cx += c % L.w; cy += (c / L.w) | 0; }
      cx = cx / L.cells[i].length / Math.max(1, L.w - 1); cy = cy / L.cells[i].length / Math.max(1, L.h - 1);
      let t;
      if (pattern === 'vertical') t = cy;
      else if (pattern === 'horizontal') t = cx;
      else if (pattern === 'radial') t = Math.min(1, Math.hypot(cx - 0.5, cy - 0.5) / 0.62);
      else if (pattern === 'angular') t = (Math.atan2(cy - 0.5, cx - 0.5) + Math.PI) / TAU;
      else t = (cx + cy) / 2;
      const jitter = (((i * 2654435761) >>> 0) % 1000) / 1000 * 0.16 - 0.08;
      const k = Math.max(0, Math.min(pal.length - 1, Math.floor((t + jitter) * pal.length)));
      this.colors.push(T.pastel ? mix(pal[k], '#FFFFFF', 0.38) : pal[k]);
    }
  }

  // ---------- Görünüm: sığdırma, yakınlaştırma, kaydırma ----------

  resize(keepView) {
    const parent = this.canvas.parentElement;
    if (!parent || !this.level) return;
    const W = parent.clientWidth, H = parent.clientHeight;
    if (!W || !H) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    this.W = W; this.H = H;
    const pad = 0.6;
    const fitW = W / (this.level.w + pad * 2);
        // Zor/Ultra zor: hücre parmakla rahat dokunulacak boyutta sabit tutulur; tahta ekranın
    // hem eninden hem boyundan taşar (sağa sola ve aşağı yukarı kaydırılır)
    this.cs = this.level.meta?.scroll ? Math.max(24, Math.min(40, W / (this.level.w * 0.72))) : Math.min(fitW, H / (this.level.h + pad * 2), 64);
    if (!keepView) this.fit(); else this.clamp();
    this.anim.wake();
  }

  fit() {
    this.z = 1;
    this.ox = (this.W - this.cs * this.level.w) / 2;
    const bh = this.cs * this.level.h;
    // Uzun tahta: en üstten başlar
    this.oy = bh > this.H ? this.cs * 0.6 : (this.H - bh) / 2;
    this.clamp();
    this.anim.wake();
    this.onViewChange?.(this.z);
  }

  /** Ekrandaki (px, py) noktası sabit kalacak şekilde yakınlaştırır. */
  zoomAt(z, px, py) {
    z = Math.max(this.minZoom, Math.min(MAX_ZOOM, z));
    const k = z / this.z;
    this.ox = px - (px - this.ox) * k;
    this.oy = py - (py - this.oy) * k;
    this.z = z;
    this.clamp();
    this.anim.wake();
    this.onViewChange?.(this.z);
  }

  /** Büyük tahtalarda iki parmakla uzaklaşınca tahtanın tamamı genişliğe sığana kadar küçülür. */
  get minZoom() {
    const base = this.level?.meta?.scroll ? Math.min(1, this.W / (this.level.w + 1.2) / this.cs) : 1;
    return base * 0.6;
  }

  zoomBy(f) { this.zoomAt(this.z * f, this.W / 2, this.H / 2); }

  panBy(dx, dy) { this.ox += dx; this.oy += dy; this.clamp(); this.anim.wake(); }

  /** Her seviyede ve her yakınlıkta sürükleyerek kaydırılabilir. */
  canPan() {
    return !!this.level; // her yakınlıkta, her yöne serbest
  }

  /** Bir hücreyi ekranın ortasına getirir (ipucu gösterilirken). */
  centerOn(x, y) {
    this.ox = this.W / 2 - (x + 0.5) * this.cell;
    this.oy = this.H / 2 - (y + 0.5) * this.cell;
    this.clamp();
    this.anim.wake();
  }

  clamp() {
    const bw = this.cs * this.level.w * this.z, bh = this.cs * this.level.h * this.z;
    const m = this.cs * this.z * 0.6;
    // Kenarlardan sonra da bir miktar boş alana kaydırılabilir (serbest his)
    const sx = this.W * 0.45, sy = this.H * 0.45;
    // Tahta ekrana sığsa bile (her yakınlıkta) ortadan her yöne kaydırılabilir
    if (bw + m * 2 <= this.W) { const c = (this.W - bw) / 2; this.ox = Math.min(c + sx, Math.max(c - sx, this.ox)); }
    else this.ox = Math.min(m + sx, Math.max(this.W - bw - m - sx, this.ox));
    if (bh + m * 2 <= this.H) { const c = (this.H - bh) / 2; this.oy = Math.min(c + sy, Math.max(c - sy, this.oy)); }
    else this.oy = Math.min(m + sy, Math.max(this.H - bh - m - sy, this.oy));
  }

  get cell() { return this.cs * this.z; }

  toScreen(x, y) { return [this.ox + (x + 0.5) * this.cell, this.oy + (y + 0.5) * this.cell]; }

  /** Ekran koordinatından ok bulur: önce tam hücre, sonra yakın çevre (ince çizgilere kolay dokunma). */
  hitTest(clientX, clientY) {
    if (!this.level) return -1;
    const r = this.canvas.getBoundingClientRect();
    const fx = (clientX - r.left - this.ox) / this.cell - 0.5;
    const fy = (clientY - r.top - this.oy) / this.cell - 0.5;
    const { w, h } = this.level;
    // Parmak için en az ~22 px yarıçap: küçük hücrelerde komşu hücrelere de bakılır
    const R = Math.max(0.75, 22 / this.cell);
    const reach = Math.ceil(R);
    const rx = Math.round(fx), ry = Math.round(fy);
    let best = -1, bd = R * R;
    for (let y = ry - reach; y <= ry + reach; y++) for (let x = rx - reach; x <= rx + reach; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const o = this.state.occ[y * w + x];
      if (!o) continue;
      const dd = (x - fx) ** 2 + (y - fy) ** 2;
      if (dd < bd) { bd = dd; best = o - 1; }
    }
    return best;
  }

  // ---------- Animasyonlar ----------

  intro() {
    const L = this.level;
    for (let i = 0; i < L.n; i++) {
      const [hx, hy] = [L.px[i], L.py[i]];
      const d = Math.hypot(hx - L.w / 2, hy - L.h / 2);
      this.v.a[i] = 0;
      this.anim.add({ key: `p${i}`, dur: 320, delay: 30 + d * 22, ease: ease.outCubic, update: (t) => { this.v.a[i] = t; } });
    }
  }

  press(i, down) {
    if (i < 0) return;
    const from = this.v.press[i];
    this.anim.add({ key: `press${i}`, dur: down ? 90 : 180, update: (t) => { this.v.press[i] = from + ((down ? 1 : 0) - from) * t; } });
  }

  /** Başarılı hamle: ok kendi yolunu izleyerek tahtadan kayar. */
  exit(unit, delay = 0) {
    for (const i of unit) {
      const path = this.paths[i];
      const dist = path.toEdge + path.len + 0.5;
      this.v.flying[i] = 1; this.v.press[i] = 0;
      const dur = Math.min(900, 220 + dist * 26);
      let sparked = false;
      this.anim.add({ key: `p${i}`, dur, delay, ease: (t) => 0.4 * t + 0.6 * t * t,
        update: (t) => {
          const s = t * dist;
          this.v.s[i] = s;
          this.v.a[i] = s < path.toEdge ? 1 : Math.max(0, 1 - (s - path.toEdge) / (path.len + 0.5));
          if (!sparked && s >= path.toEdge - 0.6) {
            sparked = true;
            const d = this.level.pd[i];
            const [hx, hy] = [this.level.px[i] + DX[d] * (path.toEdge - 0.6), this.level.py[i] + DY[d] * (path.toEdge - 0.6)];
            const [sx, sy] = this.toScreen(hx, hy);
            this.burst(sx, sy, 5, d, 0.6, this.colors[i]);
          }
        },
        done: () => { this.v.flying[i] = 0; this.v.a[i] = 0; this.v.queued[i] = 0; } });
    }
    this.hint = null;
  }

  /** Engellenen hamle: ok engele kadar kayar, yaylanarak geri döner; ok ve engel kısa süre vurgulanır. */
  blocked(i, res) {
    const p = res.path;
    const reach = p ? (p.dist === 0 ? 0.22 : p.dist + 0.12) : 0.22;
    const out = Math.min(110 + reach * 45, 320);
    this.anim.add({ key: `p${i}`, dur: out + 300, ease: ease.linear,
      update: (t) => {
        const ms = t * (out + 300);
        this.v.s[i] = ms < out ? ease.outCubic(ms / out) * reach : reach * (1 - ease.outBack((ms - out) / 300));
      },
      done: () => { this.v.s[i] = 0; } });
    this.v.queued[i] = 1; this.anim.wake();
    this.flash(i);
    if (p && p.blocker >= 0) setTimeout(() => this.flash(p.blocker, 0.6), out * 0.8);
  }

  refuse(i) { this.flash(i); }

  /** Sırada bekleyen (siyah) okları oturumla eşitler. */
  syncQueued(set) {
    for (let i = 0; i < this.level.n; i++) this.v.queued[i] = set.has(i) ? 1 : 0;
    this.anim.wake();
  }

  flash(i, amt = 1) {
    this.anim.add({ key: `flash${i}`, dur: 460, ease: ease.linear, update: (t) => { this.v.flash[i] = Math.sin(t * Math.PI) * amt; } });
  }

  restore(indices) {
    for (const i of indices) {
      this.v.flying[i] = 0; this.v.s[i] = 0;
      this.anim.add({ key: `p${i}`, dur: 300, update: (t) => { this.v.a[i] = t; } });
    }
    this.hint = null;
  }

  checkUnlocks() {}

  showHint(h) { this.hint = { ...h, t0: performance.now() }; this.anim.wake(); }
  clearHint() { this.hint = null; this.anim.wake(); }

  win() {
    this.anim.add({ key: 'win', dur: 900, ease: ease.linear, update: (t) => { this.winGlow = t; }, done: () => { this.winGlow = 0; } });
  }

  burst(x, y, count, dir, power = 1, color) {
    if (this.anim.reducedMotion) return;
    const unit = Math.max(14, this.cell);
    for (let k = 0; k < count; k++) {
      let a = Math.random() * TAU;
      if (dir >= 0) a = Math.atan2(DY[dir], DX[dir]) + (Math.random() - 0.5) * 1.6;
      const sp = (0.9 + Math.random() * 1.6) * unit * 0.055 * power;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (dir < 0 ? unit * 0.03 : 0),
        life: 0, max: 520 + Math.random() * 420, r: unit * (0.04 + Math.random() * 0.05),
        c: color || P.particles[(Math.random() * P.particles.length) | 0], sq: Math.random() < 0.4 });
    }
    if (this.particles.length > 160) this.particles.splice(0, this.particles.length - 160);
    this.anim.hold(1000);
  }

  // ---------- Çizim ----------

  draw(now) {
    const dt = Math.min(48, now - this.lastNow);
    this.lastNow = now;
    const g = this.ctx;
    if (!this.level || !this.W) return false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const L = this.level, S = this.state, v = this.v, c = this.cell;

    // Nokta ızgarası: şeklin her hücresinin ortasında bir nokta. Oyuncu okun yolunu ve
    // çıkış hattını noktaları takip ederek görür; ok çıktıkça şekil noktalarla belli olur.
    const dr = Math.max(1.1, c * 0.055);
    g.fillStyle = this.winGlow > 0 ? P.dotWin : P.dot;
    g.beginPath();
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!L.mask[y * L.w + x]) continue;
      const cx = this.ox + (x + 0.5) * c, cy = this.oy + (y + 0.5) * c;
      if (cx < -c || cy < -c || cx > this.W + c || cy > this.H + c) continue;
      g.moveTo(cx + dr, cy);
      g.arc(cx, cy, dr, 0, TAU);
    }
    g.fill();

    // İpucu: çıkış hattı kılavuzu
    let pulse = 0;
    if (this.hint) {
      pulse = 0.5 + 0.5 * Math.sin((now - this.hint.t0) / 240);
      for (const i of this.hint.unit) if (S.alive[i]) this.drawGuide(g, i, P.hint);
    }

    const lw = Math.max(1.4, c * 0.13);
    g.lineCap = 'butt'; g.lineJoin = 'miter';
    for (let i = 0; i < L.n; i++) {
      if ((!S.alive[i] && !v.flying[i]) || v.a[i] <= 0.01) continue;
      const hinted = this.hint && (this.hint.unit.includes(i) || (this.hint.next || []).includes(i));
      if (hinted) {
        const isNext = !this.hint.unit.includes(i);
        this.drawSnake(g, i, lw * 3.4, isNext ? P.hintNext : P.hint, (isNext ? 0.25 : 0.32) + pulse * 0.25);
      }
      if (v.flash[i] > 0) this.drawSnake(g, i, lw * 3, P.queued, v.flash[i] * 0.3);
      this.drawSnake(g, i, lw * (1 + v.press[i] * 0.35), v.queued[i] ? P.queued : this.colors[i], v.a[i]);
    }

    if (this.particles.length) {
      const ps = this.particles;
      for (let k = ps.length - 1; k >= 0; k--) {
        const p = ps[k];
        p.life += dt;
        if (p.life >= p.max) { ps.splice(k, 1); continue; }
        const f = dt / 16.7;
        p.x += p.vx * f; p.y += p.vy * f; p.vx *= 0.96; p.vy = p.vy * 0.96 + 0.35 * f;
        g.globalAlpha = 1 - p.life / p.max;
        g.fillStyle = p.c;
        g.beginPath();
        if (p.sq) g.rect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); else g.arc(p.x, p.y, p.r, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    return this.particles.length > 0 || (!!this.hint && now - this.hint.t0 < 10000);
  }

  /** Oku, yolu üzerinde v.s kadar ilerlemiş olarak çizer (gövde + ok başı). */
  drawSnake(g, i, lw, color, alpha) {
    const path = this.paths[i];
    const s = this.v.s[i];
    const pts = path.pts, len = path.len;
    const at = (q) => {
      const k = Math.min(pts.length - 2, Math.max(0, Math.floor(q)));
      const f = q - k;
      return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f];
    };
    const start = s, end = s + len - 1;
    g.globalAlpha = alpha;
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw;
    g.beginPath();
    let [x, y] = at(start);
    let [sx, sy] = this.toScreen(x, y);
    g.moveTo(sx, sy);
    for (let k = Math.floor(start) + 1; k < end; k++) {
      [sx, sy] = this.toScreen(pts[k][0], pts[k][1]);
      g.lineTo(sx, sy);
    }
    const [hx, hy] = at(end);
    const [ex, ey] = this.toScreen(hx, hy);
    g.lineTo(ex, ey);
    g.stroke();
    // Ok başı: başın hareket yönünde üçgen
    const d = this.level.pd[i];
    const dir = len > 1 ? segDir(pts, end) : d;
    const c = this.cell, ux = DX[dir], uy = DY[dir];
    const tipX = ex + ux * c * 0.34, tipY = ey + uy * c * 0.34;
    const bx = ex - ux * c * 0.02, by = ey - uy * c * 0.02;
    const half = Math.max(lw * 1.7, c * 0.22);
    g.beginPath();
    g.moveTo(tipX, tipY);
    g.lineTo(bx - uy * half, by + ux * half);
    g.lineTo(bx + uy * half, by - ux * half);
    g.closePath();
    g.lineWidth = Math.max(1, lw * 0.35);
    g.stroke();
    g.fill();
    g.globalAlpha = 1;
  }

  drawGuide(g, i, color) {
    const L = this.level, d = L.pd[i], path = this.paths[i];
    const [x0, y0] = this.toScreen(L.px[i] + DX[d] * 0.6, L.py[i] + DY[d] * 0.6);
    const [x1, y1] = this.toScreen(L.px[i] + DX[d] * (path.toEdge - 0.5), L.py[i] + DY[d] * (path.toEdge - 0.5));
    g.save();
    g.globalAlpha = 0.7;
    g.strokeStyle = color; g.lineWidth = Math.max(2, this.cell * 0.09); g.lineCap = 'round';
    g.setLineDash([1, Math.max(5, this.cell * 0.32)]);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.restore();
  }
}

function segDir(pts, q) {
  const k = Math.min(pts.length - 2, Math.max(0, Math.ceil(q) - 1));
  const dx = Math.sign(pts[k + 1][0] - pts[k][0]), dy = Math.sign(pts[k + 1][1] - pts[k][1]);
  return dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
