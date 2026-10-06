/* タイマーの画面: 文字盤・ボタン・キー操作と、終わったときの処理 */
import { APP_CONFIG } from '../config.js';
import { pad, genId } from '../core/time.js';
import * as TM from '../core/timer.js';
import { activeTask, incrementDone } from '../core/tasks.js';
import { $ } from './dom.js';

const { MODE_LABEL } = APP_CONFIG;
const CIRC = 2 * Math.PI * 140;

let ctx;
const S = () => ctx.store.state;
const ticks = [];
let lastOn = -1;

export function init(c) {
  ctx = c;
  buildRing();
  $('dialBtn').onclick = toggleRun;
  $('dialBtn').onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      toggleRun();
    }
  };
  $('btnFinish').onclick = finishEarly;
  $('btnDiscard').onclick = () => {
    resetTo(S().t.mode);
    ctx.toast('リセットしました（記録はしていません）');
  };
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || $('tab-timer').hidden) return;
    if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) return;
    e.preventDefault();
    S().t.running ? pause() : start();
  });
  document.addEventListener('visibilitychange', tick);
}

// 文字盤の目盛り（60 本）と進み具合の円
function buildRing() {
  const ring = $('ring');
  const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < 60; i++) {
    const l = document.createElementNS(ns, 'line');
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const r1 = i % 5 === 0 ? 116 : 122;
    const r2 = 138;
    l.setAttribute('x1', 150 + r1 * Math.cos(a));
    l.setAttribute('y1', 150 + r1 * Math.sin(a));
    l.setAttribute('x2', 150 + r2 * Math.cos(a));
    l.setAttribute('y2', 150 + r2 * Math.sin(a));
    l.setAttribute('class', 'tick');
    ring.appendChild(l);
    ticks.push(l);
  }
  ['prog-track', 'prog'].forEach((c) => {
    const ci = document.createElementNS(ns, 'circle');
    ci.setAttribute('cx', 150);
    ci.setAttribute('cy', 150);
    ci.setAttribute('r', 140);
    ci.setAttribute('class', c);
    if (c === 'prog') {
      ci.setAttribute('transform', 'rotate(-90 150 150)');
      ci.setAttribute('stroke-dasharray', CIRC);
      ci.id = 'progC';
    }
    ring.appendChild(ci);
  });
}

const setT = (t) => ctx.store.setTimer(t);

function start() {
  if (S().t.running) return;
  ctx.ensureAudio();
  setT(TM.start(S().t, S().settings, Date.now()));
  renderTimer();
}

function pause() {
  if (!S().t.running) return;
  setT(TM.pause(S().t, Date.now()));
  renderTimer();
}

function resetTo(mode) {
  setT(TM.resetTo(S().t, mode));
  renderTimer();
}

// 集中を記録する。記録した分（1 分未満なら 0）を返す
function recordFocus(endTs, countPomo) {
  const tk = activeTask(S().tasks, S().t.taskId);
  const sess = TM.focusSession(S().t, endTs, {
    task: tk,
    subject: tk ? tk.subject : ctx.store.currentSubject(),
    memo: $('memo').value.trim(),
    id: genId(),
  });
  if (!sess) return 0;
  if (tk && countPomo) ctx.store.setTasks(incrementDone(S().tasks, tk.id));
  ctx.store.addSession(sess);
  $('memo').value = '';
  return sess.min;
}

function afterFocus() {
  setT(TM.afterFocus(S().t, S().settings));
  renderTimer();
}

// 時間切れ
function complete() {
  const end = S().t.endAt;
  setT(TM.finishRun(S().t));
  ctx.chime();
  if (S().t.mode === 'focus') {
    const m = recordFocus(end, true);
    afterFocus();
    ctx.celebrate();
    ctx.toast((m ? m + '分を記録しました。' : '') + MODE_LABEL[S().t.mode] + 'に入りましょう');
    if (S().settings.autoBreak) start();
  } else {
    resetTo('focus');
    ctx.toast('休憩終了。次の集中を始めましょう');
  }
}

// 「記録して終了」「休憩をスキップ」
function finishEarly() {
  if (S().t.mode !== 'focus') {
    resetTo('focus');
    ctx.toast('休憩をスキップしました');
    return;
  }
  if (S().t.running) pause();
  const m = recordFocus(Date.now(), false);
  if (m) {
    afterFocus();
    ctx.toast(m + '分を記録しました');
  } else {
    resetTo('focus');
    ctx.toast('1分未満のため記録しませんでした');
  }
}

export function tick() {
  if (TM.isDue(S().t, Date.now())) complete();
  renderTime();
}

function toggleRun() {
  if (ctx.consumeSuppressedTap()) return;
  S().t.running ? pause() : start();
  const d = $('dialBtn');
  d.classList.add('pressed');
  setTimeout(() => d.classList.remove('pressed'), 120);
}

function renderTime() {
  const { t, settings } = S();
  const rem = TM.remaining(t, settings, Date.now());
  const total = TM.dur(t.mode, settings);
  const s = Math.ceil(rem / 1000);
  const txt = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  $('time').textContent = txt;
  document.title = (t.running ? txt + ' ' + MODE_LABEL[t.mode] + ' | ' : '') + '集中タイマー';
  const on = Math.ceil(Math.min(1, rem / total) * 60);
  if (on !== lastOn) {
    ticks.forEach((l, i) => l.classList.toggle('on', i < on));
    lastOn = on;
  }
  $('progC').setAttribute('stroke-dashoffset', CIRC * (1 - Math.min(1, rem / total)));
}

export function renderTimer() {
  const { t, settings } = S();
  ctx.updateIdle();
  $('tab-timer').dataset.mode = t.mode;
  ctx.pillText();
  $('modeLabel').textContent = t.running ? (t.mode === 'focus' ? 'Focusing' : 'On break') : t.remainingMs !== null ? 'Paused' : 'Ready';
  const every = TM.longEvery(settings);
  const done = (t.cycle || 0) % every;
  $('cycleDots').innerHTML = Array.from({ length: every }, (_, i) => '<i class="' + (i < done ? 'done' : '') + '"></i>').join('');
  $('cycleDots').setAttribute('aria-label', every + '回中' + done + '回完了');
  const started = t.running || t.remainingMs !== null;
  const lbl = t.running ? '一時停止' : started ? '再開' : '開始';
  $('dialBtn').setAttribute('aria-label', lbl + '（タイマーを押して切り替え）');
  const paused = !t.running && t.remainingMs !== null;
  $('icoPath').setAttribute('d', t.running ? 'M12 7a5 5 0 1 0 0.001 0z' : paused ? 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' : 'M8 5.5v13l10.5-6.5z');
  document.querySelector('.state').classList.toggle('live', t.running);
  document.body.dataset.mode = t.mode;
  ctx.applyLook();
  ctx.renderNow();
  $('btnFinish').textContent = t.mode === 'focus' ? '記録して終了' : '休憩をスキップ';
  $('btnFinish').disabled = t.mode === 'focus' && !started;
  $('btnDiscard').disabled = !started;
  lastOn = -1;
  renderTime();
}
