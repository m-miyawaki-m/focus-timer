import { describe, it, expect } from 'vitest';
import { pad, dayKey, monthKey, hm, fmt, genId, startOfDay, weekStart } from '../src/core/time.js';

const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('time', () => {
  it('pad は 2 桁にする', () => {
    expect(pad(3)).toBe('03');
    expect(pad(12)).toBe('12');
  });

  it('dayKey・monthKey・hm は端末の時刻で書く', () => {
    const ts = at(2026, 10, 6, 9, 5);
    expect(dayKey(ts)).toBe('2026-10-06');
    expect(monthKey(ts)).toBe('2026-10');
    expect(hm(ts)).toBe('09:05');
  });

  it('fmt は分を丸めて「○時間○分」にする', () => {
    expect(fmt(0)).toBe('0分');
    expect(fmt(59.4)).toBe('59分');
    expect(fmt(59.6)).toBe('1時間');
    expect(fmt(60)).toBe('1時間');
    expect(fmt(65)).toBe('1時間5分');
    expect(fmt(150)).toBe('2時間30分');
  });

  it('genId は毎回違う文字列', () => {
    const a = genId();
    const b = genId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });

  it('startOfDay はその日の 0 時', () => {
    expect(startOfDay(new Date(at(2026, 10, 6, 15, 30))).getTime()).toBe(at(2026, 10, 6));
  });

  it('weekStart は月曜 0 時', () => {
    expect(weekStart(at(2026, 10, 6, 15)).getTime()).toBe(at(2026, 10, 5)); // 火 → 月
    expect(weekStart(at(2026, 10, 5, 0)).getTime()).toBe(at(2026, 10, 5)); // 月 → 同じ日
    expect(weekStart(at(2026, 10, 11, 23)).getTime()).toBe(at(2026, 10, 5)); // 日 → 6 日前
  });
});
