// Oyun ekranı: tahta, kontroller, öğretici, ipucu, kazanma/kaybetme akışı.

import { el, onTap, esc, starsHtml } from './js-ui-dom.js';
import { icon } from './js-ui-icons.js';
import { Session, LIVES } from './js-game-session.js';
import { BoardRenderer } from './js-render-renderer.js';
import { getLevel, getDaily, MAX_LEVEL } from './js-core-levels.js';
import { createState, applyUnit } from './js-core-rules.js';
import { canAffordHint, spendHint, recordLevelWin, recordDailyWin } from './js-systems-progress.js';
import { prettyDay } from './js-systems-calendar.js';
import { launchConfetti } from './js-ui-confetti.js';
import { TUTORIALS } from './js-ui-tutorials.js';

export function gameScreen(app) {
  return (params) => {
    const isDaily = params.mode === 'daily';
    const level = isDaily ? getDaily(params.dateKey) : getLevel(params.n);
    const key = isDaily ? `d:${params.dateKey}` : `l:${params.n}`;
    let session = new Session(level);
    const save = app.save.data;

    // Yarıda kalan bölümü sürdür
    const res = save.resume;
    if (res && res.key === key && Array.isArray(res.dead) && res.dead.length < level.n) {
      const st = createState(level);
      for (const i of res.dead) if (i >= 0 && i < level.n) applyUnit(level, st, [i]);
      session.state = st;
      session.moves = res.moves || 0; session.cleared = res.cleared || 0;
      session.mistakes = res.mistakes || 0; session.hintsUsed = res.hints || 0;
      session.lives = res.lives ?? session.lives;
      session.undosLeft = res.undos ?? session.undosLeft;
      if (!session.solvable()) session = new Session(level); // güvenlik
    }

    const lab = level.meta.label;
    const tag = `<span class="level-tag tone-${lab.tone}">${isDaily ? 'Günlük' : lab.name}</span>`;
    const title = isDaily ? prettyDay(params.dateKey) : `Seviye ${level.meta.n}`;
    const node = el(`
      <section class="screen game" aria-label="Oyun">
        <header class="topbar">
          <button class="icon-btn" data-act="back" aria-label="Ana sayfa">${icon.home}</button>
          <div class="title">${esc(title)}${tag}<small>${esc(level.meta.shapeName)}${level.meta.boss ? ', usta seviye' : ''}</small></div>
          <div style="width:44px"></div>
        </header>
        <div class="status-row" data-status></div>
        <div class="board-wrap" data-board><canvas aria-label="Oyun tahtası"></canvas>
        </div>
        <nav class="controls">
          <button class="ctrl" data-act="undo" aria-label="Geri al">${icon.undo}<span>Geri al</span><em class="badge num" data-undo></em></button>
          <button class="ctrl" data-act="restart" aria-label="Yeniden başlat">${icon.restart}<span>Yeniden</span></button>
          <button class="ctrl" data-act="hint" aria-label="İpucu">${icon.hint}<span>İpucu</span><em class="badge num" data-hint></em></button>
        </nav>
      </section>`);

    const $ = (s) => node.querySelector(s);
    const wrap = $('[data-board]');
    const renderer = new BoardRenderer($('canvas'));
    renderer.anim.reducedMotion = save.settings.reducedMotion;
    renderer.setTheme(app.theme());
    let hintNote = null;
    let ended = false;

    const persist = () => {
      if (session.finished) { save.resume = null; app.save.touch(); return; }
      const dead = [];
      for (let i = 0; i < level.n; i++) if (!session.state.alive[i]) dead.push(i);
      save.resume = { key, dead, moves: session.moves, cleared: session.cleared, mistakes: session.mistakes, lives: session.lives, hints: session.hintsUsed, undos: session.undosLeft };
      app.save.touch();
    };

    const updateHud = () => {
      const st = $('[data-status]');
      const hearts = Array.from({ length: LIVES }, (_, k) => `<i class="heart ${k < session.lives ? 'on' : ''}">${icon.heart}</i>`).join('');
      st.innerHTML = `<span class="lives" aria-label="${session.lives} can">${hearts}</span><span class="chip num">${session.state.aliveCount} ok kaldı</span>`;
      const u = $('[data-undo]');
      u.textContent = session.undosLeft;
      $('[data-act="undo"]').disabled = !session.canUndo();
      const hb = $('[data-hint]');
      hb.className = 'badge num' + (save.hints > 0 ? '' : ' empty');
      hb.textContent = save.hints;
    };

    const clearHint = () => { renderer.clearHint(); hintNote?.remove(); hintNote = null; };

    const start = (fresh) => {
      if (fresh) { session = new Session(level); save.resume = null; app.save.touch(); }
      renderer.setLevel(level, session.state);
      renderer.intro();
      clearHint();
      updateHud();
    };

    // --- Dokunma, kaydırma ve iki parmakla yakınlaştırma ---
    const pts = new Map();
    let tap = null, pinch = null;
    const local = (e) => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.coach')) return;
      app.audio.unlock();
      try { wrap.setPointerCapture(e.pointerId); } catch { /* sentetik olay */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        const idx = (ended || session.finished) ? -1 : renderer.hitTest(e.clientX, e.clientY);
        tap = { id: e.pointerId, x: e.clientX, y: e.clientY, idx, moved: false };
        if (idx >= 0) { renderer.press(idx, true); app.audio.play('select'); }
      } else if (pts.size === 2) {
        if (tap?.idx >= 0) renderer.press(tap.idx, false);
        tap = null;
        const [a, b] = [...pts.values()];
        const r = wrap.getBoundingClientRect();
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: renderer.z, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top };
      }
    });
    wrap.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        const r = wrap.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        renderer.panBy(mx - pinch.mx, my - pinch.my);
        pinch.mx = mx; pinch.my = my;
        renderer.zoomAt(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, pinch.d0), mx, my);
        return;
      }
      if (tap && tap.id === e.pointerId && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) {
        if (tap.idx >= 0) renderer.press(tap.idx, false);
        tap.moved = true; tap.idx = -1;
      }
      if (tap?.moved && renderer.z > 1.01) renderer.panBy(dx, dy);
    });
    const up = (e, cancel) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!tap || tap.id !== e.pointerId) return;
      const t = tap; tap = null;
      if (t.idx >= 0) renderer.press(t.idx, false);
      if (!cancel && !t.moved && t.idx >= 0) act(t.idx);
    };
    wrap.addEventListener('pointerup', (e) => up(e, false));
    wrap.addEventListener('pointercancel', (e) => up(e, true));
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = local(e);
      renderer.zoomAt(renderer.z * Math.exp(-e.deltaY * 0.0015), x, y);
    }, { passive: false });

    let lostHeart = false;
    function act(i) {
      const r = session.tap(i);
      if (r.type === 'ignored') return;
      hideTip();
      if (r.type === 'move') {
        clearHint();
        renderer.exit(r.unit);
        app.audio.play('move');
        app.platform.haptic('light');
      } else if (r.type === 'blocked') {
        renderer.blocked(r.culprit, r);
        app.audio.play('blocked');
        app.platform.haptic('warning');
        lostHeart = true;
      }
      updateHud();
      if (lostHeart) { const h = node.querySelectorAll('.heart')[session.lives]; h?.classList.add('lost'); lostHeart = false; }
      persist();
      if (r.win) onWin();
      else if (r.outOfLives) onOutOfLives();
    }

    function onWin() {
      ended = true;
      save.resume = null;
      const stars = session.stars();
      const ms = session.elapsed();
      const sum = isDaily
        ? recordDailyWin(save, { dateKey: params.dateKey, stars, ms })
        : recordLevelWin(save, { n: level.meta.n, stars, mistakes: session.mistakes, ms, hints: session.hintsUsed, boss: level.meta.boss });
      app.save.touch();
      app.save.flush();
      setTimeout(() => {
        renderer.win();
        launchConfetti({ reduced: save.settings.reducedMotion });
        app.audio.play('win'); app.platform.haptic('success');
      }, 380);
      setTimeout(() => showWin(stars, sum), 1050);
    }

    function showWin(stars, sum) {
      const chips = [];
      if (sum.hints) chips.push(`<span class="reward mint">${icon.hint}+${sum.hints} ipucu${sum.milestone ? `, ${sum.milestone.n}. seviye ödülü` : ''}</span>`);
      if (sum.levelUp) chips.push(`<span class="reward lav">Seviye ${sum.levelUp.to}</span>`);
      for (const a of sum.achievements) chips.push(`<span class="reward lav">${icon.medal}${esc(a.name)}</span>`);
      for (const t of sum.themes) chips.push(`<span class="reward">${icon.palette}${esc(t.name)} teması</span>`);
      chips.forEach((c, k) => { chips[k] = c.replace('class="reward', `style="animation-delay:${380 + k * 70}ms" class="reward`); });
      const last = !isDaily && level.meta.n >= MAX_LEVEL;
      const headline = isDaily ? 'Günün bulmacası çözüldü' : last ? 'Tüm seviyeler bitti' : level.meta.boss ? 'Usta seviye geçildi' : 'Tamamlandı';
      const sub = isDaily
        ? (sum.first ? `${sum.streak} günlük seri` : 'Bugünün ödülü zaten alındı')
        : session.mistakes === 0 ? 'Hatasız' : `${session.mistakes} takılma`;
      const content = el(`<div>
        <div class="win-stars">${starsHtml(stars, icon.star)}</div>
        <h2>${headline}</h2>
        <p class="lead">${sub}</p>
        <div class="rewards">${chips.join('')}</div>
        <div class="actions">
          ${isDaily || last ? '<button class="btn primary big" data-a="home">Ana sayfa</button>'
            : `<button class="btn primary big" data-a="next">Sonraki seviye ${icon.next}</button>`}
          <div class="actions row" style="margin-top:0">
            <button class="btn soft" data-a="replay">${icon.restart}Tekrar</button>
            ${isDaily || last ? '' : `<button class="btn soft" data-a="menu">${icon.grid}Ana sayfa</button>`}
          </div>
        </div></div>`);
      content.querySelectorAll('.win-stars svg.on').forEach((s, k) => { s.style.animationDelay = `${120 + k * 140}ms`; });
      const layer = app.layers.show(content, { dismissable: false });
      if (sum.achievements.length || sum.milestone) setTimeout(() => app.audio.play('reward'), 520);
      const close = () => app.layers.close(layer);
      const a = (k) => content.querySelector(`[data-a="${k}"]`);
      if (a('next')) onTap(a('next'), () => { close(); app.nextLevel(level.meta.n); }, { app });
      if (a('home')) onTap(a('home'), () => { close(); app.router.home(); }, { app });
      if (a('menu')) onTap(a('menu'), () => { close(); app.router.home(); }, { app });
      onTap(a('replay'), () => { close(); ended = false; start(true); }, { app });
      updateHud();
    }

    /** Canlar bitti: kısa bir uyarı, sonra seviye en baştan ve 3 canla başlar. */
    function onOutOfLives() {
      ended = true;
      app.audio.play('fail');
      app.platform.haptic('warning');
      app.toasts.show(`${icon.heart}Canın bitti, seviye baştan başlıyor.`, 1600);
      wrap.classList.add('shake');
      setTimeout(() => { wrap.classList.remove('shake'); ended = false; start(true); }, 1000);
    }

    function doUndo() {
      const r = session.undo();
      if (!r) return;
      app.save.data.stats.undos++;
      renderer.setState(session.state);
      renderer.restore(r.restored);
      app.audio.play('undo');
      clearHint();
      updateHud();
      persist();
    }

    async function doHint() {
      if (session.finished) return;
      if (!canAffordHint(save)) {
        app.toasts.show(`${icon.hint}İpucu hakkın bitti. Yarın girişte yeni ipucu gelecek.`);
        return;
      }
      spendHint(save);
      const h = session.hint();
      if (!h) return;
      renderer.showHint(h);
      app.audio.play('hint');
      hintNote?.remove();
      const msg = h.stage === 1
        ? 'Parlayan ok şu an çıkabilir.'
        : h.next ? 'Mavi oku çıkar; ardından mor okun yolu açılır.' : 'Parlayan ok çıkınca tahta rahatlar.';
      // İpucu edilen ok ekranda görünmüyorsa görünümü sığdır
      if (renderer.z > 1.01) renderer.fit();
      hintNote = el(`<div class="hint-note">${msg}</div>`);
      wrap.appendChild(hintNote);
      updateHud();
      persist();
    }

    /** Bilgi kartı yalnızca ilk seviyede, ilk oynayışta bir kez çıkar. */
    let tip = null;
    function showFirstTip() {
      if (isDaily || level.meta.n !== 1 || save.tutorials.t_basics) return;
      save.tutorials.t_basics = 1;
      app.save.touch();
      const t = TUTORIALS.basics;
      tip = el(`<div class="coach" role="note"><p><b>${esc(t.title)}</b>${esc(t.body)}</p><button class="icon-btn" aria-label="Kapat">${icon.close}</button></div>`);
      onTap(tip.querySelector('button'), hideTip, { app });
      wrap.appendChild(tip);
    }
    function hideTip() {
      if (!tip) return;
      const c = tip; tip = null;
      c.classList.add('out');
      setTimeout(() => c.remove(), 220);
    }

    onTap($('[data-act="back"]'), () => app.router.home(), { app, sound: 'back' });
    onTap($('[data-act="undo"]'), doUndo, { app });
    onTap($('[data-act="restart"]'), () => { if (!ended) start(true); }, { app });
    onTap($('[data-act="hint"]'), doHint, { app });

    const off = app.save.onChange(() => updateHud());

    return {
      node,
      mounted: () => {
        requestAnimationFrame(() => { start(false); showFirstTip(); });
      },
      destroy: () => { off(); renderer.destroy(); persist(); },
      setTheme: () => { renderer.setTheme(app.theme()); },
      // Android geri tuşu: oyundan her zaman ana sayfaya
      onBack: () => { app.router.home(); return true; },
      session: () => session,
      renderer,
      debugTap: (i) => act(i),
    };
  };
}
