// Oyun kuralları — saf mantık, arayüzden tamamen bağımsız.
//
// Her ok, birbirine bitişik hücrelerden oluşan kıvrımlı bir yoldur (kuyruk → baş).
// Başın baktığı yön okun çıkış yönüdür. Oka dokunulduğunda ok kendi yolunu izleyerek
// başının yönünde tahtadan kayar. Başın önündeki düz hat (tahta kenarına kadar)
// başka bir okun herhangi bir parçasıyla kesişiyorsa ok hareket edemez.

export const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const DIR_CHARS = '^>v<';

export const REASON = Object.freeze({ OK: 'ok', BLOCKED: 'blocked' });

/**
 * def: { w, h, mask?: Uint8Array, snakes: { cells: number[] (kuyruk→baş, y*w+x), d }[], meta? }
 */
export function compileLevel(def) {
  const { w, h } = def;
  const size = w * h;
  const mask = new Uint8Array(size);
  if (def.mask) mask.set(def.mask); else mask.fill(1);
  const n = def.snakes.length;
  const cells = def.snakes.map((s) => Int32Array.from(s.cells));
  const pd = new Uint8Array(n);
  const px = new Int16Array(n), py = new Int16Array(n); // baş hücresi
  let total = 0;
  def.snakes.forEach((s, i) => {
    pd[i] = s.d;
    const hc = s.cells[s.cells.length - 1];
    px[i] = hc % w; py[i] = (hc / w) | 0;
    total += s.cells.length;
  });
  return { w, h, n, size, mask, cells, pd, px, py, total, units: n, moveLimit: 0, meta: def.meta || {}, def };
}

export function createState(level) {
  const occ = new Int16Array(level.size);
  for (let i = 0; i < level.n; i++) for (const c of level.cells[i]) occ[c] = i + 1;
  return { occ, alive: new Uint8Array(level.n).fill(1), removed: 0, aliveCount: level.n };
}

export function cloneState(s) {
  return { occ: s.occ.slice(), alive: s.alive.slice(), removed: s.removed, aliveCount: s.aliveCount };
}

/** Başın önündeki hattı tarar. Dönüş: { blocked, dist (engele kadar boş hücre), blocker } */
export function scanPath(level, state, i) {
  const { w, h } = level;
  const d = level.pd[i];
  let x = level.px[i] + DX[d], y = level.py[i] + DY[d], dist = 0;
  while (x >= 0 && y >= 0 && x < w && y < h) {
    const o = state.occ[y * w + x];
    if (o > 0) return { blocked: true, dist, blocker: o - 1, bx: x, by: y };
    x += DX[d]; y += DY[d]; dist++;
  }
  return { blocked: false, dist, blocker: -2 };
}

export function unitOf(level, state, i) { return [i]; }

export function evaluate(level, state, i) {
  if (!state.alive[i]) return { ok: false, reason: 'dead', unit: [] };
  const p = scanPath(level, state, i);
  if (p.blocked) return { ok: false, reason: REASON.BLOCKED, unit: [i], culprit: i, path: p };
  return { ok: true, reason: REASON.OK, unit: [i], paths: [p] };
}

export function applyUnit(level, state, unit) {
  for (const j of unit) {
    if (!state.alive[j]) continue;
    state.alive[j] = 0;
    for (const c of level.cells[j]) state.occ[c] = 0;
    state.removed++;
    state.aliveCount--;
  }
}

export function movableUnits(level, state) {
  const out = [];
  for (let i = 0; i < level.n; i++) if (state.alive[i] && !scanPath(level, state, i).blocked) out.push([i]);
  return out;
}

export function layoutSignature(level) {
  let s = `${level.w}x${level.h}|`;
  for (let i = 0; i < level.n; i++) s += `${level.cells[i].join(',')}${DIR_CHARS[level.pd[i]]};`;
  return s;
}

// Geriye dönük uyumluluk (eski mekanikler kaldırıldı)
export function currentChain() { return Infinity; }
export function lockRemaining() { return 0; }
