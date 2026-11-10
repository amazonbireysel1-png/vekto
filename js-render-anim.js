// Hafif zaman tabanlı animasyon zamanlayıcısı. Döngü yalnızca aktif animasyon
// varken çalışır; boşta CPU/pil tüketmez.

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  outQuint: (t) => 1 - (1 - t) ** 5,
  inQuad: (t) => t * t,
};

export class Animator {
  constructor(onFrame) {
    this.items = new Set();
    this.onFrame = onFrame; // (now) => boolean  (true: çizmeye devam et)
    this.raf = 0;
    this.keepAlive = 0;
    this._tick = this._tick.bind(this);
    this.reducedMotion = false;
  }

  /** { dur, delay, ease, update(t), done(), key } — key verilirse aynı anahtarlı önceki iptal edilir. */
  add(spec) {
    if (spec.key) for (const it of this.items) if (it.key === spec.key) { this.items.delete(it); }
    const it = { ease: ease.outCubic, delay: 0, ...spec, start: performance.now() };
    if (this.reducedMotion) { it.dur = Math.min(it.dur, 120); it.delay = 0; }
    this.items.add(it);
    this.wake();
    return it;
  }

  cancel(key) { for (const it of this.items) if (it.key === key) this.items.delete(it); }

  /** Bir sonraki karede çizimi tetikler. */
  wake() { if (!this.raf) this.raf = requestAnimationFrame(this._tick); }

  /** ms süresince sürekli çizim (parçacıklar, nabız efektleri). */
  hold(ms) { this.keepAlive = Math.max(this.keepAlive, performance.now() + ms); this.wake(); }

  _tick(now) {
    this.raf = 0;
    for (const it of [...this.items]) {
      const el = now - it.start - it.delay;
      if (el < 0) continue;
      const t = Math.min(1, el / it.dur);
      it.update(it.ease(t), t);
      if (t >= 1) { this.items.delete(it); it.done && it.done(); }
    }
    const more = this.onFrame(now);
    if (this.items.size || more || now < this.keepAlive) this.wake();
  }

  get busy() { return this.items.size > 0; }

  clear() { this.items.clear(); }
}
