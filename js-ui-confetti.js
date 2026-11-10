// Bölüm sonu konfetisi: ekranın altından en üstüne kadar fırlayan sarı ve lacivert kâğıtlar.
// Tam ekran, dokunmaları engellemeyen geçici bir tuval; bitince kendini kaldırır.

const COLORS = ['#FFD400', '#FFE600', '#FFC400', '#1A2A8C', '#0D1B6E', '#2438B0'];

export function launchConfetti({ count = 140, reduced = false } = {}) {
  if (reduced) return;
  const W = window.innerWidth, H = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.cssText = `position:fixed;inset:0;width:${W}px;height:${H}px;pointer-events:none;z-index:60`;
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const grav = 0.35; // px/kare²
  // En üste ulaşacak hız: v = √(2·g·yükseklik)
  const vTop = Math.sqrt(2 * grav * H);
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const side = i % 3; // sol alt köşe, sağ alt köşe, alt orta
    const x0 = side === 0 ? W * 0.08 : side === 1 ? W * 0.92 : W * (0.35 + Math.random() * 0.3);
    const spread = side === 0 ? 0.35 : side === 1 ? -0.35 : (Math.random() - 0.5) * 0.6;
    const speed = vTop * (0.9 + Math.random() * 0.28);
    pieces.push({
      x: x0, y: H + 10,
      vx: speed * spread * (0.6 + Math.random() * 0.8),
      vy: -speed,
      w: 6 + Math.random() * 7, h: 9 + Math.random() * 10,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      flip: Math.random() * Math.PI, vf: 0.12 + Math.random() * 0.18,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      delay: Math.floor(Math.random() * 10),
    });
  }

  let frame = 0, raf = 0;
  const step = () => {
    frame++;
    g.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of pieces) {
      if (frame < p.delay) { alive++; continue; }
      p.vy += grav;
      p.vx *= 0.99;
      if (p.vy > 0) { p.vy = Math.min(p.vy, 3.2); p.vx += Math.sin(frame * 0.08 + p.flip) * 0.12; } // tepeden süzülerek iner
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr; p.flip += p.vf;
      if (p.y > H + 30) continue;
      alive++;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.scale(1, Math.cos(p.flip)); // kâğıdın dönerken ince görünmesi
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (alive && frame < 420) raf = requestAnimationFrame(step);
    else cv.remove();
  };
  raf = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(raf); cv.remove(); };
}
