// Oyuncu ilerlemesi, ekonomi ve ödüller. Saf fonksiyonlar: kayıt nesnesini günceller,
// arayüze gösterilecek bir özet döndürür. (Testlerde tarayıcısız çalışır.)

import { evaluateAchievements } from './js-systems-achievements.js';
import { THEMES } from './js-systems-themes.js';
import { addDays, trustedToday } from './js-systems-calendar.js';

// Ekonomi yok: yalnızca ipucu hakkı. Her gün girişte 1, haftanın 7 günü üst üste girene 7. gün 3.
export const LOGIN_REWARDS = [
  { hints: 1 }, { hints: 1 }, { hints: 1 }, { hints: 1 }, { hints: 1 }, { hints: 1 }, { hints: 3 },
];
export const MILESTONE_EVERY = 25;

export function xpForNext(level) { return 60 + (level - 1) * 20; }

export function playerLevel(xp) {
  let level = 1, rest = xp;
  while (rest >= xpForNext(level)) { rest -= xpForNext(level); level++; }
  return { level, into: rest, need: xpForNext(level) };
}

export function totalStars(save) {
  let s = 0;
  for (const k in save.levels) s += save.levels[k].s || 0;
  return s;
}

/** Bölüm kazanıldığında çağrılır. */
export function recordLevelWin(save, { n, stars, mistakes, ms, hints, boss, now = new Date() }) {
  const prev = save.levels[n];
  const first = !prev;
  const sum = { first, hints: 0, xp: 0, stars, prevStars: prev?.s || 0, milestone: null, themes: [], achievements: [], levelUp: null };
  const before = playerLevel(save.xp).level;

  if (first) {
    sum.xp = 10 + stars * 5 + (boss ? 30 : 0);
    save.stats.cleared++;
    if (boss) save.stats.bossCleared++;
  } else {
    sum.xp = 3;
  }
  save.levels[n] = {
    s: Math.max(prev?.s || 0, stars),
    m: Math.min(prev?.m ?? Infinity, mistakes),
    t: Math.min(prev?.t ?? Infinity, ms),
  };
  if (save.level <= n) save.level = n + 1;

  if (mistakes === 0 && first) save.stats.perfect++;
  save.stats.mistakes += mistakes;
  save.stats.playMs += ms;
  if (hints === 0) { save.stats.noHintRun++; save.stats.bestNoHintRun = Math.max(save.stats.bestNoHintRun, save.stats.noHintRun); }
  else save.stats.noHintRun = 0;
  save.stats.stars = totalStars(save);

  const today = trustedToday(save, now);
  save.days[today] = (save.days[today] || 0) + 1;
  pruneDays(save, today);

  // Kilometre taşı: her 25 bölümde bir
  if (first && n % MILESTONE_EVERY === 0 && !save.milestones[`m${n}`]) {
    save.milestones[`m${n}`] = true;
    sum.milestone = { n, hints: 1 };
    sum.hints = 1;
    save.hints += 1;
  }
  save.xp += sum.xp;
  sum.themes = unlockThemes(save);
  const after = playerLevel(save.xp).level;
  if (after > before) sum.levelUp = { from: before, to: after };
  sum.achievements = evaluateAchievements(save, { playerLevel: after });
  sum.themes.push(...unlockThemes(save)); // başarımla açılan tema olabilir
  return sum;
}

export function recordDailyWin(save, { dateKey, stars, ms, now = new Date() }) {
  const today = trustedToday(save, now);
  const sum = { xp: 0, first: !save.daily.done[dateKey], streak: save.daily.streak, hints: 0, achievements: [], themes: [], levelUp: null };
  if (!sum.first || dateKey !== today) {
    // Geçmiş/tekrar: ödül yok, yalnızca en iyi yıldız güncellenir
    save.daily.done[dateKey] = Math.max(save.daily.done[dateKey] || 0, stars);
    return sum;
  }
  const before = playerLevel(save.xp).level;
  save.daily.done[dateKey] = stars;
  save.daily.streak = save.daily.last === addDays(today, -1) ? save.daily.streak + 1 : 1;
  save.daily.best = Math.max(save.daily.best, save.daily.streak);
  save.daily.last = today;
  save.stats.dailyDone++;
  save.stats.playMs += ms;
  sum.streak = save.daily.streak;
  sum.xp = 25;
  save.xp += sum.xp;
  save.days[today] = (save.days[today] || 0) + 1;
  const after = playerLevel(save.xp).level;
  if (after > before) sum.levelUp = { from: before, to: after };
  sum.achievements = evaluateAchievements(save, { playerLevel: after });
  sum.themes = unlockThemes(save);
  return sum;
}

/** Günlük giriş ödülü. Aynı gün ikinci kez verilmez; saat geri alınırsa verilmez. */
export function checkLoginReward(save, now = new Date()) {
  const today = trustedToday(save, now);
  if (save.login.maxDay < today) save.login.maxDay = today;
  if (save.login.last === today) return null;
  const streak = save.login.last === addDays(today, -1) ? save.login.streak + 1 : 1;
  const reward = LOGIN_REWARDS[(streak - 1) % LOGIN_REWARDS.length];
  return { day: today, streak, reward, index: (streak - 1) % LOGIN_REWARDS.length };
}

export function claimLoginReward(save, offer) {
  if (!offer || save.login.last === offer.day) return false;
  save.login.last = offer.day;
  save.login.streak = offer.streak;
  save.login.total++;
  save.hints += offer.reward.hints || 0;
  return true;
}

/** İpucu hakkı harcar. Hak yoksa null. */
export function spendHint(save) {
  if (save.hints > 0) { save.hints--; save.stats.hintsUsed++; return 'token'; }
  return null;
}

export function canAffordHint(save) { return save.hints > 0; }

export function unlockThemes(save) {
  const out = [];
  if (!save.themes.owned.includes('pattern')) save.themes.owned.unshift('pattern');
  for (const t of THEMES) {
    if (!t.unlock || save.themes.owned.includes(t.id)) continue;
    const ok = t.unlock.type === 'level' ? save.stats.cleared >= t.unlock.value
      : t.unlock.type === 'achievement' ? !!save.achievements[t.unlock.value] : false;
    if (ok) { save.themes.owned.push(t.id); out.push(t); }
  }
  return out;
}

function pruneDays(save, today) {
  const keys = Object.keys(save.days);
  if (keys.length <= 60) return;
  keys.sort();
  for (const k of keys.slice(0, keys.length - 60)) if (k !== today) delete save.days[k];
}
