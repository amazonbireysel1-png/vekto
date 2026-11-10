// Uygulama kökü: sistemleri kurar, ekranları bağlar, platform olaylarını yönetir.

import { SaveStore } from './js-systems-save.js';
import { Audio } from './js-systems-audio.js';
import { Platform } from './js-systems-platform.js';
import { themeById } from './js-systems-themes.js';
import { checkLoginReward, claimLoginReward, LOGIN_REWARDS } from './js-systems-progress.js';
import { trustedToday } from './js-systems-calendar.js';
import { getLevel, MAX_LEVEL } from './js-core-levels.js';
import { Router, Layers, Toasts, el, onTap } from './js-ui-dom.js';
import { icon } from './js-ui-icons.js';
import { homeScreen } from './js-ui-screens-home.js';
import { gameScreen } from './js-ui-screens-game.js';
import { levelsScreen } from './js-ui-screens-levels.js';
import { dailyScreen } from './js-ui-screens-daily.js';
import { progressScreen } from './js-ui-screens-progress.js';
import { settingsScreen } from './js-ui-screens-settings.js';
import { leagueScreen, askNickname } from './js-ui-screens-league.js';
import { League, leagueReady } from './js-systems-league.js';

class App {
  constructor() {
    this.save = new SaveStore();
    this.audio = new Audio();
    this.platform = Platform;
    this.layers = new Layers(document.querySelector('.overlay-host'));
    this.toasts = new Toasts(document.querySelector('.toast-host'));
    this.router = new Router(document.querySelector('.screen-host'), {
      home: homeScreen(this),
      game: gameScreen(this),
      levels: levelsScreen(this),
      daily: dailyScreen(this),
      progress: progressScreen(this),
      settings: settingsScreen(this),
      league: leagueScreen(this),
    });
    this.league = new League(this);
    this.loginChecked = false;
    this.exitArmed = 0;
  }

  start() {
    this.applySettings();
    this.platform.onBack(() => this.handleBack());
    this.platform.onPause(() => { this.league.push().catch(() => {}); this.save.flush(); this.audio.stopMusic(); this.audio.suspend(); });
    this.platform.onResume(() => {
      this.audio.resume();
      if (this.save.data.settings.music) this.audio.setMusic(true);
      // Gün değiştiyse ana menü yeni günlük içeriği göstersin
      this.league.schedulePush(500);
      if (this.router.current?.name === 'home') this.router.go('home', {}, { replace: true, back: true });
    });
    document.addEventListener('pointerdown', () => this.audio.unlock(), { once: true, capture: true });
    // Kaldığı yerden devam: yarım kalan bölüm varsa ana menüdeki "Oyna" onu açar
    this.router.go('home');
    this.platform.hideSplash();
    // Bir sonraki bölümü boşta önceden üret (geçişler anlık olsun)
    this.idle(() => getLevel(Math.min(MAX_LEVEL, this.save.data.level)));
  }

  idle(fn) { (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(fn); }

  theme() { return themeById(this.save.data.themes.active); }

  applySettings() {
    const s = this.save.data.settings;
    this.audio.setSfx(s.sound);
    if (s.music !== this.audio.musicOn) this.audio.setMusic(s.music);
    this.platform.hapticsOn = s.haptics;
    document.documentElement.classList.toggle('reduced', !!s.reducedMotion);
  }

  handleBack() {
    if (this.layers.back()) return;
    if (this.router.back()) return;
    this.confirmExit();
  }

  confirmExit() {
    const now = Date.now();
    if (now - this.exitArmed < 2200) { this.save.flush(); this.platform.exitApp(); return; }
    this.exitArmed = now;
    this.toasts.show('Çıkmak için tekrar geri tuşuna bas.', 2000);
  }

  startLevel(n) {
    n = Math.max(1, Math.min(n, this.save.data.level, MAX_LEVEL));
    const replace = this.router.current?.name === 'game';
    this.router.go('game', { mode: 'level', n }, { replace });
  }

  startDaily(dateKey = trustedToday(this.save.data)) {
    this.router.go('game', { mode: 'daily', dateKey });
  }

  async nextLevel(n) {
    const next = Math.min(MAX_LEVEL, n + 1);
    getLevel(next); // önbelleğe al
    this.startLevel(next);
    if (next < MAX_LEVEL) this.idle(() => getLevel(next + 1));
  }

  /** İlk girişte takma ad sorulur ve oyuncu doğrudan lige katılır. */
  maybeAskNickname() {
    if (!leagueReady() || this.league.joined || this.nickAsked) return false;
    this.nickAsked = true;
    setTimeout(() => askNickname(this), 350);
    return true;
  }

  maybeLoginReward() {
    if (this.maybeAskNickname()) return;
    if (this.nickOpen || this.loginChecked) return;
    this.loginChecked = true;
    const s = this.save.data;
    const offer = checkLoginReward(s);
    this.save.touch();
    if (!offer) return;
    // İlk açılışta oyuncuyu ödül ekranıyla karşılama; önce oyunu tanısın
    if (!s.stats.cleared) { claimLoginReward(s, offer); this.save.touch(); return; }
    // İlk gün dışındaki her girişte ödül penceresi
    const days = LOGIN_REWARDS.map((r, i) => {
      const cls = i < offer.index ? 'past' : i === offer.index ? 'now' : '';
      return `<div class="${cls}">${i + 1}. gün<b class="num">${r.hints} ipucu</b></div>`;
    }).join('');
    const r = offer.reward;
    const c = el(`<div><h2>Günlük ödül</h2><p class="lead">${offer.streak > 1 ? `${offer.streak}. gün üst üste buradasın.` : 'Bugün de hoş geldin.'}</p>
      <div class="login-days">${days}</div>
      <div class="rewards" style="margin-top:12px"><span class="reward mint">${icon.hint}+${r.hints} ipucu</span></div>
      <p class="lead" style="margin:12px 0 0;font-size:13.5px">Yedi gün üst üste girersen 7. gün 3 ipucu.</p>
      <div class="actions"><button class="btn primary big" data-a="ok">${icon.gift}Ödülü al</button></div></div>`);
    setTimeout(() => {
      const layer = this.layers.show(c, { center: true, onClose: () => { if (claimLoginReward(s, offer)) this.save.touch(); } });
      onTap(c.querySelector('[data-a="ok"]'), () => { this.audio.play('reward'); this.platform.haptic('success'); this.layers.close(layer); }, { app: this });
    }, 450);
  }
}

const app = new App();
window.__vekto = app; // testler ve hata ayıklama için
app.start();
