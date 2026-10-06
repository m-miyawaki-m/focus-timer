import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '../src/config.js';
import {
  normalizeTimer,
  dur,
  longEvery,
  remaining,
  start,
  pause,
  resetTo,
  afterFocus,
  finishRun,
  isDue,
  focusSession,
} from '../src/core/timer.js';

const SET = { ...APP_CONFIG.DEFAULTS }; // 集中 25 分
const MIN = 60000;

describe('timer', () => {
  it('normalizeTimer は足りない項目を埋め、保存した値を残す', () => {
    expect(normalizeTimer(null)).toEqual({
      mode: 'focus',
      running: false,
      endAt: 0,
      remainingMs: null,
      accMs: 0,
      resumedAt: 0,
      startAt: 0,
      cycle: 0,
      subject: null,
    });
    expect(normalizeTimer({ cycle: 3, taskId: 'x' })).toMatchObject({
      cycle: 3,
      taskId: 'x',
      mode: 'focus',
    });
  });

  it('dur は設定の分。0 や数でない値は初期値', () => {
    expect(dur('focus', SET)).toBe(25 * MIN);
    expect(dur('short', { ...SET, short: 0 })).toBe(5 * MIN);
    expect(dur('long', { ...SET, long: 'abc' })).toBe(15 * MIN);
  });

  it('longEvery は 2 より小さくしない', () => {
    expect(longEvery({ longEvery: 1 })).toBe(2);
    expect(longEvery({ longEvery: 0 })).toBe(4);
  });

  it('始める・止める・再開で、動いた時間だけを数える', () => {
    let t = start(normalizeTimer(null), SET, 1000);
    expect(t).toMatchObject({
      running: true,
      endAt: 1000 + 25 * MIN,
      resumedAt: 1000,
      startAt: 1000,
    });
    expect(remaining(t, SET, 1000 + MIN)).toBe(24 * MIN);

    t = pause(t, 1000 + MIN);
    expect(t).toMatchObject({ running: false, accMs: MIN, remainingMs: 24 * MIN });
    expect(remaining(t, SET, 999999)).toBe(24 * MIN);

    t = start(t, SET, 500000);
    expect(t).toMatchObject({ running: true, endAt: 500000 + 24 * MIN, startAt: 1000 });
  });

  it('動いているときの start、止まっているときの pause は何もしない', () => {
    const run = start(normalizeTimer(null), SET, 1000);
    expect(start(run, SET, 2000)).toBe(run);
    const idle = normalizeTimer(null);
    expect(pause(idle, 2000)).toBe(idle);
  });

  it('始める前の remaining はモードの長さ', () => {
    expect(remaining(normalizeTimer({ mode: 'short' }), SET, 0)).toBe(5 * MIN);
  });

  it('resetTo はモードの最初に戻し、cycle・taskId は残す', () => {
    const t = resetTo(
      {
        ...normalizeTimer({ cycle: 2, taskId: 'x' }),
        running: true,
        accMs: 5,
        startAt: 9,
        resumedAt: 9,
        remainingMs: 3,
      },
      'short',
    );
    expect(t).toMatchObject({
      mode: 'short',
      running: false,
      remainingMs: null,
      accMs: 0,
      startAt: 0,
      resumedAt: 0,
      cycle: 2,
      taskId: 'x',
    });
  });

  it('afterFocus は cycle を足し、回数ごとに長休憩', () => {
    expect(afterFocus(normalizeTimer({ cycle: 0 }), SET)).toMatchObject({
      cycle: 1,
      mode: 'short',
    });
    expect(afterFocus(normalizeTimer({ cycle: 3 }), SET)).toMatchObject({ cycle: 4, mode: 'long' });
    expect(afterFocus(normalizeTimer({ cycle: 1 }), { ...SET, longEvery: 2 })).toMatchObject({
      cycle: 2,
      mode: 'long',
    });
  });

  it('閉じている間に時間を過ぎていたら isDue、finishRun で終わりまでを数える', () => {
    const t = start(normalizeTimer(null), SET, 1000);
    expect(isDue(t, t.endAt - 1)).toBe(false);
    expect(isDue(t, t.endAt + 3600000)).toBe(true);
    expect(finishRun(t)).toMatchObject({ running: false, accMs: 25 * MIN });
    const idle = normalizeTimer(null);
    expect(isDue(idle, Infinity)).toBe(false);
    expect(finishRun(idle)).toEqual(idle);
  });

  it('focusSession は 1 分未満なら null', () => {
    const t = { ...normalizeTimer(null), accMs: 29000, startAt: 1000 };
    expect(focusSession(t, 50000, { task: null, subject: '簿記論', memo: '', id: 'i' })).toBeNull();
  });

  it('focusSession は分を丸め、タスクがあればその科目と名前を付ける', () => {
    const t = { ...normalizeTimer(null), accMs: 90000, startAt: 1000 };
    expect(focusSession(t, 100000, { task: null, subject: '簿記論', memo: 'm', id: 'i' })).toEqual({
      id: 'i',
      start: 1000,
      end: 100000,
      min: 2,
      subject: '簿記論',
      memo: 'm',
    });
    const task = { id: 'k', title: '過去問', subject: '応用情報' };
    expect(focusSession(t, 100000, { task, subject: '簿記論', memo: '', id: 'i' })).toMatchObject({
      subject: '応用情報',
      taskId: 'k',
      task: '過去問',
    });
  });

  it('focusSession は startAt が無ければ終わりから動いた時間を引いて始まりにする', () => {
    const t = { ...normalizeTimer(null), accMs: 120000, startAt: 0 };
    expect(focusSession(t, 500000, { task: null, subject: 's', memo: '', id: 'i' }).start).toBe(
      380000,
    );
  });
});
