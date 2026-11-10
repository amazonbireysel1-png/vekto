// Başarımlar. Her biri kayıt üzerinden kontrol edilir; açılınca küçük bir ödül verir.

export const ACHIEVEMENTS = [
  { id: 'first', name: 'İlk adım', desc: 'İlk bölümü tamamla', reward: 20, check: (s) => s.stats.cleared >= 1 },
  { id: 'lv10', name: 'Isınma turu', desc: '10 bölüm tamamla', reward: 30, check: (s) => s.stats.cleared >= 10 },
  { id: 'lv50', name: 'Yön bulucu', desc: '50 bölüm tamamla', reward: 60, check: (s) => s.stats.cleared >= 50 },
  { id: 'lv100', name: 'Pusula', desc: '100 bölüm tamamla', reward: 100, check: (s) => s.stats.cleared >= 100 },
  { id: 'lv200', name: 'Kartograf', desc: '200 bölüm tamamla', reward: 150, check: (s) => s.stats.cleared >= 200 },
  { id: 'lv300', name: 'Usta yolcu', desc: '300 bölüm tamamla', reward: 250, check: (s) => s.stats.cleared >= 300 },
  { id: 'lv500', name: 'Son çizgi', desc: 'Tüm seviyeleri bitir', reward: 500, check: (s) => s.stats.cleared >= 500 },
  { id: 'perfect10', name: 'Temiz iş', desc: '10 bölümü hatasız bitir', reward: 40, check: (s) => s.stats.perfect >= 10 },
  { id: 'perfect50', name: 'Kusursuz', desc: '50 bölümü hatasız bitir', reward: 100, check: (s) => s.stats.perfect >= 50 },
  { id: 'stars100', name: 'Yıldız toplayıcı', desc: '100 yıldız kazan', reward: 60, check: (s) => s.stats.stars >= 100 },
  { id: 'nohint20', name: 'Kendi başına', desc: 'İpucusuz art arda 20 bölüm', reward: 60, check: (s) => s.stats.bestNoHintRun >= 20 },
  { id: 'boss1', name: 'Usta bölüm', desc: 'İlk usta bölümü (50) geç', reward: 50, check: (s) => s.stats.bossCleared >= 1 },
  { id: 'boss5', name: 'Zirve', desc: '5 usta bölümü geç', reward: 120, check: (s) => s.stats.bossCleared >= 5 },
  { id: 'daily_1', name: 'Günün bulmacası', desc: 'İlk günlük bulmacayı çöz', reward: 25, check: (s) => s.stats.dailyDone >= 1 },
  { id: 'daily_7', name: 'Haftalık ritim', desc: '7 gün üst üste günlük bulmaca', reward: 120, check: (s) => s.daily.best >= 7 },
  { id: 'player10', name: 'Deneyimli', desc: 'Oyuncu seviyesi 10', reward: 80, check: (s, ctx) => ctx.playerLevel >= 10 },
];

/** Yeni açılan başarımları işaretler ve döndürür. */
export function evaluateAchievements(save, ctx) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id]) continue;
    if (a.check(save, ctx)) {
      save.achievements[a.id] = Date.now();
      out.push(a);
    }
  }
  return out;
}
