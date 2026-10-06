/* 設定の欄の値を設定にする（DOM を使わない） */
import { APP_CONFIG } from '../config.js';

const { DEFAULTS } = APP_CONFIG;

export const MAX_SUBJECTS = 12;

// 丸めて、範囲の外なら def
export function clampInt(value, lo, hi, def) {
  const v = Math.round(Number(value));
  return v >= lo && v <= hi ? v : def;
}

export function parseSubjects(text) {
  return [
    ...new Set(
      text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_SUBJECTS);
}

// 範囲の外のときの値は、今の作りのとおり決まった数（DEFAULTS ではない）
export function settingsFromForm(prev, f) {
  const subs = parseSubjects(f.subjects);
  return {
    ...prev,
    focus: clampInt(f.focus, 1, 180, 25),
    short: clampInt(f.short, 1, 60, 5),
    long: clampInt(f.long, 1, 90, 15),
    longEvery: clampInt(f.longEvery, 2, 10, 4),
    weeklyGoalH: clampInt(f.weeklyGoalH, 1, 100, 15),
    autoBreak: !!f.autoBreak,
    subjects: subs.length ? subs : DEFAULTS.subjects.slice(),
    bgFocus: f.bgFocus === 'glass' ? 'glass' : 'snow',
    bgBreak: f.bgBreak === 'same' ? 'same' : 'fire',
    bgSpeed: clampInt(f.bgSpeed, 10, 150, 50),
    fireworks: !!f.fireworks,
  };
}
