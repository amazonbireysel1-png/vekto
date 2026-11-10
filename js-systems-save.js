// Kalıcı kayıt. Tek bir JSON belge + yedek kopya. Bozuk kayıt yedekten kurtarılır;
// yeni alanlar varsayılanlarla birleştirilerek sürüm geçişi otomatik yapılır.

const KEY = 'vekto.save.v2';
const BAK = 'vekto.save.v2.bak';
export const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    createdAt: Date.now(),
    level: 1,                 // oynanacak sıradaki bölüm (açılmış en yüksek)
    levels: {},               // n → { s: yıldız, m: en az hata, t: en iyi süre(ms) }
    hints: 3,
    points: 0,                // çıkarılan her ok 1 puan (lig puanı)
    pointsTotal: 0,
    league: { uid: '', name: '', idToken: '', refreshToken: '', exp: 0, synced: -1, asked: 0 },                 // ücretsiz ipucu hakkı (önce bunlar harcanır)
    xp: 0,
    stats: {
      cleared: 0, stars: 0, perfect: 0, hintsUsed: 0, mistakes: 0, playMs: 0,
      noHintRun: 0, bestNoHintRun: 0, bossCleared: 0, dailyDone: 0, undos: 0,
    },
    daily: { done: {}, streak: 0, best: 0, last: '' },
    login: { last: '', streak: 0, maxDay: '', total: 0 },
    days: {},                 // YYYY-MM-DD → o gün tamamlanan bölüm sayısı
    achievements: {},         // id → zaman damgası
    milestones: {},           // id → true
    themes: { owned: ['pattern'], active: 'pattern' },
    settings: { sound: true, music: false, haptics: true, reducedMotion: false },
    tutorials: {},
    ads: { lastInterstitial: 0, levelsSince: 0 },
  };
}

function mergeDefaults(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def;
  if (def && typeof def === 'object') {
    const out = { ...def };
    if (val && typeof val === 'object') {
      for (const k of Object.keys(val)) out[k] = k in def ? mergeDefaults(def[k], val[k]) : val[k];
    }
    return out;
  }
  return val === undefined || val === null || typeof val !== typeof def ? def : val;
}

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

export class SaveStore {
  constructor() {
    this.data = this.load();
    this.timer = 0;
    this.listeners = new Set();
  }

  load() {
    for (const k of [KEY, BAK]) {
      const raw = safeGet(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.v) return mergeDefaults(defaultSave(), parsed);
      } catch { /* bozuk — bir sonrakini dene */ }
    }
    return defaultSave();
  }

  /** Değişiklikten sonra çağrılır: kısa gecikmeyle diske yazar. */
  touch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
    for (const fn of this.listeners) fn(this.data);
  }

  flush() {
    clearTimeout(this.timer);
    const json = JSON.stringify(this.data);
    const prev = safeGet(KEY);
    if (prev) safeSet(BAK, prev);
    safeSet(KEY, json);
  }

  reset() {
    this.data = defaultSave();
    this.flush();
    for (const fn of this.listeners) fn(this.data);
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}
