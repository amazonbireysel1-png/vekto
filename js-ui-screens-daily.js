import { el, onTap } from './js-ui-dom.js';
import { icon } from './js-ui-icons.js';
import { trustedToday, parseDay, dayKey, MONTHS_TR } from './js-systems-calendar.js';

export function dailyScreen(app) {
  return () => {
    const s = app.save.data;
    const today = trustedToday(s);
    const done = !!s.daily.done[today];
    const d = parseDay(today);
    const y = d.getFullYear(), m = d.getMonth();
    const first = new Date(y, m, 1, 12);
    const lead = (first.getDay() + 6) % 7; // Pazartesi başlangıç
    const days = new Date(y, m + 1, 0).getDate();
    const cells = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((h) => `<div class="h">${h}</div>`);
    for (let i = 0; i < lead; i++) cells.push('<div></div>');
    for (let k = 1; k <= days; k++) {
      const key = dayKey(new Date(y, m, k, 12));
      const cls = ['c', s.daily.done[key] ? 'done' : '', key === today ? 'today' : '', key > today ? 'future' : ''].join(' ');
      cells.push(`<div class="${cls} num">${k}</div>`);
    }
    const node = el(`
      <section class="screen" aria-label="Günlük bulmaca">
        <header class="topbar">
          <button class="icon-btn" data-act="back" aria-label="Geri">${icon.back}</button>
          <div class="title">Günlük bulmaca</div>
          <div style="width:44px"></div>
        </header>
        <div class="scroll">
          <div class="card daily-hero">
            <div class="date num">${d.getDate()} ${MONTHS_TR[m]}</div>
            <p>${done ? 'Bugünün bulmacasını çözdün. Yarın yenisi açılacak.' : 'Her gün yeni, şekilli bir tahta. Seriyi bozma.'}</p>
            <button class="btn ${done ? 'soft' : 'primary'} big" data-act="play">${done ? `${icon.restart}Tekrar çöz` : `${icon.play}Bugünün bulmacası`}</button>
            <div class="streak">
              <div><b class="num">${s.daily.streak}</b><span>Mevcut seri</span></div>
              <div><b class="num">${s.daily.best}</b><span>En uzun seri</span></div>
              <div><b class="num">${s.stats.dailyDone}</b><span>Toplam</span></div>
            </div>
          </div>
          <div class="section-title">${MONTHS_TR[m]} ${y}</div>
          <div class="card"><div class="cal">${cells.join('')}</div></div>
          <p class="about">Tarih cihazının yerel saatine göre değişir.</p>
        </div>
      </section>`);
    onTap(node.querySelector('[data-act="back"]'), () => app.router.back(), { app, sound: 'back' });
    onTap(node.querySelector('[data-act="play"]'), () => app.startDaily(today), { app });
    return { node };
  };
}
