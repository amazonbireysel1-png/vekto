// Yerel platform köprüsü (Capacitor). Tarayıcıda çalışırken her şey güvenle no-op olur.
// Geri tuşu, arka plana geçme/geri gelme ve titreşim burada toplanır.

const Cap = () => (typeof window !== 'undefined' ? window.Capacitor : null);
export const isNative = () => !!Cap()?.isNativePlatform?.();
const plugin = (name) => Cap()?.Plugins?.[name] || null;

export const Platform = {
  hapticsOn: true,

  onBack(handler) {
    const App = plugin('App');
    if (App?.addListener) {
      App.addListener('backButton', () => handler());
    }
    // Tarayıcı / masaüstü testi için Escape tuşu geri tuşu gibi davranır
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') handler(); });
  },

  exitApp() {
    const App = plugin('App');
    if (App?.exitApp) App.exitApp();
  },

  onPause(fn) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) fn(); });
    window.addEventListener('pagehide', fn);
    plugin('App')?.addListener?.('pause', fn);
  },

  onResume(fn) {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); });
    plugin('App')?.addListener?.('resume', fn);
  },

  /** kind: 'light' | 'medium' | 'success' | 'warning' */
  haptic(kind = 'light') {
    if (!this.hapticsOn) return;
    const H = plugin('Haptics');
    try {
      if (H) {
        if (kind === 'success') H.notification?.({ type: 'SUCCESS' });
        else if (kind === 'warning') H.impact?.({ style: 'MEDIUM' });
        else H.impact?.({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
        return;
      }
      navigator.vibrate?.(kind === 'success' ? [12, 40, 18] : kind === 'warning' ? 22 : 8);
    } catch { /* desteklenmiyor */ }
  },

  async hideSplash() {
    try { await plugin('SplashScreen')?.hide?.(); } catch { /* yok */ }
  },
};
