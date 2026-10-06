/* 見た目（シンプル・グラデーション・アニメ）の切り替えと、集中中の自動非表示 */
import { APP_CONFIG } from '../config.js';
import { $, RM } from './dom.js';

const { MODE_LABEL } = APP_CONFIG;
const LOOKS = ['simple', 'grad', 'anim'];
const LOOK_LBL = { simple: 'シンプル', grad: 'グラデーション', anim: 'アニメ' };
const IDLE_MS = 3000;

let ctx;
let look = 'simple';
let idleTimer = null;
let suppressTap = false;

export function init(c) {
  ctx = c;
  look = ctx.store.getLook();
  if (!LOOKS.includes(look)) look = 'simple';

  ['mousemove', 'keydown', 'wheel'].forEach((ev) => document.addEventListener(ev, wake, { passive: true }));
  // 消えているときのタッチは、戻すだけでタイマーは止めない
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (document.body.classList.contains('idle') && e.pointerType !== 'mouse') {
        suppressTap = true;
        setTimeout(() => (suppressTap = false), 600);
      }
      wake();
    },
    { capture: true, passive: true },
  );

  $('modePill').onclick = () => {
    const f = $('lookFade');
    if (!RM) {
      f.classList.add('hold');
      f.style.background = lookColor();
      f.style.opacity = '1';
      void f.offsetWidth;
      f.classList.remove('hold');
    }
    look = LOOKS[(LOOKS.indexOf(look) + 1) % 3];
    ctx.store.setLook(look);
    applyLook();
    if (!RM) requestAnimationFrame(() => requestAnimationFrame(() => (f.style.opacity = '0')));
  };
}

// 自動非表示のあとのタップなら true を返し、一度だけ打ち消す
export function consumeSuppressedTap() {
  if (!suppressTap) return false;
  suppressTap = false;
  return true;
}

function canIdle() {
  const t = ctx.store.state.t;
  return (
    t.running &&
    t.mode === 'focus' &&
    !$('tab-timer').hidden &&
    !$('taskDrawer').classList.contains('open') &&
    !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))
  );
}

function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (canIdle()) document.body.classList.add('idle');
  }, IDLE_MS);
}

// タイマーの状態が変わったとき: 隠してよければ数え直し、だめなら出す
export function updateIdle() {
  if (canIdle()) wake();
  else {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
  }
}

function sceneNow() {
  if (look !== 'anim') return 'none';
  const { settings, t } = ctx.store.state;
  if (t.mode === 'focus') return settings.bgFocus === 'glass' ? 'glass' : 'snow';
  return settings.bgBreak === 'same' ? (settings.bgFocus === 'glass' ? 'glass' : 'snow') : 'fire';
}

export function applyLook() {
  const root = document.documentElement;
  root.dataset.look = look === 'simple' ? '' : 'grad';
  const sc = sceneNow();
  if (sc === 'none') root.removeAttribute('data-scene');
  else root.dataset.scene = sc;
  pillText();
  ctx.setScene(sc);
}

export function pillText() {
  const mode = ctx.store.state.t.mode;
  $('modePill').textContent = MODE_LABEL[mode] + '：' + LOOK_LBL[look];
  $('modePill').setAttribute('aria-label', MODE_LABEL[mode] + '。表示：' + LOOK_LBL[look] + '（押すと切り替え）');
}

function lookColor() {
  if (look === 'anim') return ctx.sceneColor(sceneNow());
  if (look === 'grad') return { focus: '#24357F', short: '#1F8AA6', long: '#8A7ADB' }[ctx.store.state.t.mode];
  return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#EEF1F5';
}
