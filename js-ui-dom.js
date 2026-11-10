// Küçük DOM yardımcıları, ekran yönlendirici, katman (modal) yığını ve bildirimler.

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Tıklama: basılma efekti + ses + titreşim tek yerden. */
export function onTap(node, fn, { sound = 'tap', app } = {}) {
  node.classList.add('pressable');
  node.addEventListener('click', (e) => {
    if (node.disabled) return;
    if (app) { app.audio.unlock(); app.audio.play(sound); app.platform.haptic('light'); }
    fn(e);
  });
}

/** Ekranlar arası geçiş yığını. Android geri tuşu önce katmanları, sonra ekranları kapatır. */
export class Router {
  constructor(host, screens) {
    this.host = host;
    this.screens = screens; // name → (app, params) => { node, destroy?, onBack? }
    this.stack = [];
    this.current = null;
  }

  go(name, params = {}, { replace = false, back = false } = {}) {
    const prev = this.current;
    const inst = this.screens[name](params);
    inst.name = name;
    inst.params = params;
    if (back) inst.node.classList.add('back-in');
    this.host.appendChild(inst.node);
    if (prev) {
      prev.node.classList.add('leaving');
      prev.destroy?.();
      setTimeout(() => prev.node.remove(), 240);
    }
    if (!back && prev && !replace) this.stack.push({ name: prev.name, params: prev.params });
    this.current = inst;
    inst.mounted?.();
    return inst;
  }

  back() {
    if (this.current?.onBack && this.current.onBack() === true) return true;
    const to = this.stack.pop();
    if (!to) return false;
    this.go(to.name, to.params, { back: true });
    return true;
  }

  home(params) {
    this.stack = [];
    this.go('home', params, { back: true });
  }
}

export class Layers {
  constructor(host) { this.host = host; this.stack = []; }

  get open() { return this.stack.length > 0; }

  /** content: Node. opts: { center, dismissable, onClose } */
  show(content, { center = false, dismissable = true, onClose } = {}) {
    const scrim = el('<div class="scrim"></div>');
    const sheet = el(`<div class="sheet${center ? ' center' : ''}" role="dialog" aria-modal="true"></div>`);
    sheet.appendChild(content);
    this.host.append(scrim, sheet);
    const layer = { scrim, sheet, dismissable, onClose, closed: false };
    if (dismissable) scrim.addEventListener('click', () => this.close(layer));
    this.stack.push(layer);
    return layer;
  }

  close(layer = this.stack[this.stack.length - 1]) {
    if (!layer || layer.closed) return;
    layer.closed = true;
    this.stack = this.stack.filter((l) => l !== layer);
    layer.scrim.classList.add('leaving');
    layer.sheet.classList.add('leaving');
    setTimeout(() => { layer.scrim.remove(); layer.sheet.remove(); }, 210);
    layer.onClose?.();
  }

  /** Geri tuşu: kapatılabilir en üst katmanı kapatır. */
  back() {
    const top = this.stack[this.stack.length - 1];
    if (!top) return false;
    if (top.dismissable) this.close(top);
    return true;
  }

  closeAll() { [...this.stack].forEach((l) => this.close(l)); }
}

export class Toasts {
  constructor(host) { this.host = host; }
  show(html, ms = 2200) {
    const t = el(`<div class="toast" role="status">${html}</div>`);
    this.host.appendChild(t);
    while (this.host.children.length > 3) this.host.firstElementChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms);
  }
}

export function starsHtml(n, star, max = 3) {
  return Array.from({ length: max }, (_, i) => star.replace('<svg', `<svg class="${i < n ? 'on' : ''}"`)).join('');
}
