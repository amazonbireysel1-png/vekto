// Lig ekranı (global sıralama) ve ilk girişteki takma ad penceresi.

import { el, onTap, esc } from './js-ui-dom.js';
import { icon } from './js-ui-icons.js';
import { nameProblem, NAME_MAX, leagueReady, tierOf } from './js-systems-league.js';

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');

export function leagueScreen(app) {
  return () => {
    const s = app.save.data;
    const node = el(`
      <section class="screen league" aria-label="Lig">
        <header class="topbar">
          <button class="icon-btn" data-act="back" aria-label="Geri">${icon.back}</button>
          <div class="title">Lig</div>
          <button class="icon-btn" data-act="refresh" aria-label="Yenile">${icon.restart}</button>
        </header>
        <div class="scroll">
          <div class="tier-card tone-bronze" data-tiercard>
            <div class="tier-badge" data-tbadge></div>
            <div class="tier-txt"><b data-tname></b><small data-tnext></small>
              <div class="tier-bar"><i data-tbar></i></div></div>
          </div>
          <div class="my-league">
            <div class="ml-rank num" data-rank>–</div>
            <div class="ml-txt"><b data-name>${esc(s.league.name || 'Takma ad yok')}</b><small data-sub>Sıran yükleniyor</small></div>
            <div class="ml-pts num">${icon.bolt}<span data-pts>${fmt(s.points)}</span></div>
          </div>
          <p class="league-note">Çıkardığın her ok 1 puan. Seviyeyi geçemesen de çıkardığın oklar puanına eklenir.</p>
          <ol class="board-list" data-list><li class="state">Yükleniyor…</li></ol>
        </div>
      </section>`);
    const $ = (q) => node.querySelector(q);
    let alive = true;

    function paintTier(points) {
      const t = tierOf(points);
      const card = $('[data-tiercard]');
      card.className = `tier-card tone-${t.tone}`;
      $('[data-tbadge]').textContent = t.name.replace(/^\S+\s*/, '') || '★';
      $('[data-tname]').textContent = t.name;
      $('[data-tnext]').textContent = t.next ? `${t.next.name} için ${fmt(t.toNext)} puan kaldı` : 'En üst kademedesin';
      $('[data-tbar]').style.width = `${Math.round(t.progress * 100)}%`;
    }
    paintTier(s.points);

    async function load(force) {
      if (!leagueReady()) { $('[data-list]').innerHTML = '<li class="state">Lig şu anda kapalı.</li>'; return; }
      if (force) app.league.cache = null;
      $('[data-list]').innerHTML = '<li class="state">Yükleniyor…</li>';
      try {
        const { list, myRank, total } = await app.league.standings(100);
        if (!alive) return;
        const me = app.save.data.league.uid;
        $('[data-rank]').textContent = myRank ? `${myRank}.` : '–';
        $('[data-sub]').textContent = app.league.joined
          ? (total ? `${fmt(total)} oyuncu arasında ${myRank}. sıradasın` : `${myRank}. sıradasın`)
          : 'Lige katılmak için takma ad seç';
        $('[data-name]').textContent = app.save.data.league.name || 'Takma ad yok';
        $('[data-list]').innerHTML = list.length
          ? list.map((p, k) => `<li class="${p.uid === me ? 'me' : ''}${k < 3 ? ` top top${k + 1}` : ''}">
              <span class="r num">${k + 1}</span><span class="n">${esc(p.name)}<small class="tn tone-${tierOf(p.score).tone}">${tierOf(p.score).name}</small></span><span class="p num">${fmt(p.score)}</span></li>`).join('')
          : '<li class="state">Henüz kimse yok. İlk sen ol.</li>';
      } catch {
        if (!alive) return;
        $('[data-list]').innerHTML = '<li class="state">Sıralama alınamadı. İnternet bağlantını kontrol edip yenile.</li>';
        $('[data-sub]').textContent = 'Çevrimdışı';
      }
    }

    onTap($('[data-act="back"]'), () => app.router.back(), { app, sound: 'back' });
    onTap($('[data-act="refresh"]'), () => load(true), { app });
    if (!app.league.joined && leagueReady()) {
      onTap($('.my-league'), () => askNickname(app, () => load(true)), { app });
    }
    const off = app.save.onChange((d) => { $('[data-pts]').textContent = fmt(d.points); paintTier(d.points); });
    return {
      node,
      mounted: () => { load(false); if (!app.league.joined && leagueReady()) askNickname(app, () => load(true)); },
      destroy: () => { alive = false; off?.(); },
    };
  };
}

/** Takma ad penceresi: ad seçilince oyuncu lige katılır. */
export function askNickname(app, done) {
  if (app.league.joined || app.nickOpen) return;
  app.nickOpen = true;
  const c = el(`<div class="nick">
    <div class="nick-badge">${icon.trophy}</div>
    <h2>Takma adını seç</h2>
    <p class="lead">Bu adla global lige katılırsın. Çıkardığın her ok 1 puan.</p>
    <input class="nick-input" type="text" maxlength="${NAME_MAX}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ör. okçu_ali" aria-label="Takma ad">
    <p class="nick-err" role="alert"></p>
    <div class="actions">
      <button class="btn primary big" data-a="ok">${icon.trophy}Lige katıl</button>
      <button class="btn soft" data-a="later">Sonra</button>
    </div></div>`);
  const input = c.querySelector('input'), err = c.querySelector('.nick-err'), ok = c.querySelector('[data-a="ok"]');
  const layer = app.layers.show(c, { center: true, dismissable: false, onClose: () => { app.nickOpen = false; setTimeout(() => app.maybeLoginReward(), 300); } });
  const close = () => app.layers.close(layer);
  setTimeout(() => input.focus(), 300);
  input.addEventListener('input', () => { err.textContent = ''; });
  let busy = false;
  async function submit() {
    if (busy) return;
    const name = input.value.trim();
    const p = nameProblem(name);
    if (p) { err.textContent = p; return; }
    busy = true; ok.disabled = true; ok.lastChild.textContent = 'Katılınıyor…';
    try {
      const n = await app.league.join(name);
      close();
      app.audio.play('reward'); app.platform.haptic('success');
      app.toasts.show(`${icon.trophy}Lige katıldın, ${esc(n)}.`, 2200);
      app.league.schedulePush(200);
      done?.();
    } catch (e) {
      err.textContent = e.code === 'taken' ? 'Bu ad alınmış, başka bir ad dene.' : 'Bağlanılamadı. İnternet bağlantını kontrol et.';
    } finally {
      busy = false; ok.disabled = false; ok.lastChild.textContent = 'Lige katıl';
    }
  }
  onTap(ok, submit, { app });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  onTap(c.querySelector('[data-a="later"]'), () => close(), { app, sound: 'back' });
}
