// Bölüm kataloğu: 500 bölüm. Zorluk dalgalı ilerler: her 10 bölümlük dalga kolaydan
// zora tırmanır, sonraki dalga biraz daha yukarıdan yeniden başlar. Böylece zor bir
// bölümün ardından nefes aldıran kolay bölümler gelir ama genel seviye sürekli yükselir.

import { hashString, createRng } from './js-core-rng.js';
import { compileLevel, createState } from './js-core-rules.js';
import { generateWoven as generate } from './js-core-generator.js';
import { shapeMask, shapeLabel, shapeAspect, SHAPE_NAMES } from './js-core-shapes.js';
import { HANDCRAFTED, parseHandcrafted } from './js-core-handcrafted.js';
import { measure } from './js-core-solver.js';

export const MAX_LEVEL = 500;
export const WAVE = 10;
export const BOSS_EVERY = 50;
export const CHAPTER_SIZE = 25;

const WAVE_SHAPE = [0, 0.05, 0.09, 0.13, 0.07, 0.15, 0.19, 0.24, 0.29, 0.36];

/** 0 (çok kolay) … 1 (uzman) */
export function difficultyOf(n) {
  if (n <= 3) return 0.02 * n;
  const cycle = Math.floor((n - 1) / WAVE), pos = (n - 1) % WAVE;
  const base = 0.04 + 0.6 * Math.min(1, cycle / (MAX_LEVEL / WAVE - 1));
  return Math.min(1, base + WAVE_SHAPE[pos] + (isBoss(n) ? 0.06 : 0));
}

export const DIFFICULTY_LABELS = [
  { max: 0.22, name: 'Kolay', tone: 'mint' },
  { max: 0.42, name: 'Orta', tone: 'blue' },
  { max: 0.62, name: 'Zor', tone: 'lav' },
  { max: 0.8, name: 'Çok zor', tone: 'sand' },
  { max: 2, name: 'Uzman', tone: 'rose' },
];

export function difficultyLabel(d) { return DIFFICULTY_LABELS.find((l) => d <= l.max); }
export function levelLabel(n) { return difficultyLabel(difficultyOf(n)); }

export function isBoss(n) { return n % BOSS_EVERY === 0; }

// Renk paletleri: her bölüm bir palet ve bir desen yönü seçer → tahta renkli bir desene dönüşür
// Tam doygun gökkuşağı renkleri (kırmızı, pembe, turuncu, sarı, yeşil, mor, mavi).
// Her bölüm aynı canlı seti farklı sırada ve desende kullanır.
const VIVID = ['#FF0000', '#F505B4', '#FF9A00', '#F2E600', '#00F21A', '#7300FF', '#0000FF'];
const rotate = (k) => VIVID.slice(k).concat(VIVID.slice(0, k));
export const PALETTES = VIVID.map((_, k) => ({ name: `Canlı ${k + 1}`, colors: rotate(k) }));
export const PATTERNS = ['vertical', 'horizontal', 'radial', 'diagonal', 'angular'];

const SIMPLE_SHAPES = ['square', 'circle', 'diamond', 'heart', 'hexagon', 'cross'];

const shapeMemo = [];
/** Bölüm şekli: deterministik, art arda iki bölüm asla aynı şekli almaz. */
function shapeFor(n) {
  if (n <= 6) return 'square';
  for (let k = shapeMemo.length || 7; k <= n; k++) {
    if (shapeMemo[k]) continue;
    const w = Math.round(8 + difficultyOf(k) * 18);
    const pool = (w < 11 ? SIMPLE_SHAPES : SHAPE_NAMES).filter((x) => x !== (shapeMemo[k - 1] || 'square'));
    shapeMemo[k] = pool[Math.floor(createRng(hashString(`shape-${k}`)).next() * pool.length)];
  }
  return shapeMemo[n];
}

export function paramsFor(n, d = difficultyOf(n)) {
  const w = Math.round(8 + d * 18);
  const shape = shapeFor(n);
  const h = Math.min(30, Math.round(w * shapeAspect(shape)));
  const r2 = createRng(hashString(`params-${n}`));
  return {
    shape,
    params: {
      w, h,
      mask: shapeMask(shape, w, h),
      density: Math.min(0.97, 0.72 + d * 0.25),
      blockBias: 0.35 + d * 0.62,
      minLen: d > 0.3 ? 3 : 2,
      maxLen: 4 + Math.round(d * 16),
      straight: 0.62 - d * 0.32,
      // -1 (dalga başı: sade tahta seç) … +1 (dalga sonu: en düğümlü tahtayı seç)
      hardness: n <= 3 ? 0 : (((n - 1) % WAVE) - 4.5) / 4.5,
      attempts: 4,
    },
    palette: Math.floor(r2.next() * PALETTES.length),
    pattern: PATTERNS[Math.floor(r2.next() * PATTERNS.length)],
  };
}

const cache = new Map();
function remember(key, level) {
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  cache.set(key, level);
  return level;
}

function safeGenerate(params, seed) {
  let p = params;
  for (let i = 0; i < 6; i++) {
    const res = generate(p, (seed + i * 104729) >>> 0);
    if (res && res.level.n >= 3) return res;
    p = { ...p, density: p.density * 0.92, mask: i >= 3 ? null : p.mask };
  }
  throw new Error('Bölüm üretilemedi');
}

/** Bölüm n (1…500). Deterministik: her cihazda aynı bölüm. */
export function getLevel(n) {
  n = Math.max(1, Math.min(MAX_LEVEL, n | 0));
  if (cache.has(n)) return cache.get(n);
  const d = difficultyOf(n);
  const hand = HANDCRAFTED[n];
  let level, shape = 'square', palette, pattern;
  if (hand) {
    level = compileLevel(parseHandcrafted(hand));
    palette = (n - 1) % PALETTES.length; pattern = 'diagonal';
  } else {
    const cfg = paramsFor(n, d);
    const res = safeGenerate(cfg.params, hashString(`vekto2-level-${n}`));
    level = res.level; shape = cfg.shape; palette = cfg.palette; pattern = cfg.pattern;
  }
  level.meta = {
    n, kind: 'level', shape, shapeName: shapeLabel(shape), boss: isBoss(n), difficulty: d,
    label: difficultyLabel(d), palette, pattern, tutorial: hand?.tutorial || null,
    metrics: measure(level, createState(level)),
  };
  return remember(n, level);
}

/** Günlük bulmaca: tarih anahtarından (YYYY-MM-DD) deterministik. */
export function getDaily(dateKey) {
  const ck = `daily-${dateKey}`;
  if (cache.has(ck)) return cache.get(ck);
  const seed = hashString(`vekto2-daily-${dateKey}`);
  const rng = createRng(seed);
  const shape = rng.pick(['heart', 'star', 'flower', 'butterfly', 'cat', 'apple', 'clover', 'moon', 'tree']);
  const d = 0.55;
  const w = 18, h = Math.min(30, Math.round(w * shapeAspect(shape)));
  const res = safeGenerate({
    w, h, mask: shapeMask(shape, w, h), density: 0.82, blockBias: 0.9, minLen: 2, maxLen: 8, straight: 0.55, attempts: 3,
  }, seed);
  const level = res.level;
  level.meta = {
    n: 0, kind: 'daily', dateKey, shape, shapeName: shapeLabel(shape), boss: false, difficulty: d,
    label: difficultyLabel(d), palette: Math.floor(rng.next() * PALETTES.length), pattern: rng.pick(PATTERNS),
    tutorial: 'daily', metrics: res.metrics,
  };
  return remember(ck, level);
}

export function chapterOf(n) { return Math.floor((n - 1) / CHAPTER_SIZE); }
export const CHAPTER_NAMES = [
  'İlk adımlar', 'Kıvrımlar', 'Desenler', 'Düğümler', 'Labirent', 'Akıntı', 'Örgü', 'Yaprak', 'Yıldız tozu', 'Kum saati',
  'Mozaik', 'Rüzgâr', 'Dalga', 'Kristal', 'Gece yarısı', 'Kehribar', 'Zirve', 'Pusula', 'Usta işi', 'Son çizgi',
];
export function chapterName(n) { return CHAPTER_NAMES[chapterOf(n)] || ''; }
