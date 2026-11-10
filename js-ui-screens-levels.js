import { el, onTap } from './js-ui-dom.js';
import { icon } from './js-ui-icons.js';
import { CHAPTER_SIZE, isBoss, chapterName, MAX_LEVEL, levelLabel } from './js-core-levels.js';


export function levelsScreen(app) {
  return () => {
    const s = app.save.data;
    const cur = s.level;
    // Toplam seviye sayısı gösterilmez: yalnızca açılmış gruplar listelenir
    const chapters = Math.floor((Math.min(cur, MAX_LEVEL) - 1) / CHAPTER_SIZE) + 1;
    const parts = [];
    for (let c = 0; c < chapters; c++) {
      const a = c * CHAPTER_SIZE + 1, b = a + CHAPTER_SIZE - 1;
      let stars = 0;
      const cells = [];
      for (let n = a; n <= b; n++) {
        const rec = s.levels[n];
        if (rec) stars += rec.s;
        const locked = n > cur;
        const cls = ['lv', locked ? 'locked' : '', n === cur ? 'current' : '', isBoss(n) ? 'boss' : '', `t-${levelLabel(n).tone}`].join(' ');
        const st = rec ? `<span class="stars">${[0, 1, 2].map((k) => icon.star.replace('<svg', `<svg class="${k < rec.s ? 'on' : ''}"`)).join('')}</span>` : '';
        cells.push(`<button class="${cls}" data-n="${n}" ${locked ? 'aria-disabled="true"' : ''} aria-label="Seviye ${n}">${locked ? icon.lock : `<span class="num">${n}</span>`}${locked ? '' : st}</button>`);
      }
      const name = chapterName(a);
      parts.push(`<div class="section-title" data-ch="${c}">${name}<small class="num">${stars} yıldız</small></div><div class="level-grid">${cells.join('')}</div>`);
    }
    const node = el(`
      <section class="screen" aria-label="Bölümler">
        <header class="topbar">
          <button class="icon-btn" data-act="back" aria-label="Geri">${icon.back}</button>
          <div class="title">Seviyeler</div>
          <div style="width:44px"></div>
        </header>
        <div class="scroll">${parts.join('')}</div>
      </section>`);
    onTap(node.querySelector('[data-act="back"]'), () => app.router.back(), { app, sound: 'back' });
    node.querySelector('.scroll').addEventListener('click', (e) => {
      const b = e.target.closest('.lv');
      if (!b) return;
      const n = +b.dataset.n;
      app.audio.unlock();
      if (n > cur) { app.audio.play('refuse'); app.toasts.show(`${icon.lock}Önce ${cur}. seviyeyi tamamla.`); return; }
      app.audio.play('tap');
      app.startLevel(n);
    });
    node.querySelectorAll('.lv').forEach((b) => b.classList.add('pressable'));
    return {
      node,
      mounted: () => {
        const c = node.querySelector('.lv.current');
        if (c) c.scrollIntoView({ block: 'center' });
      },
    };
  };
}
