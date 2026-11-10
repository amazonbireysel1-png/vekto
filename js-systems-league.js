// Global lig: çıkarılan her ok 1 puan. Puanlar cihazda toplanır, internet varken
// Firebase (Firestore REST + anonim kimlik) üzerine gönderilir. SDK yok; yalnızca fetch.

import { FIREBASE } from './js-config.js';

const DB = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;
const KEY = () => FIREBASE.apiKey;
export const leagueReady = () => !!(FIREBASE.apiKey && FIREBASE.projectId);

export const NAME_MIN = 3, NAME_MAX = 16;
const NAME_RE = /^[\p{L}\p{N}_.]+$/u;

/** Takma ad kontrolü; hata metni ya da null döner. */
export function nameProblem(name) {
  const n = (name || '').trim();
  if (n.length < NAME_MIN) return `En az ${NAME_MIN} karakter olmalı.`;
  if (n.length > NAME_MAX) return `En fazla ${NAME_MAX} karakter olabilir.`;
  if (!NAME_RE.test(n)) return 'Yalnızca harf, rakam, alt çizgi ve nokta kullanılabilir.';
  return null;
}

/** Ad benzersizliği için büyük/küçük harf ve Türkçe karakter farkını yok sayan anahtar. */
export function nameKey(name) {
  return name.trim()
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
}

/** Lig kademeleri: toplam puana göre. Her kademenin alt sınırı `min`. */
export const TIERS = [
  { id: 'b1', name: 'Bronz 1', min: 0, tone: 'bronze' },
  { id: 'b2', name: 'Bronz 2', min: 150, tone: 'bronze' },
  { id: 'b3', name: 'Bronz 3', min: 400, tone: 'bronze' },
  { id: 's1', name: 'Gümüş 1', min: 800, tone: 'silver' },
  { id: 's2', name: 'Gümüş 2', min: 1400, tone: 'silver' },
  { id: 's3', name: 'Gümüş 3', min: 2200, tone: 'silver' },
  { id: 'g1', name: 'Altın 1', min: 3300, tone: 'gold' },
  { id: 'g2', name: 'Altın 2', min: 4800, tone: 'gold' },
  { id: 'g3', name: 'Altın 3', min: 6800, tone: 'gold' },
  { id: 'p1', name: 'Platin 1', min: 9500, tone: 'platinum' },
  { id: 'p2', name: 'Platin 2', min: 13000, tone: 'platinum' },
  { id: 'p3', name: 'Platin 3', min: 17500, tone: 'platinum' },
  { id: 'd1', name: 'Elmas 1', min: 23000, tone: 'diamond' },
  { id: 'd2', name: 'Elmas 2', min: 30000, tone: 'diamond' },
  { id: 'd3', name: 'Elmas 3', min: 38000, tone: 'diamond' },
  { id: 'm', name: 'Usta', min: 48000, tone: 'master' },
];

/** Puana göre kademe, sıradaki kademe ve ilerleme (0–1). */
export function tierOf(points) {
  const p = Math.max(0, points || 0);
  let i = 0;
  while (i + 1 < TIERS.length && p >= TIERS[i + 1].min) i++;
  const cur = TIERS[i], next = TIERS[i + 1] || null;
  return { ...cur, index: i, next, progress: next ? (p - cur.min) / (next.min - cur.min) : 1, toNext: next ? next.min - p : 0 };
}

/** Puan ekler (yerel). Gönderim ayrıca, gecikmeli yapılır. */
export function addPoints(save, k = 1) {
  save.points = Math.max(0, (save.points || 0) + k);
  save.pointsTotal = Math.max(save.pointsTotal || 0, save.points);
}

async function post(url, body, token, form) {
  const headers = { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: form ? body : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data?.error?.message || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}

export class League {
  constructor(app) {
    this.app = app;
    this.pushTimer = 0;
    this.cache = null; // { at, rows }
  }

  get acc() { return this.app.save.data.league; }
  get joined() { return !!(this.acc.uid && this.acc.name); }

  async token() {
    const a = this.acc;
    if (a.idToken && a.exp > Date.now() + 60_000) return a.idToken;
    if (a.refreshToken) {
      const r = await post(`https://securetoken.googleapis.com/v1/token?key=${KEY()}`,
        `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.refreshToken)}`, null, true);
      Object.assign(a, { idToken: r.id_token, refreshToken: r.refresh_token, uid: r.user_id, exp: Date.now() + Number(r.expires_in) * 1000 });
    } else {
      const r = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY()}`, { returnSecureToken: true });
      Object.assign(a, { idToken: r.idToken, refreshToken: r.refreshToken, uid: r.localId, exp: Date.now() + Number(r.expiresIn) * 1000 });
    }
    this.app.save.touch();
    return a.idToken;
  }

  /** Takma adı alır ve lige katılır. Ad alınmışsa 'taken' hatası fırlatır. */
  async join(name) {
    name = name.trim();
    const tok = await this.token();
    const uid = this.acc.uid, key = nameKey(name);
    const score = this.app.save.data.points || 0;
    try {
      await post(`${DB()}:commit`, {
        writes: [
          { update: { name: `projects/${FIREBASE.projectId}/databases/(default)/documents/names/${encodeURIComponent(key)}`, fields: { uid: { stringValue: uid }, name: { stringValue: name } } }, currentDocument: { exists: false } },
          { update: { name: `projects/${FIREBASE.projectId}/databases/(default)/documents/players/${uid}`, fields: { name: { stringValue: name }, key: { stringValue: key }, score: { integerValue: String(score) } } }, currentDocument: { exists: false } },
        ],
      }, tok);
    } catch (e) {
      if (e.status === 409 || /ALREADY_EXISTS|FAILED_PRECONDITION/.test(e.message)) {
        // Bu cihazın oyuncusu zaten varsa (ör. kayıt silinip geri geldiyse) adı kontrol et
        const mine = await this.fetchPlayer(uid).catch(() => null);
        if (mine) { Object.assign(this.acc, { name: mine.name, synced: mine.score }); this.app.save.touch(); return mine.name; }
        const err = new Error('taken'); err.code = 'taken'; throw err;
      }
      throw e;
    }
    Object.assign(this.acc, { name, synced: score });
    this.app.save.touch();
    return name;
  }

  async fetchPlayer(uid) {
    const res = await fetch(`${DB()}/players/${uid}`);
    if (!res.ok) return null;
    const d = await res.json();
    return { name: d.fields?.name?.stringValue, score: Number(d.fields?.score?.integerValue || 0) };
  }

  /** Puanı birkaç saniye sonra sunucuya gönderir (art arda çağrılar birleşir). */
  schedulePush(delay = 2500) {
    if (!leagueReady() || !this.joined) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push().catch(() => {}), delay);
  }

  async push() {
    if (!leagueReady() || !this.joined) return;
    const score = this.app.save.data.points || 0;
    if (score === this.acc.synced) return;
    const tok = await this.token();
    await fetch(`${DB()}/players/${this.acc.uid}?updateMask.fieldPaths=score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ fields: { score: { integerValue: String(score) } } }),
    }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); });
    this.acc.synced = score;
    this.cache = null;
    this.app.save.touch();
  }

  /** En yüksek puanlılar + oyuncunun kendi sırası. */
  async standings(limit = 100) {
    await this.push().catch(() => {});
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.data;
    const rows = await post(`${DB()}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: 'players' }],
        orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
        limit,
      },
    });
    const list = rows.filter((r) => r.document).map((r) => ({
      uid: r.document.name.split('/').pop(),
      name: r.document.fields?.name?.stringValue || '?',
      score: Number(r.document.fields?.score?.integerValue || 0),
    }));
    let myRank = null, total = null;
    if (this.joined) {
      const me = list.findIndex((p) => p.uid === this.acc.uid);
      if (me >= 0) myRank = me + 1;
      else {
        const agg = await post(`${DB()}:runAggregationQuery`, {
          structuredAggregationQuery: {
            structuredQuery: { from: [{ collectionId: 'players' }], where: { fieldFilter: { field: { fieldPath: 'score' }, op: 'GREATER_THAN', value: { integerValue: String(this.app.save.data.points || 0) } } } },
            aggregations: [{ alias: 'c', count: {} }],
          },
        });
        myRank = Number(agg[0]?.result?.aggregateFields?.c?.integerValue || 0) + 1;
      }
    }
    try {
      const agg = await post(`${DB()}:runAggregationQuery`, {
        structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'players' }] }, aggregations: [{ alias: 'c', count: {} }] },
      });
      total = Number(agg[0]?.result?.aggregateFields?.c?.integerValue || 0);
    } catch { /* toplam isteğe bağlı */ }
    const data = { list, myRank, total };
    this.cache = { at: Date.now(), data };
    return data;
  }
}
