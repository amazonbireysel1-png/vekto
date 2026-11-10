// Oyun oturumu: bir bölümün oynanış durumunu yönetir (hamleler, hatalar, geri alma,
// ipucu, kazanma/kaybetme). Görselden bağımsızdır; arayüz sonuç nesnelerine göre animasyon yapar.

import { createState, cloneState, evaluate, applyUnit, REASON } from './js-core-rules.js';
import { findHint, solve } from './js-core-solver.js';

export const UNDO_PER_LEVEL = 3;
export const LIVES = 3;

export class Session {
  constructor(level) {
    this.level = level;
    this.state = createState(level);
    this.history = [];
    this.moves = 0;      // toplam dokunuş (hamle sınırı için)
    this.cleared = 0;    // başarılı hamle
    this.mistakes = 0;   // engellenen dokunuş
    this.lives = LIVES;  // her takılmada 1 can gider; biterse seviye baştan başlar
    this.hintsUsed = 0;
    this.undosLeft = UNDO_PER_LEVEL;
    this.hintStage = 0;  // aynı durumda 1: ok göster, 2: sonraki adımı açıkla
    this.hintKey = '';
    this.startedAt = Date.now();
    this.finished = false;
    this.result = null;  // 'win' | 'out_of_lives'
  }

  get movesLeft() {
    return this.level.moveLimit ? Math.max(0, this.level.moveLimit - this.moves) : Infinity;
  }

  /** Oka dokunma. Dönüş: { type: 'move'|'blocked'|'locked'|'chain'|'ignored', ... } */
  tap(i) {
    if (this.finished || i < 0 || i >= this.level.n || !this.state.alive[i]) return { type: 'ignored' };
    const ev = evaluate(this.level, this.state, i);
    this.moves++;
    if (!ev.ok) {
      this.mistakes++;
      this.lives = Math.max(0, this.lives - 1);
      const out = { type: ev.reason, unit: ev.unit, culprit: ev.culprit, path: ev.path, lives: this.lives };
      if (this.lives === 0) { this.finished = true; this.result = 'out_of_lives'; out.outOfLives = true; }
      return out;
    }
    this.history.push({ state: cloneState(this.state), moves: this.moves - 1, cleared: this.cleared });
    applyUnit(this.level, this.state, ev.unit);
    this.cleared++;
    this.hintStage = 0;
    const out = { type: 'move', unit: ev.unit, paths: ev.paths, remaining: this.state.aliveCount };
    if (this.state.aliveCount === 0) {
      this.finished = true;
      this.result = 'win';
      out.win = true;
    }
    return out;
  }

  canUndo() { return this.history.length > 0 && this.undosLeft > 0 && this.result !== 'win'; }

  /** Son başarılı hamleyi geri alır. Hamle sayacı da o ana döner; hata sayısı korunur. */
  undo() {
    if (!this.canUndo()) return null;
    const h = this.history.pop();
    const before = this.state;
    this.state = h.state;
    this.moves = h.moves;
    this.cleared = h.cleared;
    this.undosLeft--;
    this.finished = false;
    this.result = null;
    this.hintStage = 0;
    const restored = [];
    for (let i = 0; i < this.level.n; i++) if (this.state.alive[i] && !before.alive[i]) restored.push(i);
    return { restored };
  }

  /**
   * İpucu ister. İlk istek doğru bir oku işaret eder; aynı durumda ikinci istek
   * bir sonraki adımı da açıklar. Çözümü tamamen vermez.
   */
  hint() {
    if (this.finished) return null;
    const key = this.state.alive.join('');
    if (key !== this.hintKey) { this.hintKey = key; this.hintStage = 0; }
    const h = findHint(this.level, this.state);
    if (!h) return null;
    this.hintStage = Math.min(2, this.hintStage + 1);
    this.hintsUsed++;
    return { stage: this.hintStage, unit: h.unit, next: this.hintStage >= 2 ? h.next : null, gain: h.gain };
  }

  /** Mevcut durumun hâlâ çözülebilir olup olmadığı (testler ve güvenlik için). */
  solvable() { return solve(this.level, this.state).solvable; }

  stars() {
    // Hiç takılmadan 3, bir can kaybıyla 2, iki can kaybıyla 1 yıldız
    let s = 3 - Math.min(2, this.mistakes);
    if (this.hintsUsed > 0) s = Math.min(s, 2);
    return Math.max(1, s);
  }

  elapsed() { return Date.now() - this.startedAt; }
}

export { REASON };
