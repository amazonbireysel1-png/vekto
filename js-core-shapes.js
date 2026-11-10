// Tahta şekilleri: normalize koordinatlarda (u, v ∈ [-1, 1], v aşağı doğru) tanımlı
// bölgeler. Her ızgara boyutunda aynı şekli verir. Oklar yalnızca şeklin içine yerleşir.

const sq = (x) => x * x;
const polar = (u, v) => [Math.hypot(u, v), Math.atan2(v, u)];
function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const STAR = Array.from({ length: 10 }, (_, k) => {
  const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.46 : 1.04;
  return [Math.cos(a) * r, Math.sin(a) * r + 0.1];
});
const BOLT = [[0.3, -1], [-0.8, 0.18], [-0.08, 0.18], [-0.42, 1], [0.8, -0.22], [0.1, -0.22], [0.62, -1]];

export const SHAPES = {
  square: { label: 'Kare', aspect: 1, f: (u, v) => Math.max(Math.abs(u), Math.abs(v)) <= 0.98 },
  heart: {
    label: 'Kalp', aspect: 0.92,
    f: (u, v) => { const x = u * 1.22, y = -v * 1.25 + 0.15; return (sq(x * x + y * y - 1) * (x * x + y * y - 1)) - x * x * y * y * y <= 0; },
  },
  circle: { label: 'Daire', aspect: 1, f: (u, v) => u * u + v * v <= 0.98 },
  diamond: { label: 'Elmas', aspect: 1.15, f: (u, v) => Math.abs(u) + Math.abs(v) <= 1.04 },
  star: { label: 'Yıldız', aspect: 1, f: (u, v) => inPoly(STAR, u, v) },
  flower: {
    label: 'Çiçek', aspect: 1,
    f: (u, v) => { const [r, t] = polar(u, v); return r <= 0.5 + 0.48 * Math.pow(Math.abs(Math.cos(2.5 * (t + Math.PI / 2))), 0.8); },
  },
  hexagon: {
    label: 'Altıgen', aspect: 1.05,
    f: (u, v) => { const x = Math.abs(u), y = Math.abs(v); return y <= 0.96 && 0.5 * y + 0.866 * x <= 0.95; },
  },
  ring: { label: 'Halka', aspect: 1, f: (u, v) => { const r = u * u + v * v; return r <= 0.98 && r >= 0.13; } },
  drop: {
    label: 'Damla', aspect: 1.25,
    f: (u, v) => { const y = (v + 1) / 2; const half = y < 0.62 ? Math.sin((y / 0.62) * Math.PI / 2) * 0.55 * Math.pow(y / 0.62, 0.6) : Math.sqrt(Math.max(0, 1 - sq((y - 0.62) / 0.38))) * 0.55 + 0.0; return Math.abs(u) <= half * 1.75 + (y > 0.62 ? 0 : 0); },
  },
  house: {
    label: 'Ev', aspect: 1.05,
    f: (u, v) => (v >= -0.1 && Math.abs(u) <= 0.78 && v <= 0.98) || (v < -0.1 && Math.abs(u) <= (v + 1) * 1.05),
  },
  cat: {
    label: 'Kedi', aspect: 1,
    f: (u, v) => {
      const head = u * u / 0.92 + sq(v - 0.12) / 0.74 <= 1;
      const ear = (s) => { const x = u * s; return v < -0.3 && v > -1 && x > 0.18 && x < 0.9 && (x - 0.18) / 0.72 >= (v + 1) * 0.45 - 0.05 && (0.9 - x) / 0.72 >= (v + 1) * 0.45 - 0.05; };
      return head || ear(1) || ear(-1);
    },
  },
  tree: {
    label: 'Çam', aspect: 1.2,
    f: (u, v) => {
      const y = (v + 1) / 2;
      if (y > 0.84) return Math.abs(u) <= 0.17;
      const tier = Math.min(2, Math.floor(y / 0.28)), ty = (y - tier * 0.28) / 0.28;
      return Math.abs(u) <= 0.22 + ty * (0.4 + tier * 0.2);
    },
  },
  moon: { label: 'Hilal', aspect: 1, f: (u, v) => u * u + v * v <= 0.98 && sq(u - 0.42) + sq(v + 0.18) >= 0.5 },
  butterfly: {
    label: 'Kelebek', aspect: 0.95,
    f: (u, v) => {
      const wing = (s) => sq((u * s - 0.5) / 0.55) + sq((v + 0.28) / 0.62) <= 1 || sq((u * s - 0.42) / 0.42) + sq((v - 0.5) / 0.42) <= 1;
      return wing(1) || wing(-1) || (Math.abs(u) <= 0.09 && Math.abs(v) <= 0.85);
    },
  },
  clover: {
    label: 'Yonca', aspect: 1,
    f: (u, v) => [[0, -0.52], [0.52, 0], [0, 0.52], [-0.52, 0]].some(([a, b]) => sq(u - a) + sq(v - b) <= 0.22) || (u * u + v * v <= 0.1),
  },
  shield: {
    label: 'Kalkan', aspect: 1.15,
    f: (u, v) => Math.abs(u) <= 0.9 && v >= -0.95 && (v <= 0.15 || Math.abs(u) <= 0.9 * Math.sqrt(Math.max(0, 1 - sq((v - 0.15) / 0.83)))),
  },
  cross: { label: 'Artı', aspect: 1, f: (u, v) => Math.abs(u) <= 0.4 || Math.abs(v) <= 0.4 },
  apple: {
    label: 'Elma', aspect: 1,
    f: (u, v) => {
      const body = sq(Math.abs(u) - 0.3) / 0.5 + sq(v - 0.15) / 0.68 <= 1 && v > -0.62;
      const leaf = sq(u - 0.28) / 0.05 + sq(v + 0.8) / 0.02 <= 1;
      const stem = Math.abs(u - 0.02) <= 0.06 && v <= -0.5 && v >= -0.92;
      return body || leaf || stem;
    },
  },
  bolt: { label: 'Şimşek', aspect: 1.3, f: (u, v) => inPoly(BOLT, u, v) },
  // --- Uzun (ekrana sığmayan) tahtalar için şekiller: y = v·a gerçek oranla çalışır ---
  capsule: { label: 'Kapsül', aspect: 2.2, tall: true, f: (u, v, a) => { const y = Math.abs(v * a), e = a - 0.98; return y <= e ? Math.abs(u) <= 0.98 : u * u + sq(y - e) <= 0.97; } },
  snowman: {
    label: 'Kardan adam', aspect: 2.3, tall: true,
    f: (u, v, a) => { const y = v * a; return [[-a + 0.62, 0.6], [-a + 1.9, 0.82], [a - 1.0, 0.98]].some(([c, r]) => u * u + sq(y - c) <= r * r); },
  },
  tower: {
    label: 'Kule', aspect: 2.3, tall: true,
    f: (u, v, a) => { const y = v * a + a; if (y < 0.45) return Math.abs(u) <= 0.95 && Math.floor((u + 1) * 3.5) % 2 === 0; return Math.abs(u) <= (y < 0.9 ? 0.95 : 0.78); },
  },
  wave: { label: 'Dalga', aspect: 2.3, tall: true, f: (u, v, a) => Math.abs(u - 0.38 * Math.sin(v * a * 1.6)) <= 0.62 },
  hourglass: { label: 'Kum saati', aspect: 2.2, tall: true, f: (u, v, a) => Math.abs(u) <= 0.34 + 0.66 * Math.abs(v) },
  chain: {
    label: 'Zincir', aspect: 2.4, tall: true,
    f: (u, v, a) => { const y = v * a + a, k = y - 1.05 * Math.floor(y / 1.05) - 0.525; return Math.abs(u) / 0.98 + Math.abs(k) / 0.9 <= 1 || Math.abs(u) <= 0.28; },
  },
};

export const SHAPE_NAMES = Object.keys(SHAPES).filter((k) => !SHAPES[k].tall);
export const TALL_SHAPES = Object.keys(SHAPES).filter((k) => SHAPES[k].tall).concat(['tree', 'shield', 'square']);

/** Şekil maskesi; çok küçük ızgaralarda boş çıkmasın diye en az %20 doluluk garanti edilir. */
export function shapeMask(name, w, h) {
  const sh = SHAPES[name] || SHAPES.square;
  const m = new Uint8Array(w * h);
  let count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = ((x + 0.5) / w) * 2 - 1, v = ((y + 0.5) / h) * 2 - 1;
    if (sh.f(u, v, h / w)) { m[y * w + x] = 1; count++; }
  }
  if (count < w * h * 0.2) m.fill(1);
  return m;
}

export function shapeLabel(name) { return (SHAPES[name] || SHAPES.square).label; }
export function shapeAspect(name) { return (SHAPES[name] || SHAPES.square).aspect; }
