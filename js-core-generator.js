// Çözülebilirliği garanti eden kıvrımlı ok üreticisi.
//
// Yöntem: "Ters inşa". Oklar ÇÖZÜM SIRASININ TERSİNE yerleştirilir: her yeni okun
// başının önündeki hat, o ana kadar yerleşmiş oklara çarpmamalıdır. Böylece son
// yerleşen ok ilk çıkabilen olur; geçerli bir çözüm sırası inşa sırasında oluşur.
// Zorluk için yeni oklar tercihen mevcut okların ÇIKIŞ HATTININ ÜZERİNE uzatılır
// (onları kilitler). Sonuç bağımsız çözücüyle (solver.js) yeniden doğrulanır.

import { createRng } from './js-core-rng.js';
import { DX, DY, compileLevel, createState, cloneState, movableUnits, applyUnit } from './js-core-rules.js';
import { measure } from './js-core-solver.js';

/**
 * p: { w, h, mask, density (0..1), blockBias (0..1), minLen, maxLen, straight (0..1),
 *      targetScore, attempts }
 */
export function generate(p, seed) {
  const attempts = p.attempts || 4;
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const cand = buildOnce(p, (seed + a * 7919) >>> 0);
    if (!cand) continue;
    const dist = p.targetScore != null ? Math.abs(cand.metrics.score - p.targetScore) / Math.max(1, p.targetScore) : 0;
    const rank = dist - cand.fill * 0.8;
    if (!best || rank < best.rank) best = { ...cand, rank };
  }
  return best;
}

function buildOnce(p, seed) {
  const rng = createRng(seed);
  const { w, h } = p;
  const size = w * h;
  const mask = p.mask || new Uint8Array(size).fill(1);
  const inside = [];
  for (let c = 0; c < size; c++) if (mask[c]) inside.push(c);
  const occ = new Int16Array(size);         // 0 boş, >0 ok numarası+1
  const cover = new Uint16Array(size);      // kaç okun çıkış hattı bu hücreden geçiyor
  const rayDepth = new Uint16Array(size);   // bu hücreden geçen hatların en derin kilit zinciri
  const depth = [];
  const snakes = [];
  const target = Math.round(inside.length * p.density);
  let filled = 0, fails = 0;

  const rayCells = (c, d) => {
    const out = [];
    let x = (c % w) + DX[d], y = ((c / w) | 0) + DY[d];
    while (x >= 0 && y >= 0 && x < w && y < h) { out.push(y * w + x); x += DX[d]; y += DY[d]; }
    return out;
  };
  const rayClear = (ray) => ray.every((c) => occ[c] === 0);

  while (filled < target && fails < 220) {
    // Aday baş hücreleri ve yönleri
    let best = null;
    const tries = 10;
    for (let k = 0; k < tries; k++) {
      const head = inside[(rng.next() * inside.length) | 0];
      if (occ[head]) continue;
      const dirs = rng.shuffle([0, 1, 2, 3]);
      for (const d of dirs) {
        const ray = rayCells(head, d);
        if (!rayClear(ray)) continue;
        const body = growBody(head, d, ray);
        if (!body) continue;
        let cov = 0, dep = 0;
        for (const c of body) { cov += cover[c]; if (rayDepth[c] > dep) dep = rayDepth[c]; }
        // Derin zincir: yeni ok, en derin kilitli okun yolunu kapatırsa çözüm daha çok adım ister
        const score = dep * 2 * p.blockBias + (cov / body.length) + body.length * 0.08 + rng.next() * 0.6;
        if (!best || score > best.score) best = { body, d, ray, score, dep };
        break;
      }
      if (best && !rng.chance(p.blockBias)) break;
    }
    if (!best) { fails++; continue; }
    const idx = snakes.length;
    snakes.push({ cells: best.body.slice().reverse(), d: best.d }); // kuyruk → baş
    for (const c of best.body) occ[c] = idx + 1;
    const D = best.dep + 1;
    depth.push(D);
    for (const c of best.ray) { cover[c]++; if (rayDepth[c] < D) rayDepth[c] = D; }
    filled += best.body.length;
  }

  // Boşluk doldurma: kalan boş hücrelere sığan kısa okları sistematik olarak dene
  if (p.fillGaps !== false) {
    const order = rng.shuffle(inside.slice());
    for (const head of order) {
      if (occ[head]) continue;
      for (const d of rng.shuffle([0, 1, 2, 3])) {
        const ray = rayCells(head, d);
        if (!rayClear(ray)) continue;
        const body = growBody(head, d, ray);
        if (!body || body.length < 2) continue;
        const idx = snakes.length;
        snakes.push({ cells: body.slice().reverse(), d });
        for (const c of body) occ[c] = idx + 1;
        for (const c of ray) cover[c]++;
        filled += body.length;
        break;
      }
    }
  }

  /** Baştan geriye doğru gövde büyütür: boş, şekil içinde, kendi çıkış hattında olmayan hücreler. */
  function growBody(head, d, ray) {
    const banned = new Set(ray);
    const L = p.minLen + Math.floor(rng.next() * (p.maxLen - p.minLen + 1));
    const body = [head];
    const used = new Set(body);
    let cur = head;
    let dir = (d + 2) % 4; // gövde, başın tersine doğru uzar
    for (let s = 1; s < L; s++) {
      const x = cur % w, y = (cur / w) | 0;
      const options = [];
      for (let nd = 0; nd < 4; nd++) {
        if (s === 1 && nd !== (d + 2) % 4) continue; // baş, gövdenin son parçasıyla aynı doğrultuda
        const nx = x + DX[nd], ny = y + DY[nd];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nc = ny * w + nx;
        if (!mask[nc] || occ[nc] || used.has(nc) || banned.has(nc)) continue;
        // Sıkı kıvrımlara izin ver ama 2×2'den büyük yumak oluşmasın
        let touches = 0;
        for (let q = 0; q < 4; q++) {
          const tx = nx + DX[q], ty = ny + DY[q];
          if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
          if (used.has(ty * w + tx)) touches++;
        }
        if (touches > 2) continue;
        options.push({ nd, nc, wgt: nd === dir ? p.straight * 4 + 0.3 : 1 });
      }
      if (!options.length) break;
      let r = rng.next() * options.reduce((a, o) => a + o.wgt, 0), pick = options[0];
      for (const o of options) { r -= o.wgt; if (r <= 0) { pick = o; break; } }
      body.push(pick.nc); used.add(pick.nc); cur = pick.nc; dir = pick.nd;
    }
    return body.length >= Math.min(2, p.minLen) ? body : null;
  }

  if (snakes.length < 2) return null;
  const def = { w, h, mask, snakes };
  const level = compileLevel(def);
  const metrics = measure(level, createState(level));
  if (!metrics.solvable) return null;
  return { level, def, metrics, fill: filled / inside.length };
}

// ---------------------------------------------------------------------------
// Yoğun "örgü" üretici: önce şeklin TAMAMI kıvrımlı yollarla kaplanır, sonra çözücü
// tıkanan düğümleri bulur ve okları ters çevirerek, bölerek ya da (son çare) çıkararak
// açar. Sonuç her zaman çözülebilir ve tahta neredeyse tamamen doludur.
// ---------------------------------------------------------------------------
export function generateWoven(p, seed) {
  const attempts = p.attempts || 3;
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const c = weaveOnce(p, (seed + a * 15485863) >>> 0);
    if (!c) continue;
    // Doluluk her zaman önemli; dalganın başında sade, sonunda düğümlü aday tercih edilir
    const rank = c.fill * 2 + c.metrics.score * 0.08 * (p.hardness ?? 0.5);
    if (!best || rank > best.rank) best = { ...c, rank };
  }
  return best;
}

function weaveOnce(p, seed) {
  const rng = createRng(seed);
  const { w, h } = p;
  const size = w * h;
  let mask = p.mask || new Uint8Array(size).fill(1);
  const inside = [];
  for (let c = 0; c < size; c++) if (mask[c]) inside.push(c);
  const owner = new Int32Array(size).fill(-1);
  let paths = [];

  // 1) Kaplama: rastgele yürüyüşlerle yollar
  for (const start of rng.shuffle(inside.slice())) {
    if (owner[start] >= 0) continue;
    const L = p.minLen + Math.floor(rng.next() * (p.maxLen - p.minLen + 1));
    const path = [start];
    const id = paths.length;
    owner[start] = id;
    let cur = start, dir = -1;
    while (path.length < L) {
      const x = cur % w, y = (cur / w) | 0;
      const opts = [];
      for (let nd = 0; nd < 4; nd++) {
        const nx = x + DX[nd], ny = y + DY[nd];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nc = ny * w + nx;
        if (!mask[nc] || owner[nc] >= 0) continue;
        let touches = 0;
        for (let q = 0; q < 4; q++) {
          const tx = nx + DX[q], ty = ny + DY[q];
          if (tx >= 0 && ty >= 0 && tx < w && ty < h && owner[ty * w + tx] === id) touches++;
        }
        if (touches > 2) continue;
        opts.push({ nd, nc, wgt: nd === dir ? p.straight * 4 + 0.3 : 1 });
      }
      if (!opts.length) break;
      let r = rng.next() * opts.reduce((s, o) => s + o.wgt, 0), pick = opts[0];
      for (const o of opts) { r -= o.wgt; if (r <= 0) { pick = o; break; } }
      path.push(pick.nc); owner[pick.nc] = id; cur = pick.nc; dir = pick.nd;
    }
    paths.push(path);
  }
  // Tek hücrelik artıkları komşu bir yolun ucuna ekle (mümkünse)
  for (let i = 0; i < paths.length; i++) {
    const pth = paths[i];
    if (pth.length !== 1) continue;
    const c = pth[0], x = c % w, y = (c / w) | 0;
    for (let nd = 0; nd < 4 && pth.length === 1; nd++) {
      const nx = x + DX[nd], ny = y + DY[nd];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const o = owner[ny * w + nx];
      if (o < 0 || o === i || paths[o].length < 2) continue;
      const q = paths[o];
      if (q[q.length - 1] === ny * w + nx) { q.push(c); owner[c] = o; pth.length = 0; }
      else if (q[0] === ny * w + nx) { q.unshift(c); owner[c] = o; pth.length = 0; }
    }
  }
  paths = paths.filter((q) => q.length >= 2);

  // 2) Yön: başı rastgele uçta; kendi gövdesine bakıyorsa ters çevir
  const dirOf = (q) => {
    const a = q[q.length - 2], b = q[q.length - 1];
    const dx = (b % w) - (a % w), dy = ((b / w) | 0) - ((a / w) | 0);
    return dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
  };
  const selfBlocked = (q) => {
    const d = dirOf(q), set = new Set(q);
    let x = (q[q.length - 1] % w) + DX[d], y = ((q[q.length - 1] / w) | 0) + DY[d];
    while (x >= 0 && y >= 0 && x < w && y < h) { if (set.has(y * w + x)) return true; x += DX[d]; y += DY[d]; }
    return false;
  };
  let snakes = [];
  for (const q of paths) {
    let s = rng.chance(0.5) ? q.slice() : q.slice().reverse();
    if (selfBlocked(s)) s.reverse();
    if (selfBlocked(s)) {
      // İki yöne de kendine bakıyor: ortadan böl
      const m = Math.floor(s.length / 2);
      for (const part of [s.slice(0, m), s.slice(m)]) if (part.length >= 2 && !selfBlocked(part)) snakes.push(part);
      continue;
    }
    snakes.push(s);
  }

  // Boşluk doldurma: boş hücrelere, başının önü TAMAMEN açık kısa oklar ekle.
  // Böyle bir ok baştan serbesttir; önce o çıkarılabildiği için çözülebilirlik bozulmaz.
  function fillGaps() {
    const occ = new Uint8Array(size);
    for (const c of snakes) for (const x of c) occ[x] = 1;
    for (const start of rng.shuffle(inside.slice())) {
      if (occ[start]) continue;
      for (const d of rng.shuffle([0, 1, 2, 3])) {
        // Baş = start, ray boş olmalı
        let x = (start % w) + DX[d], y = ((start / w) | 0) + DY[d], ok = true;
        const ray = new Set();
        while (x >= 0 && y >= 0 && x < w && y < h) { if (occ[y * w + x]) { ok = false; break; } ray.add(y * w + x); x += DX[d]; y += DY[d]; }
        if (!ok) continue;
        // Gövde başın arkasından büyür
        const back = (d + 2) % 4;
        const bx = (start % w) + DX[back], by = ((start / w) | 0) + DY[back];
        if (bx < 0 || by < 0 || bx >= w || by >= h) continue;
        let cur = by * w + bx;
        if (!mask[cur] || occ[cur] || ray.has(cur)) continue;
        const body = [start, cur];
        const used = new Set(body);
        const L = Math.min(p.maxLen, 2 + Math.floor(rng.next() * 4));
        let dir = back;
        while (body.length < L) {
          const cx = cur % w, cy = (cur / w) | 0;
          const opts = [];
          for (let nd = 0; nd < 4; nd++) {
            const nx = cx + DX[nd], ny = cy + DY[nd];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nc = ny * w + nx;
            if (!mask[nc] || occ[nc] || used.has(nc) || ray.has(nc)) continue;
            opts.push({ nc, nd, wgt: nd === dir ? 2 : 1 });
          }
          if (!opts.length) break;
          let r = rng.next() * opts.reduce((a, o) => a + o.wgt, 0), pick = opts[0];
          for (const o of opts) { r -= o.wgt; if (r <= 0) { pick = o; break; } }
          body.push(pick.nc); used.add(pick.nc); cur = pick.nc; dir = pick.nd;
        }
        const sn = body.reverse(); // kuyruk → baş
        snakes.push(sn);
        for (const c of sn) occ[c] = 1;
        break;
      }
    }
  }

  // Kuyruk uzatma: boş bir hücre bir okun kuyruğuna bitişikse ok o hücreye uzatılır.
  // Baş ve yön değişmez; tahtanın çözülebilirliği her uzatmadan sonra doğrulanır.
  function solvableNow() {
    const lv = compileLevel({ w, h, mask, snakes: snakes.map((c) => ({ cells: c, d: dirOf(c) })) });
    const st = createState(lv);
    for (;;) { const f = movableUnits(lv, st); if (!f.length) break; for (const u of f) applyUnit(lv, st, u); }
    return st.aliveCount === 0;
  }
  function extendTails() {
    for (let pass = 0; pass < 4; pass++) {
      const occ = new Int32Array(size).fill(-1);
      snakes.forEach((c, i) => { for (const x of c) occ[x] = i; });
      let changed = false;
      for (const e of rng.shuffle(inside.slice())) {
        if (occ[e] >= 0) continue;
        const ex = e % w, ey = (e / w) | 0;
        for (const nd of rng.shuffle([0, 1, 2, 3])) {
          const nx = ex + DX[nd], ny = ey + DY[nd];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const i = occ[ny * w + nx];
          if (i < 0 || snakes[i][0] !== ny * w + nx) continue; // yalnızca kuyruk ucu
          const cand = [e, ...snakes[i]];
          if (selfBlocked(cand)) continue;
          const old = snakes[i];
          snakes[i] = cand;
          if (solvableNow()) { occ[e] = i; changed = true; break; }
          snakes[i] = old;
        }
      }
      if (!changed) break;
    }
  }

  // 3) Çözülebilir hâle getir: tıkanan okları çevir / böl / çıkar
  for (let iter = 0; iter < 400; iter++) {
    const level = compileLevel({ w, h, mask, snakes: snakes.map((c) => ({ cells: c, d: dirOf(c) })) });
    const st = createState(level);
    const s = cloneState(st);
    for (;;) { const free = movableUnits(level, s); if (!free.length) break; for (const u of free) applyUnit(level, s, u); }
    if (s.aliveCount === 0) {
      fillGaps();
      extendTails();
      // Hâlâ doldurulamayan hücreler şeklin dışına alınır: tahtada boş nokta kalmaz
      const finalMask = new Uint8Array(size);
      for (const c of snakes) for (const x of c) finalMask[x] = 1;
      mask = finalMask;
      const final = compileLevel({ w, h, mask, snakes: snakes.map((c) => ({ cells: c, d: dirOf(c) })) });
      const metrics = measure(final, createState(final));
      if (!metrics.solvable) return null;
      let filled = 0;
      for (const c of snakes) filled += c.length;
      return { level: final, def: { w, h, mask, snakes }, metrics, fill: filled / inside.length };
    }
    const stuck = [];
    for (let i = 0; i < level.n; i++) if (s.alive[i]) stuck.push(i);
    // Tıkanan oklardan birkaçını ele al: önce ters çevirmeyi dene, olmazsa böl, en son çıkar
    const k = Math.max(1, Math.round(stuck.length * 0.15));
    const touched = new Set();
    for (const i of rng.shuffle(stuck).slice(0, k)) {
      const sn = snakes[i];
      const rev = sn.slice().reverse();
      const tries = (sn._tries || 0) + 1;
      if (tries <= 1 && !selfBlocked(rev)) { rev._tries = tries; snakes[i] = rev; touched.add(i); continue; }
      if (sn.length >= 3 && tries <= 5) {
        const m = 1 + Math.floor(rng.next() * (sn.length - 2));
        const a = sn.slice(0, m + 1), b = sn.slice(m + 1);
        const parts = [a, b].filter((x) => x.length >= 2 && !selfBlocked(x));
        parts.forEach((x) => { x._tries = tries; });
        snakes[i] = parts[0] || null;
        if (parts[1]) snakes.push(parts[1]);
        continue;
      }
      snakes[i] = null; // son çare: boşluk bırak
    }
    snakes = snakes.filter(Boolean);
  }
  return null;
}
