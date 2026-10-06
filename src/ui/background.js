/* canvas の背景（窓の雨・マリンスノーとクラゲ・夜空の花火）と、集中を終えたときの花火 */
import { $, RM } from './dom.js';

let ctx;
const bg = { cv: null, cx: null, W: 0, H: 0, d: 1, scene: 'none', parts: [], sparks: [], next: 0, cele: 0, celeN: 0, running: false, t0: 0 };
const BGC = { glass: '#16222f', snow: '#040f1f', fire: '#0a0f24' };
const rnd = (a, b) => a + Math.random() * (b - a);

export function init(c) {
  ctx = c;
  bg.cv = $('bgc');
  bg.cx = bg.cv.getContext('2d');
  bgSize();
  addEventListener('resize', () => {
    bgSize();
    bgInit();
  });
}

// 見た目を切り替えるときにかぶせる色
export const sceneColor = (sc) => BGC[sc] || '#0b1220';

function bgSize() {
  bg.d = Math.min(2, window.devicePixelRatio || 1);
  bg.W = bg.cv.width = innerWidth * bg.d;
  bg.H = bg.cv.height = innerHeight * bg.d;
}

export function bgInit() {
  const W = bg.W, H = bg.H, d = bg.d;
  bg.parts = [];
  const n = { glass: 35, snow: 90, fire: 70, none: 0 }[bg.scene];
  for (let i = 0; i < n; i++) bg.parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1, 4), v: rnd(0.3, 1), p: rnd(0, 6.28), hold: rnd(0, 200) });
  if (bg.scene === 'glass')
    for (let i = 0; i < 26; i++)
      bg.parts.push({ bokeh: 1, x: rnd(0, W), y: rnd(0, H), r: rnd(15, 45) * d, c: ['#f2b35a', '#e86b6b', '#6bb5e8'][i % 3], p: rnd(0, 6.28) });
  if (bg.scene !== 'none') {
    bg.cx.fillStyle = BGC[bg.scene];
    bg.cx.fillRect(0, 0, W, H);
  }
}

function spd() {
  return ((Number(ctx.store.state.settings.bgSpeed) || 50) / 100) * (RM ? 0.3 : 1);
}

export function setScene(sc) {
  if (sc === bg.scene) return;
  bg.scene = sc;
  bgInit();
  bgLoop();
}

function bgLoop() {
  if (!bg.running && (bg.scene !== 'none' || bg.sparks.length || bg.cele)) {
    bg.running = true;
    bg.t0 = performance.now();
    requestAnimationFrame(bgDraw);
  }
}

function burst(big) {
  const W = bg.W, H = bg.H, d = bg.d, x = rnd(W * 0.15, W * 0.85), y = rnd(H * 0.12, H * 0.42);
  const hues = ['255,190,120', '255,140,160', '150,200,255', '200,170,255', '255,230,150'];
  const c = hues[Math.floor(rnd(0, hues.length))];
  const n = big ? 110 : 70;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + rnd(-0.05, 0.05);
    const v = rnd(0.6, 1) * (big ? 2.6 : 1.8) * d;
    bg.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c, decay: rnd(0.006, 0.01) });
  }
}

// 集中を終えたときの花火（アニメの見た目でなくても上に重ねて出す）
export function celebrate() {
  if (!ctx.store.state.settings.fireworks || RM) return;
  bg.celeN = 0;
  bg.cele = performance.now();
  if (bg.scene === 'none') bg.cv.classList.add('overlay');
  bgLoop();
}

function bgDraw(now) {
  const cx = bg.cx, W = bg.W, H = bg.H, d = bg.d;
  const dt = Math.min(50, now - bg.t0) / 16;
  bg.t0 = now;
  const s = dt * spd();
  if (bg.scene === 'none' && !bg.sparks.length && !bg.cele) {
    cx.clearRect(0, 0, W, H);
    bg.cv.classList.remove('overlay');
    bg.running = false;
    return;
  }
  if (bg.scene === 'none') cx.clearRect(0, 0, W, H);
  else if (bg.scene === 'fire') {
    cx.fillStyle = 'rgba(10,15,36,' + (0.12 + 0.1 * spd()) + ')';
    cx.fillRect(0, 0, W, H);
    bg.parts.forEach((p) => {
      cx.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.15 * Math.sin(now / 3000 + p.p)) + ')';
      cx.fillRect(p.x, p.y * 0.6, d, d);
    });
    if (now > bg.next) {
      if (bg.next) burst(false);
      bg.next = now + rnd(3500, 6500) / spd();
    }
  } else {
    cx.fillStyle = BGC[bg.scene];
    cx.fillRect(0, 0, W, H);
    if (bg.scene === 'glass') {
      bg.parts.forEach((p) => {
        if (p.bokeh) {
          cx.globalAlpha = 0.12 + 0.04 * Math.sin(now / 5000 + p.p);
          cx.fillStyle = p.c;
          cx.beginPath();
          cx.arc(p.x, p.y, p.r, 0, 7);
          cx.fill();
        }
      });
      cx.globalAlpha = 1;
      bg.parts.forEach((p) => {
        if (p.bokeh) return;
        p.hold -= s;
        let v = 0.05 * p.v;
        if (p.hold < 0) {
          v = 0.9 * p.v;
          if (p.hold < -40) p.hold = rnd(150, 500);
        }
        p.y += v * s * d;
        if (p.y > H + 20) {
          p.y = -10;
          p.x = rnd(0, W);
        }
        cx.strokeStyle = 'rgba(200,220,240,.14)';
        cx.lineWidth = p.r * 0.7 * d;
        cx.beginPath();
        cx.moveTo(p.x, p.y - p.r * 7 * d);
        cx.lineTo(p.x, p.y);
        cx.stroke();
        cx.fillStyle = 'rgba(220,235,250,.5)';
        cx.beginPath();
        cx.arc(p.x, p.y, p.r * 1.3 * d, 0, 7);
        cx.fill();
      });
    } else {
      bg.parts.forEach((p) => {
        p.y += p.v * 0.12 * s * d;
        p.x += Math.sin(now / 6000 + p.p) * 0.05 * d * spd();
        if (p.y > H + 5) {
          p.y = -5;
          p.x = rnd(0, W);
        }
        cx.fillStyle = 'rgba(220,235,255,' + (0.22 + p.r * 0.07) + ')';
        cx.beginPath();
        cx.arc(p.x, p.y, p.r * 0.6 * d, 0, 7);
        cx.fill();
      });
      // クラゲ
      const ph = (now / 1000) * spd();
      const jx = W * 0.78 + Math.sin(ph * 0.06) * W * 0.04;
      const jy = H * 0.62 + Math.sin(ph * 0.09) * H * 0.05;
      const pu = 1 + 0.08 * Math.sin(ph * 0.5);
      const jr = Math.min(W, H) * 0.08;
      cx.fillStyle = 'rgba(190,160,255,.24)';
      cx.beginPath();
      cx.ellipse(jx, jy, jr * pu, (jr * 0.75) / pu, 0, Math.PI, 0);
      cx.fill();
      cx.strokeStyle = 'rgba(200,175,255,.28)';
      cx.lineWidth = 1.5 * d;
      for (let i = 0; i < 6; i++) {
        const tx = jx - jr * 0.8 + i * jr * 0.32;
        cx.beginPath();
        cx.moveTo(tx, jy);
        for (let y = 0; y < jr * 2.6; y += 4 * d) cx.lineTo(tx + Math.sin(y / (22 * d) + ph * 0.5 + i) * 4 * d, jy + y);
        cx.stroke();
      }
    }
  }
  if (bg.cele && now > bg.cele) {
    burst(true);
    bg.celeN++;
    bg.cele = bg.celeN >= 6 ? 0 : now + rnd(280, 480);
  }
  const k = dt * 0.8;
  bg.sparks.forEach((p) => {
    p.x += p.vx * k;
    p.y += p.vy * k;
    p.vx *= Math.pow(0.985, k);
    p.vy = p.vy * Math.pow(0.985, k) + 0.02 * k * d;
    p.life -= p.decay * k;
    cx.fillStyle = 'rgba(' + p.c + ',' + Math.max(0, p.life) + ')';
    cx.beginPath();
    cx.arc(p.x, p.y, 1.6 * d, 0, 7);
    cx.fill();
  });
  bg.sparks = bg.sparks.filter((p) => p.life > 0 && p.y < H + 20);
  requestAnimationFrame(bgDraw);
}
