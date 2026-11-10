// Bölüm kataloğu: 700 seviye, 7'lik dalgalar halinde.
// Her dalga: 2 Kolay → 3 Orta → 1 Zor → 1 Ultra zor, sonra yeniden Kolay.
// Dalgalar ilerledikçe aynı etiketteki seviyeler de büyür ve zorlaşır.
// Zor ve Ultra zor tahtalar ekrandan uzundur: oyuncu tahtayı aşağı yukarı kaydırarak oynar.

import { hashString, createRng } from './js-core-rng.js';
import { compileLevel, createState } from './js-core-rules.js';
import { generateWoven as generate } from './js-core-generator.js';
import { shapeMask, shapeLabel, shapeAspect, SHAPE_NAMES, TALL_SHAPES } from './js-core-shapes.js';
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

const SIMPLE_SHAPES = ['square', 'circle', 'diamond', 'heart', 'hexagon', 'cross'];

const shapeMemo = [];
/** Seviye şekli: deterministik; art arda iki seviye asla aynı şekli almaz. */
function shapeFor(n) {
  if (n <= 3) return 'square';
  for (let k = shapeMemo.length || 4; k <= n; k++) {
    if (shapeMemo[k]) continue;
    const kind = kindOf(k);
    const base = kind === 'easy' ? SIMPLE_SHAPES : kind === 'medium' ? SHAPE_NAMES : TALL_SHAPES;
    const pool = base.filter((x) => x !== shapeMemo[k - 1]);
    shapeMemo[k] = pool[Math.floor(createRng(hashString(`shape-${k}`)).next() * pool.length)];
  }
  return shapeMemo[n];
}

export function paramsFor(n) {
  const kind = kindOf(n), t = cycleT(n), pos = (n - 1) % WAVE;
  const shape = shapeFor(n);
  let w, h, density, blockBias, maxLen, straight, hardness;
  if (kind === 'easy') {
    w = 7 + Math.round(t * 4) + pos; h = Math.round(w * shapeAspect(shape));
    density = 0.78; blockBias = 0.4 + t * 0.25; maxLen = 4 + Math.round(t * 4); straight = 0.6; hardness = -1;
  } else if (kind === 'medium') {
    w = 10 + Math.round(t * 4) + (pos - 2); h = Math.min(22, Math.round(w * shapeAspect(shape)));
    density = 0.86; blockBias = 0.6 + t * 0.25; maxLen = 6 + Math.round(t * 6); straight = 0.5; hardness = 0;
  } else if (kind === 'hard') {
    w = 13 + Math.round(t * 3); h = Math.round(w * (2.35 + t * 0.3));
    density = 0.93; blockBias = 0.85 + t * 0.1; maxLen = 10 + Math.round(t * 6); straight = 0.4; hardness = 0.7;
  } else {
    w = 15 + Math.round(t * 3); h = Math.min(52, Math.round(w * (2.7 + t * 0.3)));
    density = 0.96; blockBias = 0.95; maxLen = 14 + Math.round(t * 6); straight = 0.32; hardness = 1;
  }
  const r2 = createRng(hashString(`params-${n}`));
  return {
    shape, kind,
    params: {
      w, h, mask: shapeMask(shape, w, h), density, blockBias,
      minLen: kind === 'easy' ? 2 : 3, maxLen, straight, hardness, attempts: kind === 'ultra' ? 3 : 4,
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
  'Mozaik', 'Rüzgâr', 'Dalga', 'Kristal', 'Gece yarısı', 'Kehribar', 'Zirve', 'Pusula', 'Usta işi', 'Fırtına',
  'Çağlayan', 'Kutup', 'Vadi', 'Yanardağ', 'Takımada', 'Galaksi', 'Efsane', 'Son çizgi',
];
export function chapterName(n) { return CHAPTER_NAMES[chapterOf(n)] || ''; }
