import { el, onTap, esc } from './js-ui-dom.js';
import { icon } from './js-ui-icons.js';
import { playerLevel, totalStars } from './js-systems-progress.js';
import { ACHIEVEMENTS } from './js-systems-achievements.js';
import { THEMES } from './js-systems-themes.js';
import { trustedToday, addDays, parseDay, DAYS_TR } from './js-systems-calendar.js';

function fmtTime(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} dk`;
  return `${Math.floor(m / 60)} sa ${m % 60} dk`;
}

export function progressScreen(app) {
  return () => {
    const s = app.save.data;
    const pl = playerLevel(s.xp);
    const pct = Math.round((pl.into / pl.need) * 100);
    const today = trustedToday(s);
    const week = [];
    let maxDay = 1;
    for (let k = 6; k >= 0; k--) { const key = addDays(today, -k); const v = s.days[key] || 0; maxDay = Math.max(maxDay, v); week.push({ key, v }); }
    const weekHtml = week.map(({ key, v }) => `<div class="d ${key === today ? 'today' : ''}"><i class="${v ? 'on' : ''}" style="height:${4 + (v / maxDay) * 40}px"></i>${DAYS_TR[parseDay(key).getDay()]}</div>`).join('');
    const todayCount = s.days[today] || 0;
    const C = 2 * Math.PI * 30;
    const achDone = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;

    const achHtml = ACHIEVEMENTS.map((a) => {
      const done = !!s.achievements[a.id];
      return `<div class="ach ${done ? 'done' : ''}"><span class="medal">${done ? icon.check : icon.medal}</span>
        <span class="txt"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></span>
        </div>`;
    }).join('');

    const themeHtml = THEMES.map((t) => {
      const owned = s.themes.owned.includes(t.id);
      const active = s.themes.active === t.id;
      const how = !t.unlock ? 'Varsayılan' : t.unlock.type === 'level' ? `${t.unlock.value} bölüm` : 'Haftalık ritim';
      return `<button class="theme ${owned ? '' : 'locked'} ${active ? 'active' : ''}" data-theme="${t.id}" aria-label="${esc(t.name)} teması">
        <span class="sw"><i style="background:${t.mono || (t.pastel ? 'linear-gradient(135deg,#F7B5B1,#F6DE9C,#A9E0BE,#A9CDF4)' : 'linear-gradient(135deg,#F2706B,#F2C14E,#4FC27A,#3E9BEA,#9C7BEB)')};color:#fff">${icon.arrowUp}</i></span>
        ${esc(t.name)}<small>${owned ? (active ? 'Kullanılıyor' : 'Seç') : how}</small></button>`;
    }).join('');

    const node = el(`
      <section class="screen" aria-label="İlerleme">
        <header class="topbar">
          <button class="icon-btn" data-act="back" aria-label="Geri">${icon.back}</button>
          <div class="title">İlerleme</div>
          <div style="width:44px"></div>
        </header>
        <div class="scroll">
          <div class="card player-card">
            <div class="ring"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="none" stroke="var(--surface-2)" stroke-width="6"/>
              <circle cx="36" cy="36" r="30" fill="none" stroke="var(--piece)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/></svg><b class="num">${pl.level}</b></div>
            <div class="txt"><b>Oyuncu seviyesi ${pl.level}</b><span class="num">Sonraki seviyeye ${pl.need - pl.into} deneyim</span>
              <div class="bar"><i style="width:${pct}%"></i></div></div>
          </div>
          <div class="section-title">Özet</div>
          <div class="stat-grid">
            <div class="stat"><b>${s.stats.cleared}</b><span>Tamamlanan bölüm</span></div>
            <div class="stat"><b>${totalStars(s)}</b><span>Toplam yıldız</span></div>
            <div class="stat"><b>${s.stats.perfect}</b><span>Hatasız bölüm</span></div>
            <div class="stat"><b>${s.stats.bestNoHintRun}</b><span>En uzun ipucusuz seri</span></div>
            <div class="stat"><b>${s.stats.bossCleared}</b><span>Usta bölüm</span></div>
            <div class="stat"><b>${fmtTime(s.stats.playMs)}</b><span>Oyun süresi</span></div>
          </div>
          <div class="section-title">Son 7 gün<small class="num">Bugün ${todayCount} bulmaca</small></div>
          <div class="card"><div class="week">${weekHtml}</div></div>
          <div class="section-title">Temalar<small>Oynanışı değiştirmez</small></div>
          <div class="theme-grid">${themeHtml}</div>
          <div class="section-title">Başarımlar<small class="num">${achDone}/${ACHIEVEMENTS.length}</small></div>
          <div class="card" style="padding-top:4px;padding-bottom:4px">${achHtml}</div>
        </div>
      </section>`);
    onTap(node.querySelector('[data-act="back"]'), () => app.router.back(), { app, sound: 'back' });
    node.querySelectorAll('[data-theme]').forEach((b) => onTap(b, () => {
      const id = b.dataset.theme;
      const t = THEMES.find((x) => x.id === id);
      if (!s.themes.owned.includes(id)) {
        app.toasts.show(`${icon.lock}${esc(t.name)}: ${t.unlock.type === 'level' ? `${t.unlock.value} bölüm tamamlayınca açılır` : '7 gün üst üste günlük bulmaca çöz'}`);
        return;
      }
      s.themes.active = id;
      app.save.touch();
      node.querySelectorAll('.theme').forEach((x) => {
        const on = x.dataset.theme === id;
        x.classList.toggle('active', on);
        if (s.themes.owned.includes(x.dataset.theme)) x.querySelector('small').textContent = on ? 'Kullanılıyor' : 'Seç';
      });
    }, { app }));
    return { node };
  };
}
