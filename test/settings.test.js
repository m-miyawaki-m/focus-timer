import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '../src/config.js';
import { clampInt, parseSubjects, settingsFromForm } from '../src/core/settings.js';

const FORM = {
  focus: '30',
  short: '5',
  long: '20',
  longEvery: '3',
  weeklyGoalH: '10',
  autoBreak: true,
  subjects: '簿記論\n応用情報',
  bgFocus: 'glass',
  bgBreak: 'same',
  bgSpeed: '80',
  fireworks: false,
};

describe('settings', () => {
  it('clampInt は丸めて、範囲の外なら初期値', () => {
    expect(clampInt('30.4', 1, 180, 25)).toBe(30);
    expect(clampInt('0', 1, 180, 25)).toBe(25);
    expect(clampInt('', 1, 180, 25)).toBe(25);
    expect(clampInt('abc', 1, 180, 25)).toBe(25);
  });

  it('parseSubjects は空行・前後の空白・重複を除き、12 個まで', () => {
    expect(parseSubjects(' 簿記論 \n\n応用情報\n簿記論')).toEqual(['簿記論', '応用情報']);
    const many = Array.from({ length: 15 }, (_, i) => 's' + i).join('\n');
    expect(parseSubjects(many)).toHaveLength(12);
  });

  it('settingsFromForm は欄の値を設定にし、ほかの項目は前の値を残す', () => {
    expect(settingsFromForm({ extra: 1 }, FORM)).toEqual({
      extra: 1,
      focus: 30,
      short: 5,
      long: 20,
      longEvery: 3,
      weeklyGoalH: 10,
      autoBreak: true,
      subjects: ['簿記論', '応用情報'],
      bgFocus: 'glass',
      bgBreak: 'same',
      bgSpeed: 80,
      fireworks: false,
    });
  });

  it('範囲の外は決まった初期値、科目が空なら初期の科目、背景は知らない値なら初期', () => {
    const s = settingsFromForm({}, {
      ...FORM,
      focus: '999',
      short: '0',
      long: '-1',
      longEvery: '1',
      weeklyGoalH: '200',
      subjects: '\n \n',
      bgFocus: 'x',
      bgBreak: 'x',
      bgSpeed: '5',
    });
    expect(s).toMatchObject({
      focus: 25,
      short: 5,
      long: 15,
      longEvery: 4,
      weeklyGoalH: 15,
      subjects: APP_CONFIG.DEFAULTS.subjects,
      bgFocus: 'snow',
      bgBreak: 'fire',
      bgSpeed: 50,
    });
  });
});
