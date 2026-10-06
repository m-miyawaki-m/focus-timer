import { describe, it, expect } from 'vitest';
import { csvText, backupJson, parseBackup, mergeBackup } from '../src/core/backup.js';

const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('backup', () => {
  it('csvText は BOM 付き・古い順・全部の欄を " で囲み、" は重ねる', () => {
    const s1 = { id: '1', start: at(2026, 10, 6, 9, 5), end: at(2026, 10, 6, 9, 35), min: 30, subject: '簿記論', memo: 'a"b' };
    const s2 = { id: '2', start: at(2026, 10, 7, 8), end: at(2026, 10, 7, 8, 10), min: 10, subject: '応用情報', memo: '', task: '過去問', manual: true };
    expect(csvText([s2, s1])).toBe(
      '\ufeff' +
        [
          '"日付","開始","終了","分","科目","タスク","メモ","手動"',
          '"2026-10-06","09:05","09:35","30","簿記論","","a""b",""',
          '"2026-10-07","08:00","08:10","10","応用情報","過去問","","1"',
        ].join('\r\n'),
    );
  });

  it('backupJson は app・version・exportedAt と中身', () => {
    const now = Date.UTC(2026, 9, 6, 12);
    const text = backupJson({ settings: { focus: 25 }, months: { '2026-10': [] }, tasks: [] }, now);
    expect(JSON.parse(text)).toEqual({
      app: 'focus-timer',
      version: 1,
      exportedAt: '2026-10-06T12:00:00.000Z',
      settings: { focus: 25 },
      months: { '2026-10': [] },
      tasks: [],
    });
    expect(text.startsWith('{\n "app"')).toBe(true); // 1 字下げ
  });

  it('parseBackup は JSON でない・このアプリのでないものを断る', () => {
    expect(parseBackup('x')).toEqual({ ok: false, error: 'json' });
    expect(parseBackup('null')).toEqual({ ok: false, error: 'app' });
    expect(parseBackup('{"app":"other","months":{}}')).toEqual({ ok: false, error: 'app' });
    expect(parseBackup('{"app":"focus-timer"}')).toEqual({ ok: false, error: 'app' });
    expect(parseBackup('{"app":"focus-timer","months":{}}')).toEqual({ ok: true, data: { app: 'focus-timer', months: {} } });
  });

  it('mergeBackup は id が無い記録だけ足し、形の違う月・記録は飛ばす', () => {
    const cur = { settings: { focus: 25, short: 5 }, months: { '2026-10': [{ id: 'a', start: 1, min: 5 }] }, tasks: [] };
    const r = mergeBackup(cur, {
      app: 'focus-timer',
      months: {
        '2026-10': [{ id: 'a', start: 1, min: 5 }, { id: 'b', start: 2, min: 5 }],
        bad: [{ id: 'z', start: 1, min: 1 }],
        '2026-09': [{ id: 'c', start: 3, min: 5 }, { id: 'x' }, null],
      },
    });
    expect(r.added).toBe(2);
    expect(r.months['2026-10'].map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.months['2026-09'].map((x) => x.id)).toEqual(['c']);
    expect(r.months.bad).toBeUndefined();
    expect(cur.months['2026-10']).toHaveLength(1); // 元は変えない
    expect(r.settings).toEqual(cur.settings);
  });

  it('mergeBackup はタスクを 100 件までの空きの分だけ足し、設定はファイルの値で上書き', () => {
    const tasks = Array.from({ length: 99 }, (_, i) => ({ id: 't' + i, title: 't' }));
    const r = mergeBackup(
      { settings: { focus: 25, short: 5 }, months: {}, tasks },
      {
        app: 'focus-timer',
        months: {},
        tasks: [{ id: 't0', title: 'dup' }, { id: 'n1', title: 'a' }, { id: 'n2', title: 'b' }, { id: 'n3' }],
        settings: { focus: 50 },
      },
    );
    expect(r.tAdded).toBe(1);
    expect(r.tasks).toHaveLength(100);
    expect(r.settings).toMatchObject({ focus: 50, short: 5, longEvery: 4 });
  });
});
