// Tarih yardımcıları. Günlük içerik cihazın YEREL tarihine göre değişir.
// Saat geri alınarak ödül tekrar alınmasın diye görülen en ileri gün saklanır.

export function dayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key, n) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** a ile b arasındaki gün farkı (b - a). */
export function diffDays(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

/** Bugünün anahtarı; saat geriye alınmışsa görülen en ileri gün kullanılır. */
export function trustedToday(save, now = new Date()) {
  const k = dayKey(now);
  const max = save.login.maxDay;
  if (max && k < max) return max;
  return k;
}

export const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export function prettyDay(key) {
  const d = parseDay(key);
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
}
