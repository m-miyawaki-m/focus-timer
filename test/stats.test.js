import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '../src/config.js';
import {
  allSessions,
  summarize,
  lastDays,
  subjectOrder,
  weekBySubject,
  historyGroups,
  todayPomos,
  colorOf,
} from '../src/core/stats.js';
import { dayKey } from '../src/core/time.js';

const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const s = (id, start, min, subject, extra = {}) => ({
  id,
  start,
  end: start + min * 60000,
  min,
  subject,
  memo: '',
  ...extra,
});

// 2026-10-07 は水曜
const NOW = at(2026, 10, 7, 10);
const A = s('a', at(2026, 10, 7, 9), 30, '応用情報'); // 今日
const B = s('b', at(2026, 10, 6, 20), 60, '簿記論'); // 昨日（今週）
const C = s('c', at(2026, 10, 5, 8), 15, '応用情報'); // 月曜（今週）
const D = s('d', at(2026, 10, 4, 21), 45, '簿記論'); // 日曜（先週・今月）
const E = s('e', at(2026, 9, 30, 10), 20, 'その他'); // 先月
const ALL = [E, D, C, B, A];

describe('stats', () => {
  it('allSessions は月ごとの記録を 1 つの配列にする', () => {
    expect(allSessions({ '2026-09': [E], '2026-10': [D, C] })).toEqual([E, D, C]);
  });

  it('summarize は今日・今週（月曜から）・今月・連続日数を出す', () => {
    expect(summarize(ALL, NOW)).toEqual({ today: 30, week: 105, month: 150, streak: 4 });
  });

  it('今日の記録が無ければ、連続日数は昨日から数える', () => {
    expect(summarize(ALL, at(2026, 10, 8, 10)).streak).toBe(4);
  });

  it('昨日も無ければ連続日数は 0', () => {
    expect(summarize(ALL, at(2026, 10, 9, 10)).streak).toBe(0);
  });

  it('lastDays は今日までの 14 日を古い順に、科目ごとの分で出す', () => {
    const days = lastDays(ALL, NOW, 14);
    expect(days).toHaveLength(14);
    expect(dayKey(days[13].date)).toBe('2026-10-07');
    expect(dayKey(days[0].date)).toBe('2026-09-24');
    expect(days[13].bySubject).toEqual({ 応用情報: 30 });
    expect(days[12].bySubject).toEqual({ 簿記論: 60 });
    expect(days[6].bySubject).toEqual({ その他: 20 });
    expect(days[5].bySubject).toEqual({});
  });

  it('subjectOrder は設定の科目の後ろに、設定に無い科目を足す', () => {
    expect(subjectOrder(['応用情報', '簿記論'], ALL)).toEqual(['応用情報', '簿記論', 'その他']);
  });

  it('weekBySubject は今週の科目ごとの分を多い順に出す', () => {
    expect(weekBySubject(ALL, NOW)).toEqual([
      ['簿記論', 60],
      ['応用情報', 45],
    ]);
  });

  it('historyGroups は新しい順に limit 件を日ごとにまとめる', () => {
    expect(historyGroups(ALL, 60).map(([k]) => k)).toEqual([
      '2026-10-07',
      '2026-10-06',
      '2026-10-05',
      '2026-10-04',
      '2026-09-30',
    ]);
    expect(historyGroups(ALL, 2)).toEqual([
      ['2026-10-07', [A]],
      ['2026-10-06', [B]],
    ]);
  });

  it('todayPomos は今日の手動でない記録を数える', () => {
    const manual = s('m', at(2026, 10, 7, 8), 10, '応用情報', { manual: true });
    expect(todayPomos([...ALL, manual], NOW)).toBe(1);
  });

  it('colorOf は科目の並び順の色、設定に無い科目は科目の数の位置の色', () => {
    const { COLORS } = APP_CONFIG;
    expect(colorOf('簿記論', ['応用情報', '簿記論'])).toBe(COLORS[1]);
    expect(colorOf('その他', ['応用情報', '簿記論'])).toBe(COLORS[2]);
  });
});
