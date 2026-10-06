/* タイマーの状態の遷移（DOM を使わない）。どれも新しい状態を返す */
import { APP_CONFIG } from '../config.js';

const { DEFAULTS } = APP_CONFIG;

export function normalizeTimer(saved) {
  return {
    mode: 'focus',
    running: false,
    endAt: 0,
    remainingMs: null,
    accMs: 0,
    resumedAt: 0,
    startAt: 0,
    cycle: 0,
    subject: null,
    ...(saved || {}),
  };
}

export const dur = (mode, settings) =>
  Math.max(1, Number(settings[mode]) || DEFAULTS[mode]) * 60000;

export const longEvery = (settings) => Math.max(2, Number(settings.longEvery) || 4);

export function remaining(t, settings, now) {
  return t.running ? Math.max(0, t.endAt - now) : (t.remainingMs ?? dur(t.mode, settings));
}

export function start(t, settings, now) {
  if (t.running) return t;
  const rem = remaining(t, settings, now);
  return { ...t, running: true, endAt: now + rem, resumedAt: now, startAt: t.startAt || now };
}

export function pause(t, now) {
  if (!t.running) return t;
  return {
    ...t,
    accMs: t.accMs + (now - t.resumedAt),
    remainingMs: Math.max(0, t.endAt - now),
    running: false,
  };
}

export function resetTo(t, mode) {
  return { ...t, mode, running: false, remainingMs: null, accMs: 0, startAt: 0, resumedAt: 0 };
}

// 集中を終えたあと: cycle を足し、回数ごとに長休憩
export function afterFocus(t, settings) {
  const cycle = (t.cycle || 0) + 1;
  return resetTo({ ...t, cycle }, cycle % longEvery(settings) === 0 ? 'long' : 'short');
}

// 時間切れ: 終わる時刻までを動いた時間に足して止める
export function finishRun(t) {
  if (!t.running) return { ...t };
  return { ...t, accMs: t.accMs + (t.endAt - t.resumedAt), running: false };
}

export const isDue = (t, now) => t.running && now >= t.endAt;

// 集中の記録。1 分未満なら null
export function focusSession(t, endTs, { task, subject, memo, id }) {
  const min = Math.round(t.accMs / 60000);
  if (min < 1) return null;
  const sess = {
    id,
    start: t.startAt || endTs - t.accMs,
    end: endTs,
    min,
    subject: task ? task.subject : subject,
    memo,
  };
  if (task) {
    sess.taskId = task.id;
    sess.task = task.title;
  }
  return sess;
}
