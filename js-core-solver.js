// Çözüm doğrulayıcı ve ipucu motoru.
//
// Önemli özellik: kurallar "monotondur" — bir okun çıkması başka hiçbir okun
// yolunu kapatmaz. Bu yüzden hareket edebilen herhangi bir birimi çıkarmak asla
// çıkmaza götürmez ve açgözlü (greedy) çözücü TAM ve DOĞRUdur:
// tahta açgözlü yöntemle temizlenemiyorsa hiçbir sırayla temizlenemez.

import { cloneState, movableUnits, applyUnit } from './js-core-rules.js';

/**
 * Bölümü katman katman çözer.
 * rounds: her turda o an serbest olan tüm birimlerin çıktığı varsayılan "derinlik".
 * Derinlik ne kadar büyükse oyuncunun o kadar ileriyi düşünmesi gerekir.
 */
export function solve(level, state) {
  const s = cloneState(state);
  const order = [];
  const freePerRound = [];
  let rounds = 0;
  while (s.aliveCount > 0) {
    const free = movableUnits(level, s);
    if (!free.length) return { solvable: false, order, rounds, freePerRound, stuck: s.aliveCount };
    rounds++;
    freePerRound.push(free.length);
    for (const u of free) { applyUnit(level, s, u); order.push(u); }
  }
  return { solvable: true, order, rounds, freePerRound, stuck: 0 };
}

/** Zorluk ölçütleri — üretici ve testler kullanır. */
export function measure(level, state) {
  const r = solve(level, state);
  const units = level.units;
  const avgFree = r.freePerRound.length
    ? r.freePerRound.reduce((a, b) => a + b, 0) / r.freePerRound.length : 0;
  const initialFree = r.freePerRound[0] || 0;
  // Zorluk puanı: derinlik (kaç tur ileriyi düşünmek gerekir) + darlık (az seçenek) + boyut
  const score = r.rounds * 0.8 + (units / Math.max(1, avgFree)) * 0.45 + units * 0.03;
  return { ...r, units, avgFree, initialFree, score: Math.round(score * 10) / 10 };
}

/**
 * İpucu: o an çıkarılabilecek en "öğretici" birimi seçer — çıkınca en çok yeni
 * parçayı serbest bırakan. İkinci kademe için bir sonraki adımı da döndürür.
 */
export function findHint(level, state) {
  const free = movableUnits(level, state);
  if (!free.length) return null;
  const before = new Set(free.map((u) => u[0]));
  let best = null;
  for (const u of free) {
    const s = cloneState(state);
    applyUnit(level, s, u);
    const after = movableUnits(level, s);
    const newly = after.filter((v) => !before.has(v[0]));
    const gain = newly.length;
    // Eşitlikte tahtanın üst/sol tarafını tercih ederek kararlı sonuç ver
    if (!best || gain > best.gain || (gain === best.gain && u[0] < best.unit[0])) {
      best = { unit: u, gain, next: newly[0] || after[0] || null };
    }
  }
  return best;
}
