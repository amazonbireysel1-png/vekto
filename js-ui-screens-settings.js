import { el, onTap } from './js-ui-dom.js';
import { icon } from './js-ui-icons.js';
import { APP } from './js-config.js';

export function settingsScreen(app) {
  return () => {
    const s = app.save.data.settings;
    const row = (key, ic, label, sub) => `
      <button class="set-row" data-key="${key}" role="switch" aria-checked="${s[key]}">
        ${ic.replace('<svg', '<svg class="ic"')}
        <span class="txt">${label}${sub ? `<small>${sub}</small>` : ''}</span>
        <span class="switch ${s[key] ? 'on' : ''}"></span>
      </button>`;
    const node = el(`
      <section class="screen" aria-label="Ayarlar">
        <header class="topbar">
          <button class="icon-btn" data-act="back" aria-label="Geri">${icon.back}</button>
          <div class="title">Ayarlar</div>
          <div style="width:44px"></div>
        </header>
        <div class="scroll">
          <div class="section-title">Ses ve his</div>
          <div class="set-list">
            ${row('sound', icon.sound, 'Ses efektleri')}
            ${row('music', icon.music, 'Arka plan müziği', 'Sakin, dikkat dağıtmayan akorlar')}
            ${row('haptics', icon.vibrate, 'Titreşim')}
            ${row('reducedMotion', icon.motion, 'Azaltılmış hareket', 'Animasyonları kısaltır')}
          </div>
          <p class="about">Vekto ${APP.version}<br>İnternet olmadan oynanabilir. İlerleme yalnızca bu cihazda saklanır.<br>Yazı tipi: Inter (SIL Open Font License).</p>
        </div>
      </section>`);
    onTap(node.querySelector('[data-act="back"]'), () => app.router.back(), { app, sound: 'back' });
    node.querySelectorAll('[data-key]').forEach((b) => onTap(b, () => {
      const k = b.dataset.key;
      s[k] = !s[k];
      b.setAttribute('aria-checked', s[k]);
      b.querySelector('.switch').classList.toggle('on', s[k]);
      app.applySettings();
      app.save.touch();
    }, { app }));
    return { node };
  };
}
