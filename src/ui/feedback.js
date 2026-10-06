/* トースト・保存できなかったときの表示・終了の音 */
import { $ } from './dom.js';

let toastTimer;
export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export function setSync(msg) {
  $('sync').textContent = msg;
}

let actx = null;
// 音はユーザーの操作の中で使えるようにする（開始のとき）
export function ensureAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) {}
}

export function chime() {
  if (!actx) return;
  [880, 1175, 1568].forEach((f, i) => {
    const o = actx.createOscillator();
    const g = actx.createGain();
    const s = actx.currentTime + i * 0.22;
    o.frequency.value = f;
    o.type = 'sine';
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.25, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.6);
    o.connect(g).connect(actx.destination);
    o.start(s);
    o.stop(s + 0.65);
  });
}
