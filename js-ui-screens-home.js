import { el, onTap, esc } from './js-ui-dom.js';
import { icon } from './js-ui-icons.js';
import { levelLabel, MAX_LEVEL } from './js-core-levels.js';
import { trustedToday, prettyDay } from './js-systems-calendar.js';
import { tierOf } from './js-systems-league.js';

export function homeScreen(app) {
  return () => {
    const s = app.save.data;
    const done = s.level > MAX_LEVEL;
    const n = Math.min(s.level, MAX_LEVEL);
    const lab = levelLabel(n);
    const today = trustedToday(s);
    const dailyDone = !!s.daily.done[today];
    const node = el(`
      <section class="screen home" aria-label="Ana sayfa">
        <header class="home-head">
          <div class="pill num hint-pill" data-hints title="İpucu hakkı">${icon.hint}<span>${s.hints}</span></div>
          <button class="pill num pts-pill" data-act="league2" title="Puan">${icon.bolt}<span data-pts>${s.points.toLocaleString('tr-TR')}</span></button>
          <div class="spacer"></div>
          <button class="icon-btn" data-act="settings" aria-label="Ayarlar">${icon.settings}</button>
        </header>
        <div class="home-hero">
          <h1 class="brand"><img class="brand-logo" src="assets-logo.png" alt="Vekto" width="132" height="132"></h1>
          <p class="tagline">Okları doğru sırayla çöz</p>
          <div class="level-card">
            ${done ? `<div class="lc-num">Hepsi bitti</div><div class="lc-sub">Günlük bulmaca her gün yenileniyor.</div>`
            : `<div class="lc-num">Seviye ${n}</div><span class="diff tone-${lab.tone}">${lab.name}</span>`}
          </div>
        </div>
        <div class="home-actions">
          <button class="btn primary big" data-act="play">${icon.play}<span>${done ? 'Son seviyeyi tekrar oyna' : 'Başla'}</span></button>
          <button class="daily-card${dailyDone ? ' done' : ''}" data-act="daily">
            <span class="glyph">${dailyDone ? icon.check : icon.calendarPlain}</span>
            <span class="txt"><b>Günlük bulmaca</b><small>${dailyDone ? `${prettyDay(today)} tamamlandı, ${s.daily.streak} günlük seri` : `${prettyDay(today)} için yeni bulmaca hazır`}</small></span>
            <span class="chev">${icon.chevron}</span>
          </button>
          <button class="league-card tone-${tierOf(s.points).tone}" data-act="league">
            <span class="glyph">${icon.trophy}</span>
            <span class="txt"><b>Lig</b><small data-tier>${tierOf(s.points).name}</small></span>
            <span class="chev">${icon.chevron}</span>
          </button>
          <div class="home-row">
            <button class="btn" data-act="levels">${icon.grid}<span>Seviyeler</span></button>
            <button class="btn" data-act="progress">${icon.chart}<span>İlerleme</span></button>
          </div>
        </div>
      </section>`);

    const $ = (a) => node.querySelector(`[data-act="${a}"]`);
    onTap($('play'), () => app.startLevel(n), { app });
    onTap($('daily'), () => app.router.go('daily'), { app });
    onTap($('levels'), () => app.router.go('levels'), { app });
    onTap($('league'), () => app.router.go('league'), { app });
    onTap($('league2'), () => app.router.go('league'), { app });
    onTap($('progress'), () => app.router.go('progress'), { app });
    onTap($('settings'), () => app.router.go('settings'), { app });

    const off = app.save.onChange((d) => { node.querySelector('[data-hints] span').textContent = d.hints; node.querySelector('[data-pts]').textContent = d.points.toLocaleString('tr-TR'); node.querySelector('[data-tier]').textContent = tierOf(d.points).name; node.querySelector('.league-card').className = `league-card tone-${tierOf(d.points).tone}`; });
    return { node, destroy: off, mounted: () => app.maybeLoginReward(), onBack: () => { app.confirmExit(); return true; } };
  };
}
