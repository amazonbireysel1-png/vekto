// Bölüm kataloğu: 700 seviye, 7'lik dalgalar halinde.
// Her dalga: 2 Kolay → 3 Orta → 1 Zor → 1 Ultra zor, sonra yeniden Kolay.
// Dalgalar ilerledikçe aynı etiketteki seviyeler de büyür ve zorlaşır.
// Zor ve Ultra zor tahtalar ekrandan uzundur: oyuncu tahtayı aşağı yukarı kaydırarak oynar.

import { hashString, createRng } from './js-core-rng.js';
import { compileLevel, createState } from './js-core-rules.js';
import { generateWoven as generate } from './js-core-generator.js';
import { shapeMask, shapeLabel, shapeAspect, EASY_POOL, MEDIUM_POOL, TALL_POOL } from './js-core-shapes.js';
import { HANDCRAFTED, parseHandcrafted } from './js-core-handcrafted.js';
import { measure } from './js-core-solver.js';

export const MAX_LEVEL = 700;
export const WAVE = 7;
export const CHAPTER_SIZE = 25;

export const LABELS = {
  easy: { name: 'Kolay', tone: 'mint', key: 'easy' },
  medium: { name: 'Orta', tone: 'blue', key: 'medium' },
  hard: { name: 'Zor', tone: 'sand', key: 'hard' },
  ultra: { name: 'Ultra zor', tone: 'rose', key: 'ultra' },
};
const WAVE_KINDS = ['easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'ultra'];
const KIND_D = { easy: 0.12, medium: 0.4, hard: 0.72, ultra: 0.95 };

export const kindOf = (n) => WAVE_KINDS[(n - 1) % WAVE];
const cycleT = (n) => Math.min(1, Math.floor((n - 1) / WAVE) / (MAX_LEVEL / WAVE - 1));

/** 0 (kolay) … 1 (ultra zor). Dalga içindeki yer + dalganın ilerleyişi. */
export function difficultyOf(n) {
  if (n <= 2) return 0.04 * n;
  return Math.min(1, KIND_D[kindOf(n)] + cycleT(n) * 0.05 + ((n - 1) % WAVE === 4 ? 0.04 : 0));
}

export const DIFFICULTY_LABELS = [
  { max: 0.25, ...LABELS.easy },
  { max: 0.6, ...LABELS.medium },
  { max: 0.85, ...LABELS.hard },
  { max: 2, ...LABELS.ultra },
];
export function difficultyLabel(d) { return DIFFICULTY_LABELS.find((l) => d <= l.max); }
export function levelLabel(n) { return LABELS[kindOf(n)]; }

/** Ultra zor seviyeler "usta" sayılır (başarımlar, istatistik). */
export function isBoss(n) { return kindOf(n) === 'ultra'; }
export function isScrollLevel(n) { const k = kindOf(n); return k === 'hard' || k === 'ultra'; }

// Renk paletleri: her bölüm bir palet ve bir desen yönü seçer → tahta renkli bir desene dönüşür
// Tam doygun gökkuşağı renkleri (kırmızı, pembe, turuncu, sarı, yeşil, mor, mavi).
// Her bölüm aynı canlı seti farklı sırada ve desende kullanır.
const VIVID = ['#FF0000', '#F505B4', '#FF9A00', '#F2E600', '#00F21A', '#7300FF', '#0000FF'];
const rotate = (k) => VIVID.slice(k).concat(VIVID.slice(0, k));
export const PALETTES = VIVID.map((_, k) => ({ name: `Canlı ${k + 1}`, colors: rotate(k) }));
export const PATTERNS = ['vertical', 'horizontal', 'radial', 'diagonal', 'angular'];

const PER_WAVE = { easy: 2, medium: 3 };
const permMemo = new Map();
/** Havuzun deterministik karışık sırası; iki tur arasında art arda tekrar olmaz. */
function permutation(name, pool, p) {
  const key = `${name}-${p}`;
  if (permMemo.has(key)) return permMemo.get(key);
  const rng = createRng(hashString(`shape-perm-${name}-${p}`));
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  if (p > 0) { const prev = permutation(name, pool, p - 1); if (arr[0] === prev[prev.length - 1]) [arr[0], arr[1]] = [arr[1], arr[0]]; }
  permMemo.set(key, arr);
  return arr;
}
function pick(name, pool, idx) { return permutation(name, pool, Math.floor(idx / pool.length))[idx % pool.length]; }

/** Seviye şekli: her tür kendi havuzunda dolaşır; havuz bitmeden aynı şekil tekrar etmez. */
function shapeFor(n) {
  if (n <= 3) return 'square';
  const wave = Math.floor((n - 1) / WAVE), pos = (n - 1) % WAVE;
  if (pos < 2) return pick('easy', EASY_POOL, wave * 2 + pos);
  if (pos < 5) return pick('medium', MEDIUM_POOL, wave * 3 + pos - 2);
  return pick('tall', TALL_POOL, wave * 2 + pos - 5);
}

export function paramsFor(n) {
  const kind = kindOf(n), t = cycleT(n), pos = (n - 1) % WAVE;
  const shape = shapeFor(n);
  let w, h, density, blockBias, maxLen, straight, hardness, deepen = 0;
  if (kind === 'easy') {
    w = 8 + Math.round(t * 4) + pos; h = Math.round(w * shapeAspect(shape));
    density = 0.78; blockBias = 0.4 + t * 0.25; maxLen = 4 + Math.round(t * 4); straight = 0.6; hardness = -1;
  } else if (kind === 'medium') {
    w = 13 + Math.round(t * 4) + (pos - 2); h = Math.min(27, Math.round(w * shapeAspect(shape)));
    density = 0.88; blockBias = 0.7 + t * 0.25; maxLen = 7 + Math.round(t * 7); straight = 0.45; hardness = 0.5; deepen = 1500;
  } else if (kind === 'hard') {
    // Ekrana ne enine ne boyuna sığar: sağa sola ve aşağı yukarı kaydırılır
    w = 25 + Math.round(t * 5); h = Math.round(w * (1.75 + t * 0.2));
    density = 0.93; blockBias = 0.9 + t * 0.1; maxLen = 11 + Math.round(t * 7); straight = 0.36; hardness = 0.9; deepen = 3500;
  } else {
    w = 30 + Math.round(t * 6); h = Math.min(76, Math.round(w * (1.9 + t * 0.2)));
    density = 0.96; blockBias = 1; maxLen = 15 + Math.round(t * 7); straight = 0.3; hardness = 1; deepen = 5000;
  }
  const r2 = createRng(hashString(`params-${n}`));
  return {
    shape, kind,
    params: {
      w, h, mask: shapeMask(shape, w, h), density, blockBias,
      minLen: kind === 'easy' ? 2 : 3, maxLen, straight, hardness, deepen, attempts: kind === 'ultra' ? 3 : 4,
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

/** Seviye n (1…700). Deterministik: her cihazda aynı seviye. */
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
    const cfg = paramsFor(n);
    const res = safeGenerate(cfg.params, hashString(`vekto2-level-${n}`));
    level = res.level; shape = cfg.shape; palette = cfg.palette; pattern = cfg.pattern;
  }
  level.meta = {
    n, kind: 'level', shape, shapeName: shapeLabel(shape), boss: isBoss(n), difficulty: d,
    label: levelLabel(n), scroll: isScrollLevel(n), palette, pattern, tutorial: hand?.tutorial || null,
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
  const shape = rng.pick(['heart', 'star', 'flower', 'butterfly', 'cat', 'apple', 'clover', 'moon', 'pine']);
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
  'Mozaik', 'Rüzgâr', 'Dalga', 'Kristal', 'Gece yarısı', 'Kehribar', 'Zirve', 'Pusula', 'Usta işi', 'Fırtına',
  'Çağlayan', 'Kutup', 'Vadi', 'Yanardağ', 'Takımada', 'Galaksi', 'Efsane', 'Son çizgi',
];
export function chapterName(n) { return CHAPTER_NAMES[chapterOf(n)] || ''; }
