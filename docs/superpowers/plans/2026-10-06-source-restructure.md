# ソースの構成の整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `app.js`（485 行の即時関数）を、DOM を使わない `src/core/`・状態を持つ `src/store.js`・画面の `src/ui/` に分け、動き・見た目・保存の形を変えずに ES モジュールにする。

**Architecture:** ビルドなしの ES モジュール。依存は `ui/` → `store.js` → `core/`・`config.js` の一方向。`ui/` どうしは直接読まず、`main.js` が作る `ctx`（関数の詰め合わせ）を通して呼ぶ（例外: `ui/dom.js` の小さな道具はどこから読んでもよい）。`core/` は「今」を引数 `now` で受け取り、vitest でテストする。

**Tech Stack:** 素の JavaScript（ES モジュール）、vitest（テスト）、prettier（整形）。npm は開発のときだけ。

**Spec:** `docs/superpowers/specs/2026-10-06-source-restructure-design.md`

## Global Constraints

- 動き・見た目・文言を変えない。途中で見つけたバグらしきものは直さず、最後にまとめて報告する（後で issue にする）。
- 保存のキーと形を変えない: `pomo.data.v1`（`{settings, months, tasks}`）・`pomo.timer.v1`・`pomo.look.v1`・`pomo.drawer.v1`。
- バックアップ JSON の形を変えない: `{app:'focus-timer', version:1, exportedAt, settings, months, tasks}`（`JSON.stringify(…, null, 1)`）。
- ビルドしない。`index.html` は `<script type="module" src="src/main.js">` だけを読む。
- `core/` は DOM・localStorage・`Date.now()` を使わない（時刻は引数 `now`）。`core/` が読んでよいのは `config.js` と `core/` の中だけ。
- prettier の設定: printWidth 100、シングルクォート、セミコロンあり。
- コメントは日本語で、区切りと分かりにくい所だけ。
- 作業は `main` で行う（まだ GitHub に置いていないため）。コミットごとに `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける。
- 関数の中身は今の `app.js` から移す。整理のための書き直し（引数にする・新しい値を返す）以外は変えない。今の `app.js` の行番号は本書の各タスクに書いてある。

## Review Focus

1. 分ける前に保存した localStorage の中身（`pomo.data.v1` の JSON）が、そのまま読めて記録・タスク・設定が出ること → Task 7 の「前の形のデータを読む」テスト。
2. 前に書き出したバックアップ JSON を取り込むと、重複なく足されること → Task 6 の `mergeBackup` のテスト。
3. 集中を動かしたまま閉じ、時間を過ぎてから開くと、終わったものとして記録されること → Task 3 の `isDue`・`finishRun` のテストと Task 8 の画面の確認。
4. 別のタブで記録を足したとき、こちらのタブに出ること → Task 7 の `applyExternal` のテスト。
5. 保存に失敗したとき（容量不足・プライベートモード）、画面の下に知らせが出て、次に成功したら消えること → Task 7 の保存失敗のテスト。

---

### Task 1: 開発の道具・設定値・日付の道具

**Files:**
- Create: `package.json`, `.prettierrc`, `.prettierignore`
- Modify: `.gitignore`
- Create: `src/config.js`（今の `config.js` を ES モジュールにし、`LS_LOOK`・`LS_DRAWER` を足す。今の `config.js` は Task 8 で消す）
- Create: `src/core/time.js`
- Test: `test/time.test.js`

**Interfaces:**
- Produces:
  - `src/config.js`: `export const APP_CONFIG = {DEFAULTS, COLORS, MODE_LABEL, LS_DATA, LS_TIMER, LS_LOOK, LS_DRAWER}`
  - `src/core/time.js`: `pad(n): string`、`dayKey(ts): 'YYYY-MM-DD'`、`monthKey(ts): 'YYYY-MM'`、`hm(ts): 'HH:MM'`、`fmt(min): string`、`genId(): string`、`startOfDay(d): Date`、`weekStart(now: number): Date`（月曜 0 時）

- [ ] **Step 1: 道具を入れる**

`package.json`:

```json
{
  "name": "focus-timer",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

`.prettierrc`:

```json
{ "printWidth": 100, "singleQuote": true, "semi": true }
```

`.prettierignore`:

```
node_modules/
package-lock.json
*.md
*.png
```

`.gitignore` に `node_modules/` の行を足す。

Run: `npm i -D vitest prettier`
Expected: `package.json` に devDependencies が入り、`package-lock.json` ができる。

- [ ] **Step 2: `src/config.js` を作る**

```js
/* アプリの設定値（科目・初期値など）。ここを書き換えると初期状態が変わります。
   ※ 一度アプリで設定を保存したブラウザでは、保存済みの値（localStorage）が優先されます。 */
export const APP_CONFIG = {
  // 設定の初期値
  DEFAULTS: {
    focus: 25, // 集中（分）
    short: 5, // 小休憩（分）
    long: 15, // 長休憩（分）
    longEvery: 4, // 何回ごとに長休憩
    weeklyGoalH: 15, // 週の目標（時間）
    autoBreak: false, // 休憩を自動開始
    subjects: ['応用情報', '簿記論', '財務諸表論', 'その他'], // 科目
    bgFocus: 'snow', // 集中中の背景
    bgBreak: 'fire', // 休憩中の背景
    bgSpeed: 50, // 背景アニメの速さ
    fireworks: true, // 完了時の花火
  },
  // 科目の色（科目の並び順に割り当て）
  COLORS: ['#2F4BB8', '#1C8A6E', '#C2731A', '#8A4FB8', '#B83F5E', '#3F7FA6', '#7A8A2E', '#8C6E5A'],
  // モード表示名
  MODE_LABEL: { focus: '集中', short: '小休憩', long: '長休憩' },
  // localStorage のキー（変えると既存データが読めなくなるので注意）
  LS_DATA: 'pomo.data.v1',
  LS_TIMER: 'pomo.timer.v1',
  LS_LOOK: 'pomo.look.v1',
  LS_DRAWER: 'pomo.drawer.v1',
};
```

科目は、その時点の `config.js` の `subjects` に合わせる（ユーザーが書き換えていればそれを写す）。

- [ ] **Step 3: 失敗するテストを書く**

`test/time.test.js`:

```js
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
```

- [ ] **Step 4: 失敗を確かめる**

Run: `npx vitest run test/time.test.js`
Expected: FAIL（`src/core/time.js` が無い）

- [ ] **Step 5: `src/core/time.js` を作る**（今の `app.js` 15〜22 行）

```js
/* 日付・時間の道具（DOM を使わない） */
export const pad = (n) => String(n).padStart(2, '0');

export function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function monthKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}

export function hm(ts) {
  const d = new Date(ts);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// 分を「45分」「1時間5分」の形にする
export function fmt(m) {
  m = Math.round(m);
  if (m < 60) return m + '分';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h + '時間' + (r ? r + '分' : '');
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// 週の初め（月曜 0 時）
export function weekStart(now) {
  const d = startOfDay(new Date(now));
  const w = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - w);
  return d;
}
```

- [ ] **Step 6: 通るのを確かめる**

Run: `npx vitest run test/time.test.js`
Expected: PASS（6 件）

- [ ] **Step 7: コミット**

```bash
git add package.json package-lock.json .prettierrc .prettierignore .gitignore src/config.js src/core/time.js test/time.test.js
git commit -m "refactor: 開発の道具（vitest・prettier）を入れ、設定値と日付の道具を src/ に分ける"
```

---

### Task 2: 記録の集計（core/stats.js）

**Files:**
- Create: `src/core/stats.js`
- Test: `test/stats.test.js`

**Interfaces:**
- Consumes: `dayKey`・`monthKey`・`startOfDay`・`weekStart`（Task 1）、`APP_CONFIG.COLORS`
- Produces:
  - `allSessions(months): Session[]`
  - `summarize(sessions, now): {today, week, month, streak}`（分・分・分・日）
  - `lastDays(sessions, now, n = 14): {date: Date, bySubject: {[subject]: min}}[]`（古い順、最後が今日）
  - `subjectOrder(subjects, sessions): string[]`
  - `weekBySubject(sessions, now): [subject, min][]`（多い順）
  - `historyGroups(sessions, limit = 60): [dayKey, Session[]][]`（新しい順）
  - `todayPomos(sessions, now): number`（今日の手動でない記録の数）
  - `colorOf(subject, subjects): string`

- [ ] **Step 1: 失敗するテストを書く**

`test/stats.test.js`:

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run test/stats.test.js`
Expected: FAIL（`src/core/stats.js` が無い）

- [ ] **Step 3: `src/core/stats.js` を作る**（今の `app.js` 23・24・149〜190・220 行の計算の部分）

```js
/* 記録の集計（DOM を使わない） */
import { APP_CONFIG } from '../config.js';
import { dayKey, monthKey, startOfDay, weekStart } from './time.js';

const { COLORS } = APP_CONFIG;

export function allSessions(months) {
  return Object.values(months).flat();
}

// 科目の色: 設定の並び順。設定に無い科目は科目の数の位置
export function colorOf(sub, subjects) {
  const i = subjects.indexOf(sub);
  return COLORS[(i < 0 ? subjects.length : i) % COLORS.length];
}

// 今日・今週（月曜から）・今月の分と、連続日数
export function summarize(sessions, now) {
  const today = dayKey(now);
  const ws = weekStart(now).getTime();
  const mk = monthKey(now);
  let tToday = 0;
  let tWeek = 0;
  let tMonth = 0;
  const byDay = {};
  sessions.forEach((s) => {
    const dk = dayKey(s.start);
    byDay[dk] = (byDay[dk] || 0) + s.min;
    if (dk === today) tToday += s.min;
    if (s.start >= ws) tWeek += s.min;
    if (monthKey(s.start) === mk) tMonth += s.min;
  });
  // 今日（今日の記録が無ければ昨日）からさかのぼる
  let streak = 0;
  const d = startOfDay(new Date(now));
  if (!byDay[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (byDay[dayKey(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { today: tToday, week: tWeek, month: tMonth, streak };
}

// 直近 n 日（古い順）の、日ごと・科目ごとの分
export function lastDays(sessions, now, n = 14) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = startOfDay(new Date(now));
    x.setDate(x.getDate() - i);
    days.push(x);
  }
  return days.map((date) => {
    const k = dayKey(date);
    const bySubject = {};
    sessions.forEach((s) => {
      if (dayKey(s.start) === k) bySubject[s.subject] = (bySubject[s.subject] || 0) + s.min;
    });
    return { date, bySubject };
  });
}

// グラフ・凡例の科目の順: 設定の科目、その後ろに設定に無い科目
export function subjectOrder(subjects, sessions) {
  const order = [...subjects];
  sessions.forEach((s) => {
    if (!order.includes(s.subject)) order.push(s.subject);
  });
  return order;
}

// 今週の科目ごとの分（多い順）
export function weekBySubject(sessions, now) {
  const ws = weekStart(now).getTime();
  const bySub = {};
  sessions.forEach((s) => {
    if (s.start >= ws) bySub[s.subject] = (bySub[s.subject] || 0) + s.min;
  });
  return Object.entries(bySub).sort((a, b) => b[1] - a[1]);
}

// 履歴: 新しい順に limit 件を日ごとにまとめる
export function historyGroups(sessions, limit = 60) {
  const list = sessions
    .slice()
    .sort((a, b) => b.start - a.start)
    .slice(0, limit);
  const groups = {};
  list.forEach((s) => {
    (groups[dayKey(s.start)] = groups[dayKey(s.start)] || []).push(s);
  });
  return Object.entries(groups);
}

// 今日の、タイマーで記録した（手動でない）数
export function todayPomos(sessions, now) {
  const k = dayKey(now);
  return sessions.filter((s) => !s.manual && dayKey(s.start) === k).length;
}
```

- [ ] **Step 4: 通るのを確かめる**

Run: `npx vitest run test/stats.test.js`
Expected: PASS（10 件）

- [ ] **Step 5: コミット**

```bash
git add src/core/stats.js test/stats.test.js
git commit -m "refactor: 記録の集計を core/stats.js に分ける"
```

---

### Task 3: タイマーの状態（core/timer.js）

**Files:**
- Create: `src/core/timer.js`
- Test: `test/timer.test.js`

**Interfaces:**
- Consumes: `APP_CONFIG.DEFAULTS`
- Produces（どれも元の `t` を変えず、新しい `t` を返す）:
  - `normalizeTimer(saved): Timer`（保存した値に足りない項目を初期値で埋める）
  - `dur(mode, settings): ms`
  - `longEvery(settings): number`（2 以上）
  - `remaining(t, settings, now): ms`
  - `start(t, settings, now): Timer`（動いていればそのまま）
  - `pause(t, now): Timer`（止まっていればそのまま）
  - `resetTo(t, mode): Timer`
  - `afterFocus(t, settings): Timer`（`cycle` を 1 足し、次の休憩の最初にする）
  - `finishRun(t): Timer`（動いていれば `endAt` までを `accMs` に足して止める）
  - `isDue(t, now): boolean`
  - `focusSession(t, endTs, {task, subject, memo, id}): Session | null`（1 分未満なら null）
- `Timer` = `{mode, running, endAt, remainingMs, accMs, resumedAt, startAt, cycle, subject, taskId?}`

- [ ] **Step 1: 失敗するテストを書く**

`test/timer.test.js`:

```js
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
    expect(normalizeTimer({ cycle: 3, taskId: 'x' })).toMatchObject({ cycle: 3, taskId: 'x', mode: 'focus' });
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
    expect(t).toMatchObject({ running: true, endAt: 1000 + 25 * MIN, resumedAt: 1000, startAt: 1000 });
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
    const t = resetTo({ ...normalizeTimer({ cycle: 2, taskId: 'x' }), running: true, accMs: 5, startAt: 9, resumedAt: 9, remainingMs: 3 }, 'short');
    expect(t).toMatchObject({ mode: 'short', running: false, remainingMs: null, accMs: 0, startAt: 0, resumedAt: 0, cycle: 2, taskId: 'x' });
  });

  it('afterFocus は cycle を足し、回数ごとに長休憩', () => {
    expect(afterFocus(normalizeTimer({ cycle: 0 }), SET)).toMatchObject({ cycle: 1, mode: 'short' });
    expect(afterFocus(normalizeTimer({ cycle: 3 }), SET)).toMatchObject({ cycle: 4, mode: 'long' });
    expect(afterFocus(normalizeTimer({ cycle: 1 }), { ...SET, longEvery: 2 })).toMatchObject({ cycle: 2, mode: 'long' });
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
    expect(focusSession(t, 500000, { task: null, subject: 's', memo: '', id: 'i' }).start).toBe(380000);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run test/timer.test.js`
Expected: FAIL（`src/core/timer.js` が無い）

- [ ] **Step 3: `src/core/timer.js` を作る**（今の `app.js` 11・12・57〜75 行・89 行の計算の部分）

```js
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

export const dur = (mode, settings) => Math.max(1, Number(settings[mode]) || DEFAULTS[mode]) * 60000;

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
```

- [ ] **Step 4: 通るのを確かめる**

Run: `npx vitest run test/timer.test.js`
Expected: PASS（12 件）

- [ ] **Step 5: コミット**

```bash
git add src/core/timer.js test/timer.test.js
git commit -m "refactor: タイマーの状態の遷移を core/timer.js に分ける"
```

---

### Task 4: タスク（core/tasks.js）

**Files:**
- Create: `src/core/tasks.js`
- Test: `test/tasks.test.js`

**Interfaces:**
- Produces（どれも新しい配列を返す）:
  - 定数 `MAX_TASKS = 100`・`MAX_EST = 50`・`MAX_DONE = 99`
  - `activeTask(tasks, taskId): Task | null`（完了したものは選ばない）
  - `clampEst(v): number`（1〜50）
  - `addTask(tasks, {id, title, subject, est}): Task[] | null`（100 件あれば null）
  - `updateTask(tasks, id, {title, subject, est, done}): Task[]`（`done` は 99 まで）
  - `removeTask(tasks, id)`・`toggleCompleted(tasks, id)`・`incrementDone(tasks, id)`・`clearCompleted(tasks)`
  - `footSummary(tasks): {left, doneSum, estSum, rem}`
- `Task` = `{id, title, subject, est, done, completed}`

- [ ] **Step 1: 失敗するテストを書く**

`test/tasks.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  MAX_TASKS,
  activeTask,
  clampEst,
  addTask,
  updateTask,
  removeTask,
  toggleCompleted,
  incrementDone,
  clearCompleted,
  footSummary,
} from '../src/core/tasks.js';

const tk = (id, extra = {}) => ({ id, title: id, subject: '簿記論', est: 2, done: 0, completed: false, ...extra });

describe('tasks', () => {
  it('activeTask は選んでいる未完了のタスク', () => {
    const list = [tk('a'), tk('b', { completed: true })];
    expect(activeTask(list, 'a')).toBe(list[0]);
    expect(activeTask(list, 'b')).toBeNull();
    expect(activeTask(list, 'z')).toBeNull();
  });

  it('clampEst は 1〜50 の整数', () => {
    expect(clampEst(0)).toBe(1);
    expect(clampEst(2.6)).toBe(3);
    expect(clampEst(80)).toBe(50);
    expect(clampEst(NaN)).toBe(1);
  });

  it('addTask は末尾に足し、100 件あれば null', () => {
    expect(addTask([tk('a')], { id: 'n', title: 't', subject: 's', est: 3 })).toEqual([
      tk('a'),
      { id: 'n', title: 't', subject: 's', est: 3, done: 0, completed: false },
    ]);
    const full = Array.from({ length: MAX_TASKS }, (_, i) => tk('x' + i));
    expect(addTask(full, { id: 'n', title: 't', subject: 's', est: 1 })).toBeNull();
  });

  it('updateTask は名前・科目・見積もり・実績（99 まで）を変える', () => {
    expect(updateTask([tk('a'), tk('b')], 'b', { title: 'B', subject: '応用情報', est: 4, done: 120 })[1]).toEqual(
      tk('b', { title: 'B', subject: '応用情報', est: 4, done: 99 }),
    );
  });

  it('removeTask・toggleCompleted・incrementDone・clearCompleted', () => {
    const list = [tk('a', { done: 1 }), tk('b', { completed: true })];
    expect(removeTask(list, 'a')).toEqual([list[1]]);
    expect(toggleCompleted(list, 'a')[0].completed).toBe(true);
    expect(toggleCompleted(list, 'b')[1].completed).toBe(false);
    expect(incrementDone(list, 'a')[0].done).toBe(2);
    expect(incrementDone([{ id: 'c' }], 'c')[0].done).toBe(1);
    expect(clearCompleted(list)).toEqual([list[0]]);
  });

  it('footSummary は残りの数と、未完了の見積もり − 実績', () => {
    const list = [tk('a', { est: 3, done: 1 }), tk('b', { est: 2, done: 4 }), tk('c', { est: 5, done: 0, completed: true })];
    expect(footSummary(list)).toEqual({ left: 2, doneSum: 5, estSum: 10, rem: 2 });
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run test/tasks.test.js`
Expected: FAIL（`src/core/tasks.js` が無い）

- [ ] **Step 3: `src/core/tasks.js` を作る**（今の `app.js` 219・254〜259・263・289・299〜301・324 行と 68 行の計算の部分）

```js
/* タスクの計算（DOM を使わない）。どれも新しい配列を返す */
export const MAX_TASKS = 100;
export const MAX_EST = 50;
export const MAX_DONE = 99;

export function activeTask(tasks, taskId) {
  return tasks.find((x) => x.id === taskId && !x.completed) || null;
}

export const clampEst = (v) => Math.min(MAX_EST, Math.max(1, Math.round(v) || 1));

// 100 件あれば null
export function addTask(tasks, { id, title, subject, est }) {
  if (tasks.length >= MAX_TASKS) return null;
  return [...tasks, { id, title, subject, est, done: 0, completed: false }];
}

export function updateTask(tasks, id, { title, subject, est, done }) {
  return tasks.map((x) => (x.id === id ? { ...x, title, subject, est, done: Math.min(MAX_DONE, done) } : x));
}

export const removeTask = (tasks, id) => tasks.filter((x) => x.id !== id);

export const toggleCompleted = (tasks, id) =>
  tasks.map((x) => (x.id === id ? { ...x, completed: !x.completed } : x));

export const incrementDone = (tasks, id) =>
  tasks.map((x) => (x.id === id ? { ...x, done: (x.done || 0) + 1 } : x));

export const clearCompleted = (tasks) => tasks.filter((x) => !x.completed);

// 下の欄: 残りの件数、実績・見積もりの合計、残りポモ（未完了の見積もり − 実績）
export function footSummary(tasks) {
  return {
    left: tasks.filter((x) => !x.completed).length,
    doneSum: tasks.reduce((a, x) => a + (x.done || 0), 0),
    estSum: tasks.reduce((a, x) => a + (x.est || 0), 0),
    rem: tasks
      .filter((x) => !x.completed)
      .reduce((a, x) => a + Math.max(0, (x.est || 0) - (x.done || 0)), 0),
  };
}
```

- [ ] **Step 4: 通るのを確かめる**

Run: `npx vitest run test/tasks.test.js`
Expected: PASS（6 件）

- [ ] **Step 5: コミット**

```bash
git add src/core/tasks.js test/tasks.test.js
git commit -m "refactor: タスクの計算を core/tasks.js に分ける"
```

---

### Task 5: 設定の読み取り（core/settings.js）

設計書のファイル一覧には無いが、設定の欄の値を確かめる計算（範囲・科目の重複除き・12 個まで）をテストできるように `core/` に置く。

**Files:**
- Create: `src/core/settings.js`
- Test: `test/settings.test.js`

**Interfaces:**
- Consumes: `APP_CONFIG.DEFAULTS`
- Produces:
  - `MAX_SUBJECTS = 12`
  - `clampInt(value, lo, hi, def): number`
  - `parseSubjects(text): string[]`
  - `settingsFromForm(prev, form): Settings`。`form` = `{focus, short, long, longEvery, weeklyGoalH, autoBreak, subjects, bgFocus, bgBreak, bgSpeed, fireworks}`（数は欄の文字列のまま、`subjects` は textarea の文字列、`autoBreak`・`fireworks` は boolean）

- [ ] **Step 1: 失敗するテストを書く**

`test/settings.test.js`:

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run test/settings.test.js`
Expected: FAIL（`src/core/settings.js` が無い）

- [ ] **Step 3: `src/core/settings.js` を作る**（今の `app.js` 361〜367 行）

```js
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
```

- [ ] **Step 4: 通るのを確かめる**

Run: `npx vitest run test/settings.test.js`
Expected: PASS（4 件）

- [ ] **Step 5: コミット**

```bash
git add src/core/settings.js test/settings.test.js
git commit -m "refactor: 設定の欄の読み取りを core/settings.js に分ける"
```

---

### Task 6: 書き出し・取り込み（core/backup.js）

**Files:**
- Create: `src/core/backup.js`
- Test: `test/backup.test.js`

**Interfaces:**
- Consumes: `dayKey`・`hm`（Task 1）、`MAX_TASKS`（Task 4）、`APP_CONFIG.DEFAULTS`
- Produces:
  - `csvText(sessions): string`
  - `backupJson({settings, months, tasks}, now): string`
  - `parseBackup(text): {ok: true, data} | {ok: false, error: 'json' | 'app'}`
  - `mergeBackup({settings, months, tasks}, data): {settings, months, tasks, added, tAdded}`

- [ ] **Step 1: 失敗するテストを書く**

`test/backup.test.js`:

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run test/backup.test.js`
Expected: FAIL（`src/core/backup.js` が無い）

- [ ] **Step 3: `src/core/backup.js` を作る**（今の `app.js` 378〜400 行の計算の部分）

```js
/* CSV・バックアップ JSON の書き出しと取り込み（DOM を使わない） */
import { APP_CONFIG } from '../config.js';
import { dayKey, hm } from './time.js';
import { MAX_TASKS } from './tasks.js';

const { DEFAULTS } = APP_CONFIG;

export function csvText(sessions) {
  const rows = [['日付', '開始', '終了', '分', '科目', 'タスク', 'メモ', '手動']];
  sessions
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach((s) =>
      rows.push([dayKey(s.start), hm(s.start), hm(s.end), s.min, s.subject, s.task || '', s.memo || '', s.manual ? '1' : '']),
    );
  return '\ufeff' + rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
}

export function backupJson({ settings, months, tasks }, now) {
  return JSON.stringify(
    { app: 'focus-timer', version: 1, exportedAt: new Date(now).toISOString(), settings, months, tasks },
    null,
    1,
  );
}

export function parseBackup(text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: 'json' };
  }
  if (!d || d.app !== 'focus-timer' || typeof d.months !== 'object') return { ok: false, error: 'app' };
  return { ok: true, data: d };
}

// 記録・タスクは id が無いものだけ足す。設定はファイルの値で上書き
export function mergeBackup(cur, d) {
  const months = { ...cur.months };
  let added = 0;
  Object.entries(d.months || {}).forEach(([k, arr]) => {
    if (!/^\d{4}-\d{2}$/.test(k) || !Array.isArray(arr)) return;
    const have = months[k] || [];
    const ids = new Set(have.map((x) => x.id));
    const add = arr.filter((x) => x && x.id && typeof x.start === 'number' && typeof x.min === 'number' && !ids.has(x.id));
    if (add.length) {
      months[k] = [...have, ...add];
      added += add.length;
    }
  });

  let tasks = cur.tasks;
  let tAdded = 0;
  if (Array.isArray(d.tasks)) {
    const ids = new Set(tasks.map((x) => x.id));
    const add = d.tasks
      .filter((x) => x && x.id && x.title && !ids.has(x.id))
      .slice(0, Math.max(0, MAX_TASKS - tasks.length));
    if (add.length) {
      tasks = [...tasks, ...add];
      tAdded = add.length;
    }
  }

  let settings = cur.settings;
  if (d.settings && typeof d.settings === 'object') settings = { ...DEFAULTS, ...settings, ...d.settings };

  return { settings, months, tasks, added, tAdded };
}
```

- [ ] **Step 4: 通るのを確かめる**

Run: `npx vitest run test/backup.test.js`
Expected: PASS（5 件）

- [ ] **Step 5: コミット**

```bash
git add src/core/backup.js test/backup.test.js
git commit -m "refactor: CSV・バックアップの書き出しと取り込みを core/backup.js に分ける"
```

---

### Task 7: 状態と保存（store.js）

**Files:**
- Create: `src/store.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: `normalizeTimer`（Task 3）、`monthKey`（Task 1）、`mergeBackup`（Task 6）、`APP_CONFIG`
- Produces: `createStore(storage)`。`storage` は `getItem`・`setItem` を持つもの（画面では `localStorage`）。返す値:
  - `state`: `{settings, months, tasks, t}`（読むのは自由。`settings`・`months`・`tasks`・`t` を差し替えるのは下の関数だけ。`t` の項目（`taskId`・`subject`）を直に変えたら `saveTimer()`）
  - `subscribe(fn)`・`notify()`
  - `onSaveResult(fn)`: 保存のたびに `fn('')`（成功）か `fn(知らせの文)`（失敗）
  - `saveData()`: `pomo.data.v1` に `{settings, months, tasks}` を書く
  - `setTimer(t)`・`saveTimer()`
  - `currentSubject(): string`（`t.subject` が科目に無ければ先頭にする。保存はしない）
  - `addSession(s)`・`deleteSession(id, monthKey)`: 保存して `notify()`
  - `setTasks(tasks)`・`setSettings(settings)`: 保存だけ（描画は呼ぶ側）
  - `importBackup(data): {added, tAdded}`: 保存して `notify()`
  - `applyExternal(key, newValue)`: 別のタブの `storage` イベント。`pomo.data.v1` なら読み直して `notify()`
  - `getLook()`・`setLook(v)`・`getDrawer()`・`setDrawer(open)`
- `notify()` するのは、今のコードが `renderAll()` を呼んでいた所だけ（記録の追加・削除、取り込み、別タブの変更）。

- [ ] **Step 1: 失敗するテストを書く**

`test/store.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { APP_CONFIG } from '../src/config.js';
import { createStore } from '../src/store.js';

const { DEFAULTS } = APP_CONFIG;

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    fail: false,
    getItem(k) {
      return m.has(k) ? m.get(k) : null;
    },
    setItem(k, v) {
      if (this.fail) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    },
  };
}

const OLD = {
  settings: { focus: 30, subjects: ['簿記論'] },
  months: { '2026-10': [{ id: 'a', start: new Date(2026, 9, 6).getTime(), end: 0, min: 25, subject: '簿記論', memo: '' }] },
  tasks: [{ id: 't', title: '過去問', subject: '簿記論', est: 2, done: 1, completed: false }],
};

describe('store', () => {
  it('何も無ければ初期値', () => {
    const st = createStore(fakeStorage());
    expect(st.state.settings).toEqual(DEFAULTS);
    expect(st.state.months).toEqual({});
    expect(st.state.tasks).toEqual([]);
    expect(st.state.t).toMatchObject({ mode: 'focus', running: false });
  });

  it('前の形のデータを読む（足りない設定は初期値で埋める）', () => {
    const st = createStore(
      fakeStorage({
        'pomo.data.v1': JSON.stringify(OLD),
        'pomo.timer.v1': JSON.stringify({ mode: 'short', cycle: 2, taskId: 't' }),
        'pomo.look.v1': JSON.stringify('anim'),
        'pomo.drawer.v1': 'true',
      }),
    );
    expect(st.state.settings).toEqual({ ...DEFAULTS, focus: 30, subjects: ['簿記論'] });
    expect(st.state.months).toEqual(OLD.months);
    expect(st.state.tasks).toEqual(OLD.tasks);
    expect(st.state.t).toMatchObject({ mode: 'short', cycle: 2, taskId: 't', running: false });
    expect(st.getLook()).toBe('anim');
    expect(st.getDrawer()).toBe(true);
  });

  it('壊れた JSON は無いものとして扱う', () => {
    const st = createStore(fakeStorage({ 'pomo.data.v1': '{', 'pomo.timer.v1': '{' }));
    expect(st.state.settings).toEqual(DEFAULTS);
    expect(st.state.t.mode).toBe('focus');
  });

  it('addSession は月に足して保存し、知らせる', () => {
    const s = fakeStorage();
    const st = createStore(s);
    const fn = vi.fn();
    st.subscribe(fn);
    const sess = { id: 'x', start: new Date(2026, 9, 6).getTime(), end: 0, min: 5, subject: 'a', memo: '' };
    st.addSession(sess);
    expect(st.state.months['2026-10']).toEqual([sess]);
    expect(JSON.parse(s.m.get('pomo.data.v1')).months['2026-10']).toEqual([sess]);
    expect(fn).toHaveBeenCalledTimes(1);
    st.deleteSession('x', '2026-10');
    expect(st.state.months['2026-10']).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('setTasks・setSettings は保存するが知らせない', () => {
    const s = fakeStorage();
    const st = createStore(s);
    const fn = vi.fn();
    st.subscribe(fn);
    st.setTasks(OLD.tasks);
    st.setSettings({ ...DEFAULTS, focus: 40 });
    expect(JSON.parse(s.m.get('pomo.data.v1'))).toMatchObject({ tasks: OLD.tasks, settings: { focus: 40 } });
    expect(fn).not.toHaveBeenCalled();
  });

  it('保存に失敗したら知らせの文、次に成功したら空', () => {
    const s = fakeStorage();
    const st = createStore(s);
    const msgs = [];
    st.onSaveResult((m) => msgs.push(m));
    s.fail = true;
    st.setTasks([]);
    s.fail = false;
    st.setTasks([]);
    expect(msgs).toEqual([
      'ブラウザに保存できませんでした。容量不足かプライベートモードの可能性があります。設定 → バックアップで書き出してください',
      '',
    ]);
  });

  it('setTimer・saveTimer・currentSubject', () => {
    const s = fakeStorage();
    const st = createStore(s);
    st.setTimer({ ...st.state.t, cycle: 5 });
    expect(JSON.parse(s.m.get('pomo.timer.v1')).cycle).toBe(5);
    expect(st.currentSubject()).toBe(DEFAULTS.subjects[0]);
    st.state.t.subject = DEFAULTS.subjects[1];
    expect(st.currentSubject()).toBe(DEFAULTS.subjects[1]);
    st.saveTimer();
    expect(JSON.parse(s.m.get('pomo.timer.v1')).subject).toBe(DEFAULTS.subjects[1]);
  });

  it('applyExternal は pomo.data.v1 の変更だけ読み直して知らせる', () => {
    const st = createStore(fakeStorage());
    const fn = vi.fn();
    st.subscribe(fn);
    st.applyExternal('pomo.timer.v1', '{}');
    st.applyExternal('pomo.data.v1', null);
    st.applyExternal('pomo.data.v1', '{');
    expect(fn).not.toHaveBeenCalled();
    st.applyExternal('pomo.data.v1', JSON.stringify(OLD));
    expect(st.state.tasks).toEqual(OLD.tasks);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('importBackup は合わせて保存し、件数を返して知らせる', () => {
    const st = createStore(fakeStorage());
    const fn = vi.fn();
    st.subscribe(fn);
    expect(st.importBackup({ app: 'focus-timer', ...OLD })).toEqual({ added: 1, tAdded: 1 });
    expect(st.state.settings.focus).toBe(30);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('setLook・setDrawer は保存する', () => {
    const s = fakeStorage();
    const st = createStore(s);
    st.setLook('grad');
    st.setDrawer(false);
    expect(s.m.get('pomo.look.v1')).toBe('"grad"');
    expect(s.m.get('pomo.drawer.v1')).toBe('false');
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run test/store.test.js`
Expected: FAIL（`src/store.js` が無い）

- [ ] **Step 3: `src/store.js` を作る**（今の `app.js` 5〜12・30〜40・59・317・323・399〜401・407・426 行）

```js
/* 状態（設定・記録・タスク・タイマー）を持つ唯一の場所。保存はブラウザの localStorage だけ */
import { APP_CONFIG } from './config.js';
import { monthKey } from './core/time.js';
import { normalizeTimer } from './core/timer.js';
import { mergeBackup } from './core/backup.js';

const { DEFAULTS, LS_DATA, LS_TIMER, LS_LOOK, LS_DRAWER } = APP_CONFIG;
const SAVE_FAILED =
  'ブラウザに保存できませんでした。容量不足かプライベートモードの可能性があります。設定 → バックアップで書き出してください';

export function createStore(storage) {
  const get = (k) => {
    try {
      return JSON.parse(storage.getItem(k));
    } catch (e) {
      return null;
    }
  };
  const set = (k, v) => {
    try {
      storage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };

  const state = { settings: { ...DEFAULTS }, months: {}, tasks: [], t: normalizeTimer(get(LS_TIMER)) };
  const load = (d) => {
    state.settings = { ...DEFAULTS, ...(d.settings || {}) };
    state.months = d.months || {};
    state.tasks = Array.isArray(d.tasks) ? d.tasks : [];
  };
  const saved = get(LS_DATA);
  if (saved) load(saved);

  const listeners = [];
  let saveResult = () => {};

  const notify = () => listeners.forEach((fn) => fn());

  function saveData() {
    try {
      storage.setItem(LS_DATA, JSON.stringify({ settings: state.settings, months: state.months, tasks: state.tasks }));
      saveResult('');
    } catch (e) {
      saveResult(SAVE_FAILED);
    }
  }

  return {
    state,
    subscribe: (fn) => listeners.push(fn),
    notify,
    onSaveResult: (fn) => {
      saveResult = fn;
    },
    saveData,

    setTimer(t) {
      state.t = t;
      set(LS_TIMER, t);
    },
    saveTimer: () => set(LS_TIMER, state.t),
    // タスクを選んでいないときの科目。科目に無ければ先頭にする（保存はしない）
    currentSubject() {
      if (!state.settings.subjects.includes(state.t.subject)) state.t.subject = state.settings.subjects[0];
      return state.t.subject;
    },

    addSession(s) {
      const k = monthKey(s.start);
      state.months[k] = [...(state.months[k] || []), s];
      saveData();
      notify();
    },
    deleteSession(id, k) {
      state.months[k] = (state.months[k] || []).filter((x) => x.id !== id);
      saveData();
      notify();
    },
    setTasks(tasks) {
      state.tasks = tasks;
      saveData();
    },
    setSettings(settings) {
      state.settings = settings;
      saveData();
    },
    importBackup(d) {
      const r = mergeBackup(state, d);
      state.settings = r.settings;
      state.months = r.months;
      state.tasks = r.tasks;
      saveData();
      notify();
      return { added: r.added, tAdded: r.tAdded };
    },
    // 同じ端末の別タブでの変更を反映
    applyExternal(key, newValue) {
      if (key !== LS_DATA || !newValue) return;
      try {
        load(JSON.parse(newValue));
        notify();
      } catch (err) {}
    },

    getLook: () => get(LS_LOOK),
    setLook: (v) => set(LS_LOOK, v),
    getDrawer: () => get(LS_DRAWER),
    setDrawer: (open) => set(LS_DRAWER, open),
  };
}
```

- [ ] **Step 4: 通るのを確かめる**

Run: `npx vitest run test/store.test.js` のあと `npm test`
Expected: PASS（store 10 件、全体 53 件）

- [ ] **Step 5: コミット**

```bash
git add src/store.js test/store.test.js
git commit -m "refactor: 状態と localStorage の読み書きを store.js に分ける"
```

---

### Task 8: 画面（ui/）と起動（main.js）に分け、app.js を消す

画面の処理を今の `app.js` から移す。ここで初めて画面の読み込み先が変わる。

**Files:**
- Create: `src/ui/dom.js`, `src/ui/feedback.js`, `src/ui/background.js`, `src/ui/look.js`, `src/ui/timer-view.js`, `src/ui/tasks-view.js`, `src/ui/stats-view.js`, `src/ui/settings-view.js`, `src/main.js`
- Modify: `index.html:146-147`（読み込むスクリプト）、`sw.js:1-2`（キャッシュの一覧と名前）
- Delete: `app.js`, `config.js`

**Interfaces:**
- Consumes: Task 1〜7 のすべて
- `ctx`（`main.js` が作り、各 `ui` の `init(ctx)` に渡す）:
  `{store, toast, setSync, ensureAudio, chime, celebrate, setScene, bgInit, sceneColor, applyLook, pillText, updateIdle, consumeSuppressedTap, renderNow, renderAll, renderSettings}`
- 各 `ui` が外に出すもの:
  - `dom.js`: `$`, `RM`, `esc`, `saveFile`
  - `feedback.js`: `toast`, `setSync`, `ensureAudio`, `chime`
  - `background.js`: `init`, `bgInit`, `setScene`, `celebrate`, `sceneColor`
  - `look.js`: `init`, `applyLook`, `pillText`, `updateIdle`, `consumeSuppressedTap`
  - `timer-view.js`: `init`, `renderTimer`, `tick`
  - `tasks-view.js`: `init`, `renderTasks`, `renderChips`, `renderNow`
  - `stats-view.js`: `init`, `renderStats`
  - `settings-view.js`: `init`, `renderSettings`

- [ ] **Step 1: `src/ui/dom.js`**（今の `app.js` 3・208・374〜377・432 行）

```js
/* 画面の小さな道具。ui のどのファイルから読んでもよい */
export const $ = (id) => document.getElementById(id);

// 動きを減らす設定
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function saveFile(name, data, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
  return true;
}
```

- [ ] **Step 2: `src/ui/feedback.js`**（今の `app.js` 25〜27・42〜53 行）

```js
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
```

- [ ] **Step 3: `src/ui/background.js`**（今の `app.js` 433〜479 行）

```js
/* canvas の背景（窓の雨・マリンスノーとクラゲ・夜空の花火）と、集中を終えたときの花火 */
import { $, RM } from './dom.js';

let ctx;
const bg = { cv: null, cx: null, W: 0, H: 0, d: 1, scene: 'none', parts: [], sparks: [], next: 0, cele: 0, celeN: 0, running: false, t0: 0 };
const BGC = { glass: '#16222f', snow: '#040f1f', fire: '#0a0f24' };
const rnd = (a, b) => a + Math.random() * (b - a);

export function init(c) {
  ctx = c;
  bg.cv = $('bgc');
  bg.cx = bg.cv.getContext('2d');
  bgSize();
  addEventListener('resize', () => {
    bgSize();
    bgInit();
  });
}

// 見た目を切り替えるときにかぶせる色
export const sceneColor = (sc) => BGC[sc] || '#0b1220';

function bgSize() {
  bg.d = Math.min(2, window.devicePixelRatio || 1);
  bg.W = bg.cv.width = innerWidth * bg.d;
  bg.H = bg.cv.height = innerHeight * bg.d;
}

export function bgInit() {
  const W = bg.W, H = bg.H, d = bg.d;
  bg.parts = [];
  const n = { glass: 35, snow: 90, fire: 70, none: 0 }[bg.scene];
  for (let i = 0; i < n; i++) bg.parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1, 4), v: rnd(0.3, 1), p: rnd(0, 6.28), hold: rnd(0, 200) });
  if (bg.scene === 'glass')
    for (let i = 0; i < 26; i++)
      bg.parts.push({ bokeh: 1, x: rnd(0, W), y: rnd(0, H), r: rnd(15, 45) * d, c: ['#f2b35a', '#e86b6b', '#6bb5e8'][i % 3], p: rnd(0, 6.28) });
  if (bg.scene !== 'none') {
    bg.cx.fillStyle = BGC[bg.scene];
    bg.cx.fillRect(0, 0, W, H);
  }
}

function spd() {
  return ((Number(ctx.store.state.settings.bgSpeed) || 50) / 100) * (RM ? 0.3 : 1);
}

export function setScene(sc) {
  if (sc === bg.scene) return;
  bg.scene = sc;
  bgInit();
  bgLoop();
}

function bgLoop() {
  if (!bg.running && (bg.scene !== 'none' || bg.sparks.length || bg.cele)) {
    bg.running = true;
    bg.t0 = performance.now();
    requestAnimationFrame(bgDraw);
  }
}

function burst(big) {
  const W = bg.W, H = bg.H, d = bg.d, x = rnd(W * 0.15, W * 0.85), y = rnd(H * 0.12, H * 0.42);
  const hues = ['255,190,120', '255,140,160', '150,200,255', '200,170,255', '255,230,150'];
  const c = hues[Math.floor(rnd(0, hues.length))];
  const n = big ? 110 : 70;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + rnd(-0.05, 0.05);
    const v = rnd(0.6, 1) * (big ? 2.6 : 1.8) * d;
    bg.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c, decay: rnd(0.006, 0.01) });
  }
}

// 集中を終えたときの花火（アニメの見た目でなくても上に重ねて出す）
export function celebrate() {
  if (!ctx.store.state.settings.fireworks || RM) return;
  bg.celeN = 0;
  bg.cele = performance.now();
  if (bg.scene === 'none') bg.cv.classList.add('overlay');
  bgLoop();
}

function bgDraw(now) {
  const cx = bg.cx, W = bg.W, H = bg.H, d = bg.d;
  const dt = Math.min(50, now - bg.t0) / 16;
  bg.t0 = now;
  const s = dt * spd();
  if (bg.scene === 'none' && !bg.sparks.length && !bg.cele) {
    cx.clearRect(0, 0, W, H);
    bg.cv.classList.remove('overlay');
    bg.running = false;
    return;
  }
  if (bg.scene === 'none') cx.clearRect(0, 0, W, H);
  else if (bg.scene === 'fire') {
    cx.fillStyle = 'rgba(10,15,36,' + (0.12 + 0.1 * spd()) + ')';
    cx.fillRect(0, 0, W, H);
    bg.parts.forEach((p) => {
      cx.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.15 * Math.sin(now / 3000 + p.p)) + ')';
      cx.fillRect(p.x, p.y * 0.6, d, d);
    });
    if (now > bg.next) {
      if (bg.next) burst(false);
      bg.next = now + rnd(3500, 6500) / spd();
    }
  } else {
    cx.fillStyle = BGC[bg.scene];
    cx.fillRect(0, 0, W, H);
    if (bg.scene === 'glass') {
      bg.parts.forEach((p) => {
        if (p.bokeh) {
          cx.globalAlpha = 0.12 + 0.04 * Math.sin(now / 5000 + p.p);
          cx.fillStyle = p.c;
          cx.beginPath();
          cx.arc(p.x, p.y, p.r, 0, 7);
          cx.fill();
        }
      });
      cx.globalAlpha = 1;
      bg.parts.forEach((p) => {
        if (p.bokeh) return;
        p.hold -= s;
        let v = 0.05 * p.v;
        if (p.hold < 0) {
          v = 0.9 * p.v;
          if (p.hold < -40) p.hold = rnd(150, 500);
        }
        p.y += v * s * d;
        if (p.y > H + 20) {
          p.y = -10;
          p.x = rnd(0, W);
        }
        cx.strokeStyle = 'rgba(200,220,240,.14)';
        cx.lineWidth = p.r * 0.7 * d;
        cx.beginPath();
        cx.moveTo(p.x, p.y - p.r * 7 * d);
        cx.lineTo(p.x, p.y);
        cx.stroke();
        cx.fillStyle = 'rgba(220,235,250,.5)';
        cx.beginPath();
        cx.arc(p.x, p.y, p.r * 1.3 * d, 0, 7);
        cx.fill();
      });
    } else {
      bg.parts.forEach((p) => {
        p.y += p.v * 0.12 * s * d;
        p.x += Math.sin(now / 6000 + p.p) * 0.05 * d * spd();
        if (p.y > H + 5) {
          p.y = -5;
          p.x = rnd(0, W);
        }
        cx.fillStyle = 'rgba(220,235,255,' + (0.22 + p.r * 0.07) + ')';
        cx.beginPath();
        cx.arc(p.x, p.y, p.r * 0.6 * d, 0, 7);
        cx.fill();
      });
      // クラゲ
      const ph = (now / 1000) * spd();
      const jx = W * 0.78 + Math.sin(ph * 0.06) * W * 0.04;
      const jy = H * 0.62 + Math.sin(ph * 0.09) * H * 0.05;
      const pu = 1 + 0.08 * Math.sin(ph * 0.5);
      const jr = Math.min(W, H) * 0.08;
      cx.fillStyle = 'rgba(190,160,255,.24)';
      cx.beginPath();
      cx.ellipse(jx, jy, jr * pu, (jr * 0.75) / pu, 0, Math.PI, 0);
      cx.fill();
      cx.strokeStyle = 'rgba(200,175,255,.28)';
      cx.lineWidth = 1.5 * d;
      for (let i = 0; i < 6; i++) {
        const tx = jx - jr * 0.8 + i * jr * 0.32;
        cx.beginPath();
        cx.moveTo(tx, jy);
        for (let y = 0; y < jr * 2.6; y += 4 * d) cx.lineTo(tx + Math.sin(y / (22 * d) + ph * 0.5 + i) * 4 * d, jy + y);
        cx.stroke();
      }
    }
  }
  if (bg.cele && now > bg.cele) {
    burst(true);
    bg.celeN++;
    bg.cele = bg.celeN >= 6 ? 0 : now + rnd(280, 480);
  }
  const k = dt * 0.8;
  bg.sparks.forEach((p) => {
    p.x += p.vx * k;
    p.y += p.vy * k;
    p.vx *= Math.pow(0.985, k);
    p.vy = p.vy * Math.pow(0.985, k) + 0.02 * k * d;
    p.life -= p.decay * k;
    cx.fillStyle = 'rgba(' + p.c + ',' + Math.max(0, p.life) + ')';
    cx.beginPath();
    cx.arc(p.x, p.y, 1.6 * d, 0, 7);
    cx.fill();
  });
  bg.sparks = bg.sparks.filter((p) => p.life > 0 && p.y < H + 20);
  requestAnimationFrame(bgDraw);
}
```

- [ ] **Step 4: `src/ui/look.js`**（今の `app.js` 114・335〜340・406〜428 行）

```js
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
```

- [ ] **Step 5: `src/ui/timer-view.js`**（今の `app.js` 56〜132・341〜351・371 行）

```js
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
```

- [ ] **Step 6: `src/ui/tasks-view.js`**（今の `app.js` 133〜146・217〜324 行）

```js
/* タスクのドロワー: 一覧・編集・下の欄・科目のチップ */
import { fmt, genId } from '../core/time.js';
import { allSessions, todayPomos, colorOf } from '../core/stats.js';
import * as T from '../core/tasks.js';
import { $, esc } from './dom.js';

let ctx;
const S = () => ctx.store.state;
const col = (sub) => colorOf(sub, S().settings.subjects);
const active = () => T.activeTask(S().tasks, S().t.taskId);
let editing = null; // 編集中のタスクの id、新規は 'new'
let draft = null;

export function init(c) {
  ctx = c;
  $('addTask').onclick = () => openForm('new');
  $('nowBtn').onclick = () => setDrawer(!$('taskDrawer').classList.contains('open'));
  $('closeDrawer').onclick = () => setDrawer(false);
  $('drawerScrim').onclick = () => setDrawer(false);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('taskDrawer').classList.contains('open')) setDrawer(false);
  });
  setDrawer(ctx.store.getDrawer() === true);
  $('clearDone').onclick = () => {
    ctx.store.setTasks(T.clearCompleted(S().tasks));
    renderTasks();
    ctx.toast('完了済みのタスクを消しました');
  };
  setInterval(() => renderFoot(), 30000);
}

function setDrawer(open) {
  const dr = $('taskDrawer');
  dr.classList.toggle('open', open);
  dr.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('drawer-open', open);
  $('nowBtn').setAttribute('aria-expanded', String(open));
  ctx.store.setDrawer(open);
  if (open) setTimeout(() => $('closeDrawer').focus(), 50);
}

// タスクを選んでいないときの科目のチップと、手動で追加の科目
export function renderChips() {
  const cur = ctx.store.currentSubject();
  $('subjectChips').innerHTML = '';
  S().settings.subjects.forEach((sub) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('aria-pressed', sub === cur);
    const d = document.createElement('span');
    d.className = 'dot';
    d.style.background = col(sub);
    b.append(d, document.createTextNode(sub));
    b.onclick = () => {
      S().t.subject = sub;
      ctx.store.saveTimer();
      renderChips();
    };
    $('subjectChips').appendChild(b);
  });
  const sel = $('mSubject');
  sel.innerHTML = '';
  S().settings.subjects.forEach((sub) => {
    const o = document.createElement('option');
    o.value = o.textContent = sub;
    sel.appendChild(o);
  });
  sel.value = cur;
}

// 上の「#N タスク名」
export function renderNow() {
  const tk = active();
  const n = todayPomos(allSessions(S().months), Date.now());
  if (S().t.mode === 'focus') {
    $('nowN').textContent = '#' + (n + 1);
    $('nowT').textContent = tk ? tk.title : 'タスクを選択';
  } else {
    $('nowN').textContent = '#' + n;
    $('nowT').textContent = '休憩しましょう';
  }
  $('noTaskSubject').hidden = !!tk;
  renderFoot();
}

function openForm(id) {
  editing = id;
  const tk = S().tasks.find((x) => x.id === id);
  draft = tk
    ? { title: tk.title, subject: tk.subject, est: tk.est || 1, done: tk.done || 0 }
    : { title: '', subject: ctx.store.currentSubject(), est: 1, done: 0 };
  renderTasks();
  setTimeout(() => {
    const i = $('tfTitle');
    if (i) i.focus();
  }, 0);
}

function closeForm() {
  editing = null;
  draft = null;
}

function formEl() {
  const settings = S().settings;
  const f = document.createElement('div');
  f.className = 'tform';
  const opts = [...new Set([...settings.subjects, draft.subject])]
    .map((s) => '<option' + (s === draft.subject ? ' selected' : '') + '>' + esc(s) + '</option>')
    .join('');
  f.innerHTML =
    '<div><label for="tfTitle">タスク名</label><input type="text" id="tfTitle" maxlength="60" placeholder="例：簿記論 過去問 第3問"></div>' +
    '<div><label for="tfSub">科目</label><select id="tfSub">' + opts + '</select></div>' +
    '<div><label for="tfEst">見積もりポモドーロ数（1回＝' + settings.focus + '分）</label><div class="est"><button type="button" id="tfMinus" aria-label="減らす">−</button><input type="number" id="tfEst" min="1" max="50"><button type="button" id="tfPlus" aria-label="増やす">＋</button><span id="tfMin" style="color:var(--sub);font-size:.85rem"></span></div></div>' +
    (editing !== 'new' ? '<div><label for="tfDone">実績ポモドーロ数</label><input type="number" id="tfDone" min="0" max="99" style="width:6em"></div>' : '') +
    '<div class="acts"><span>' + (editing !== 'new' ? '<button class="btn ghost" id="tfDel" style="color:var(--warn)">削除</button>' : '') +
    '</span><span style="display:flex;gap:8px"><button class="btn" id="tfCancel">キャンセル</button><button class="btn primary" id="tfSave" style="--accent:var(--focus)">保存</button></span></div>';
  const ti = f.querySelector('#tfTitle');
  const es = f.querySelector('#tfEst');
  const mi = f.querySelector('#tfMin');
  ti.value = draft.title;
  es.value = draft.est;
  const upd = () => (mi.textContent = '約' + fmt((Number(es.value) || 0) * settings.focus));
  upd();
  ti.oninput = () => (draft.title = ti.value);
  f.querySelector('#tfSub').onchange = (e) => (draft.subject = e.target.value);
  es.oninput = () => {
    draft.est = Number(es.value) || 1;
    upd();
  };
  f.querySelector('#tfMinus').onclick = () => {
    draft.est = Math.max(1, (Number(es.value) || 1) - 1);
    es.value = draft.est;
    upd();
  };
  f.querySelector('#tfPlus').onclick = () => {
    draft.est = Math.min(T.MAX_EST, (Number(es.value) || 0) + 1);
    es.value = draft.est;
    upd();
  };
  const dn = f.querySelector('#tfDone');
  if (dn) {
    dn.value = draft.done;
    dn.oninput = () => (draft.done = Math.max(0, Math.round(Number(dn.value) || 0)));
  }
  ti.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.isComposing) f.querySelector('#tfSave').click();
  };
  f.querySelector('#tfCancel').onclick = () => {
    closeForm();
    renderTasks();
  };
  f.querySelector('#tfSave').onclick = () => {
    const title = draft.title.trim();
    if (!title) {
      ctx.toast('タスク名を入力してください');
      ti.focus();
      return;
    }
    const est = T.clampEst(draft.est);
    let tasks;
    if (editing === 'new') {
      const id = genId();
      tasks = T.addTask(S().tasks, { id, title, subject: draft.subject, est });
      if (!tasks) {
        ctx.toast('タスクは100件までです。完了済みを消してください');
        return;
      }
      // 足したあとの一覧で、選んでいるタスクが無ければ新しいものを選ぶ
      if (!T.activeTask(tasks, S().t.taskId)) S().t.taskId = id;
    } else {
      tasks = T.updateTask(S().tasks, editing, { title, subject: draft.subject, est, done: draft.done });
    }
    ctx.store.saveTimer();
    closeForm();
    ctx.store.setTasks(tasks);
    renderTasks();
    renderNow();
  };
  const del = f.querySelector('#tfDel');
  if (del)
    del.onclick = () => {
      const tasks = T.removeTask(S().tasks, editing);
      closeForm();
      ctx.store.setTasks(tasks);
      renderTasks();
      renderNow();
      ctx.toast('タスクを削除しました');
    };
  return f;
}

// 見積もりのブロック（実績の分を科目の色で塗る）
function blocksHtml(tk) {
  const done = tk.done || 0;
  const est = tk.est || 1;
  const c = col(tk.subject);
  const MAX = 20;
  const total = Math.max(done, est);
  const show = Math.min(total, MAX);
  let h = '';
  for (let i = 0; i < show; i++) {
    const cls = i < done ? (i < est ? 'on' : 'on over') : '';
    h += '<i class="' + cls + '"' + (i < done ? ' style="background:' + c + ';border-color:' + c + '"' : '') + '></i>';
  }
  if (total > MAX) h += '<span class="more">+' + (total - MAX) + '</span>';
  const lbl = '見積もり' + est + '回中' + done + '回完了' + (done > est ? '（' + (done - est) + '回超過）' : '');
  return '<div class="blocks" role="img" aria-label="' + lbl + '" title="' + lbl + '">' + h + '</div>';
}

export function renderTasks() {
  const list = $('taskList');
  list.innerHTML = '';
  const act = active();
  S().tasks.forEach((tk) => {
    if (editing === tk.id) {
      list.appendChild(formEl());
      return;
    }
    const r = document.createElement('div');
    r.className = 'task' + (act && act.id === tk.id ? ' active' : '') + (tk.completed ? ' done' : '');
    r.innerHTML =
      '<button class="chk" aria-label="' + (tk.completed ? '未完了に戻す' : '完了にする') + '">✓</button>' +
      '<div style="min-width:0"><div class="ttl">' + esc(tk.title) + '</div><div class="ts"><i style="background:' + col(tk.subject) + '"></i>' + esc(tk.subject) + '</div></div>' +
      blocksHtml(tk) +
      '<button class="menu" aria-label="編集">編集</button>';
    r.onclick = (e) => {
      if (e.target.closest('button')) return;
      if (tk.completed) return;
      S().t.taskId = tk.id;
      ctx.store.saveTimer();
      renderTasks();
      renderNow();
    };
    r.querySelector('.chk').onclick = () => {
      ctx.store.setTasks(T.toggleCompleted(S().tasks, tk.id));
      renderTasks();
      renderNow();
    };
    r.querySelector('.menu').onclick = () => openForm(tk.id);
    list.appendChild(r);
  });
  if (editing === 'new') list.appendChild(formEl());
  $('addTask').hidden = editing !== null;
  $('clearDone').hidden = !S().tasks.some((x) => x.completed);
  renderFoot();
}

// ドロワーの下の欄と、上のバッジ
function renderFoot() {
  const { tasks, settings } = S();
  const { left, doneSum, estSum, rem } = T.footSummary(tasks);
  $('taskBadge').textContent = left ? String(left) : '';
  if (!tasks.length) {
    $('taskFoot').innerHTML = 'タスクを追加すると、必要なポモドーロ数と終了予定がわかります';
    return;
  }
  let bl = '';
  let cnt = 0;
  const MAX = 40;
  tasks.forEach((tk) => {
    const done = tk.done || 0;
    const n = Math.max(done, tk.est || 0);
    const c = col(tk.subject);
    for (let i = 0; i < n; i++) {
      cnt++;
      if (cnt > MAX) continue;
      bl += '<i class="' + (i < done ? 'on' : '') + '"' + (i < done ? ' style="background:' + c + ';border-color:' + c + '"' : '') + '></i>';
    }
  });
  if (cnt > MAX) bl += '<span class="more">+' + (cnt - MAX) + '</span>';
  const remMin = rem * (Number(settings.focus) || 25);
  $('taskFoot').innerHTML =
    '<div class="blocks foot-blocks" role="img" aria-label="見積もり' + estSum + '回中' + doneSum + '回完了">' + bl + '</div>' +
    '<div style="margin-top:6px">' + (rem ? '残り <b>' + rem + '</b> ポモ（約' + fmt(remMin) + '）' : '見積もり分はすべて完了') + '</div>';
}
```

注意: 新規保存のところは、今のコード（`tasks=[...tasks,nt]; if(!activeTask()) t.taskId=nt.id;`）と同じく「足したあとの一覧で、選んでいるタスクが無ければ新しいものを選ぶ」。

- [ ] **Step 7: `src/ui/stats-view.js`**（今の `app.js` 149〜207・352〜359・370・383・404 行）

```js
/* 記録のタブ: 数字・直近 14 日のグラフ・科目別・履歴・手動で追加・CSV */
import { dayKey, monthKey, hm, fmt, genId } from '../core/time.js';
import { allSessions, summarize, lastDays, subjectOrder, weekBySubject, historyGroups, colorOf } from '../core/stats.js';
import { csvText } from '../core/backup.js';
import { $, esc, saveFile } from './dom.js';

let ctx;
const S = () => ctx.store.state;
const col = (sub) => colorOf(sub, S().settings.subjects);

export function init(c) {
  ctx = c;
  $('mAdd').onclick = () => {
    const d = $('mDate').value;
    const tm = $('mTime').value || '12:00';
    const min = Math.round(Number($('mMin').value));
    if (!d || !(min >= 1 && min <= 600)) {
      ctx.toast('日付と時間（1〜600分）を入力してください');
      return;
    }
    const [y, mo, da] = d.split('-').map(Number);
    const [hh, mm] = tm.split(':').map(Number);
    const st = new Date(y, mo - 1, da, hh, mm).getTime();
    ctx.store.addSession({ id: genId(), start: st, end: st + min * 60000, min, subject: $('mSubject').value, memo: $('mMemo').value.trim(), manual: true });
    $('mMemo').value = '';
    ctx.toast(fmt(min) + 'を追加しました');
  };
  const n = new Date();
  $('mDate').value = dayKey(n);
  $('mTime').value = hm(n);
  $('btnCsv').onclick = () => saveFile('study-log-' + dayKey(Date.now()) + '.csv', csvText(allSessions(S().months)), 'text/csv');
  $('btnCsv').hidden = false;
}

export function renderStats() {
  const { settings, months } = S();
  const all = allSessions(months);
  const now = Date.now();
  const sum = summarize(all, now);
  const goal = (Number(settings.weeklyGoalH) || 15) * 60;
  $('todayTotal').textContent = $('sToday').textContent = fmt(sum.today);
  $('weekTotal').textContent = $('sWeek').textContent = fmt(sum.week);
  $('weekGoalLbl').textContent = fmt(goal);
  $('sWeekBar').style.width = Math.min(100, (sum.week / goal) * 100) + '%';
  $('sMonth').textContent = fmt(sum.month);
  $('sStreak').textContent = sum.streak + '日';

  // 直近 14 日のグラフ
  const days = lastDays(all, now, 14);
  const per = days.map((x) => x.bySubject);
  const totals = per.map((m) => Object.values(m).reduce((a, b) => a + b, 0));
  const max = Math.max(60, ...totals);
  const top = Math.ceil(max / 60) * 60;
  const W = 560, H = 190, L = 34, B = 24, Tp = 8, bw = (W - L) / 14;
  let svg = '';
  for (let g = 0; g <= top; g += Math.max(60, Math.ceil(top / 4 / 60) * 60)) {
    const y = H - B - (g / top) * (H - B - Tp);
    svg += '<line x1="' + L + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + g / 60 + 'h</text>';
  }
  const order = subjectOrder(settings.subjects, all);
  per.forEach((m, i) => {
    let y = H - B;
    const x = L + i * bw + bw * 0.2;
    const w = bw * 0.6;
    order.forEach((sub) => {
      if (!m[sub]) return;
      const h = (m[sub] / top) * (H - B - Tp);
      y -= h;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + col(sub) + '"><title>' + sub + ' ' + fmt(m[sub]) + '</title></rect>';
    });
    const date = days[i].date;
    const lbl = date.getMonth() + 1 + '/' + date.getDate();
    svg += '<text x="' + (x + w / 2) + '" y="' + (H - 6) + '" text-anchor="middle"' + (i === 13 ? ' style="font-weight:700;fill:var(--ink)"' : '') + '>' + lbl + '</text>';
  });
  $('chart').innerHTML = svg;
  $('legend').innerHTML = order.map((s) => '<span><i style="background:' + col(s) + '"></i>' + esc(s) + '</span>').join('');

  // 科目別（今週）
  const ent = weekBySubject(all, now);
  const bmax = Math.max(1, ...ent.map((e) => e[1]));
  $('breakdown').innerHTML = ent.length
    ? ent.map(([s, m]) => '<div class="brk"><span>' + esc(s) + '</span><div class="track"><span style="width:' + (m / bmax) * 100 + '%;background:' + col(s) + '"></span></div><span class="n">' + fmt(m) + '</span></div>').join('')
    : '<div class="empty">今週の記録はまだありません。タイマーで集中を1回終えると、ここに積み上がります。</div>';

  // 履歴
  const groups = historyGroups(all, 60);
  const h = $('history');
  h.innerHTML = '';
  if (!groups.length) {
    h.innerHTML = '<div class="empty">まだ記録がありません。</div>';
    return;
  }
  groups.forEach(([dk, arr]) => {
    const box = document.createElement('div');
    box.className = 'day';
    const daySum = arr.reduce((a, b) => a + b.min, 0);
    const [y, mo, da] = dk.split('-');
    const wd = '日月火水木金土'[new Date(+y, +mo - 1, +da).getDay()];
    box.innerHTML = '<h3><span>' + +mo + '月' + +da + '日（' + wd + '）</span><span>' + fmt(daySum) + '</span></h3>';
    arr.forEach((s) => {
      const r = document.createElement('div');
      r.className = 'row';
      r.innerHTML =
        '<span class="tm">' + hm(s.start) + '</span><span><span style="display:inline-flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:50%;background:' + col(s.subject) + ';display:inline-block"></i>' + esc(s.subject) + (s.manual ? '（手動）' : '') + '</span>' +
        (s.task || s.memo ? '<span class="memo">' + esc([s.task, s.memo].filter(Boolean).join(' ／ ')) + '</span>' : '') +
        '</span><span>' + fmt(s.min) + '</span>';
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '削除';
      del.setAttribute('aria-label', hm(s.start) + 'の記録を削除');
      del.onclick = () => {
        ctx.store.deleteSession(s.id, monthKey(s.start));
        ctx.toast('記録を削除しました');
      };
      r.appendChild(del);
      box.appendChild(r);
    });
    h.appendChild(box);
  });
}
```

- [ ] **Step 8: `src/ui/settings-view.js`**（今の `app.js` 210〜216・360〜369・384〜403・429 行）

```js
/* 設定のタブ: 設定の保存と、バックアップの書き出し・取り込み */
import { dayKey } from '../core/time.js';
import { settingsFromForm } from '../core/settings.js';
import { backupJson, parseBackup } from '../core/backup.js';
import { $, saveFile } from './dom.js';

let ctx;
const S = () => ctx.store.state;

export function init(c) {
  ctx = c;
  $('sSave').onclick = () => {
    const next = settingsFromForm(S().settings, {
      focus: $('sFocus').value,
      short: $('sShort').value,
      long: $('sLong').value,
      longEvery: $('sEvery').value,
      weeklyGoalH: $('sGoal').value,
      autoBreak: $('sAuto').checked,
      subjects: $('sSubjects').value,
      bgFocus: $('sBgFocus').value,
      bgBreak: $('sBgBreak').value,
      bgSpeed: $('sBgSpeed').value,
      fireworks: $('sFireworks').checked,
    });
    ctx.store.setSettings(next);
    ctx.renderAll();
    renderSettings();
    ctx.bgInit();
    ctx.toast('設定を保存しました');
  };
  $('sBgSpeed').oninput = () => ($('sBgSpeedOut').textContent = $('sBgSpeed').value + '%');

  $('btnExport').onclick = () => {
    const { settings, months, tasks } = S();
    if (saveFile('focus-timer-backup-' + dayKey(Date.now()) + '.json', backupJson({ settings, months, tasks }, Date.now()), 'application/json')) ctx.toast('書き出しました');
  };
  $('btnImport').onclick = () => $('importFile').click();
  $('importFile').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = parseBackup(await f.text());
    if (!r.ok) {
      ctx.toast(r.error === 'json' ? 'ファイルを読み込めませんでした（JSON形式ではありません）' : 'このアプリのバックアップファイルではありません');
      return;
    }
    const { added, tAdded } = ctx.store.importBackup(r.data);
    renderSettings();
    ctx.toast('記録' + added + '件、タスク' + tAdded + '件を取り込みました');
  };
}

export function renderSettings() {
  const settings = S().settings;
  $('sFocus').value = settings.focus;
  $('sShort').value = settings.short;
  $('sLong').value = settings.long;
  $('sEvery').value = settings.longEvery;
  $('sAuto').checked = !!settings.autoBreak;
  $('sGoal').value = settings.weeklyGoalH;
  $('sSubjects').value = settings.subjects.join('\n');
  $('sBgFocus').value = settings.bgFocus;
  $('sBgBreak').value = settings.bgBreak;
  $('sBgSpeed').value = settings.bgSpeed;
  $('sBgSpeedOut').textContent = settings.bgSpeed + '%';
  $('sFireworks').checked = !!settings.fireworks;
}
```

- [ ] **Step 9: `src/main.js`**（今の `app.js` 325〜334・479〜482・485 行）

```js
/* 起動: 状態を読み、画面の部品をつなぐ */
import { createStore } from './store.js';
import { $ } from './ui/dom.js';
import * as feedback from './ui/feedback.js';
import * as background from './ui/background.js';
import * as look from './ui/look.js';
import * as timerView from './ui/timer-view.js';
import * as tasksView from './ui/tasks-view.js';
import * as statsView from './ui/stats-view.js';
import * as settingsView from './ui/settings-view.js';

const store = createStore(localStorage);

function renderAll() {
  tasksView.renderTasks();
  tasksView.renderChips();
  timerView.renderTimer();
  statsView.renderStats();
  if ($('tab-settings').hidden) settingsView.renderSettings();
}

// ui どうしはこの ctx を通して呼ぶ
const ctx = {
  store,
  toast: feedback.toast,
  setSync: feedback.setSync,
  ensureAudio: feedback.ensureAudio,
  chime: feedback.chime,
  celebrate: background.celebrate,
  setScene: background.setScene,
  bgInit: background.bgInit,
  sceneColor: background.sceneColor,
  applyLook: look.applyLook,
  pillText: look.pillText,
  updateIdle: look.updateIdle,
  consumeSuppressedTap: look.consumeSuppressedTap,
  renderNow: tasksView.renderNow,
  renderAll,
  renderSettings: settingsView.renderSettings,
};

store.onSaveResult(feedback.setSync);
store.subscribe(renderAll);
addEventListener('storage', (e) => store.applyExternal(e.key, e.newValue));

tasksView.init(ctx);
look.init(ctx);
timerView.init(ctx);
statsView.init(ctx);
settingsView.init(ctx);
background.init(ctx);

/* ---------- タブ ---------- */
function showTab(name) {
  document.querySelectorAll('nav button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tab === name)));
  ['timer', 'log', 'settings'].forEach((n) => ($('tab-' + n).hidden = n !== name));
  if (name === 'settings') settingsView.renderSettings();
}
// 開いているタブのボタンをもう一度押すとタイマーに戻る
document.querySelectorAll('nav button').forEach(
  (b) => (b.onclick = () => showTab(b.getAttribute('aria-pressed') === 'true' ? 'timer' : b.dataset.tab)),
);
$('brandBtn').onclick = () => showTab('timer');

look.applyLook();
renderAll();
setInterval(timerView.tick, 250);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
```

- [ ] **Step 10: `index.html` の読み込みを変え、古いファイルを消す**

`index.html` の

```html
<script src="config.js"></script>
<script src="app.js"></script>
```

を

```html
<script type="module" src="src/main.js"></script>
```

にする。そのあと:

```bash
git rm app.js config.js
```

- [ ] **Step 11: `sw.js` のキャッシュを直す**

1・2 行目を次にする:

```js
const CACHE = 'focus-timer-v3';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './src/main.js',
  './src/config.js',
  './src/store.js',
  './src/core/time.js',
  './src/core/stats.js',
  './src/core/timer.js',
  './src/core/tasks.js',
  './src/core/settings.js',
  './src/core/backup.js',
  './src/ui/dom.js',
  './src/ui/feedback.js',
  './src/ui/background.js',
  './src/ui/look.js',
  './src/ui/timer-view.js',
  './src/ui/tasks-view.js',
  './src/ui/stats-view.js',
  './src/ui/settings-view.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];
```

- [ ] **Step 12: 文法・テスト・一覧の確かめ**

Run:

```bash
for f in src/*.js src/*/*.js sw.js; do node --check "$f" || echo "NG $f"; done
npm test
node -e "const sw=require('fs').readFileSync('sw.js','utf8');const fs=require('child_process').execSync('ls src/*.js src/*/*.js').toString().trim().split('\\n');const miss=fs.filter(f=>!sw.includes(\"'./\"+f+\"'\"));console.log(miss.length?'MISSING '+miss:'SHELL_OK')"
```

Expected: `NG` が出ない、テストがすべて PASS、`SHELL_OK`。

- [ ] **Step 13: 画面で確かめる**

作業用のサーバー（`python3 -m http.server 8000`）で http://localhost:8000/ を Ctrl+Shift+R で開き、開発者ツールのコンソールにエラーが無いことを見てから、次を順に確かめる（ユーザーにも頼む）:

1. 分ける前に使っていたブラウザで開き、記録・タスク・設定・見た目がそのまま出る
2. 開始・一時停止・再開（文字盤・Space・Enter）、記録して終了、リセット
3. 設定で集中を 1 分にし、時間切れでチャイム・花火・記録・小休憩に移る。休憩をスキップ
4. 集中を動かしたまま再読み込みしても続く。閉じて 1 分以上たってから開くと終わって記録される
5. タスクの追加（Enter でも）・編集・選択・完了・削除・完了済みを消す、上の「#N」とバッジ、下の欄
6. 手動で追加、履歴の削除、グラフ・科目別・連続日数
7. 設定の保存（科目を変えるとチップ・選択肢・色が変わる）
8. CSV で保存、JSON の書き出し → 取り込み（「記録 0 件、タスク 0 件」になる）
9. 見た目の 3 つの切り替え、アニメの背景 3 つ、集中中に 3 秒で周りが消えてタッチで戻る（タイマーは止まらない）
10. ドロワーの開け閉め（Esc・外側を押す）、再読み込みで開いたままか覚えている
11. 別のタブで記録を足すと、こちらにも出る

- [ ] **Step 14: コミット**

```bash
git add -A
git commit -m "refactor: 画面の処理を src/ui/ に分け、src/main.js を ES モジュールで読み込む。app.js・config.js を消し、キャッシュを v3 にする"
```

---

### Task 9: 整形と資料

**Files:**
- Modify: すべての `.js`・`.css`・`.html`・`.json`（prettier）
- Modify: `docs/design.md`（1.1・1.2 節、9 章のキャッシュの名前）、`CLAUDE.md`（構成・環境・テスト）、`README.md`（例の `CACHE` の名前）
- Delete: `docs/superpowers/`（この計画と設計）

- [ ] **Step 1: 整形する**

Run: `npx prettier --write .` のあと `npm test` と `npx prettier --check .`
Expected: テストがすべて PASS、`All matched files use Prettier code style!`

- [ ] **Step 2: 画面をもう一度確かめる**

Ctrl+Shift+R で開き直し、Task 8 Step 13 の 1・2・5・7・9 を確かめる（`style.css`・`index.html` を整形したので、見た目が変わっていないかを特に見る）。

- [ ] **Step 3: `docs/design.md` を直す**

1.1 節の表を次にする:

```markdown
| ファイル | 中身 |
|---|---|
| `index.html` | 画面の構造だけ（タイマー・記録・設定の 3 つのタブ、タスクのドロワー）。`src/main.js` を ES モジュールで読む |
| `style.css` | 見た目。ライト／ダーク（`prefers-color-scheme`）、表示の切り替え（`data-look`・`data-scene`）、集中中の自動非表示（`body.idle`） |
| `src/config.js` | 設定値（`APP_CONFIG`）: 設定の初期値・科目・科目の色・モード名・localStorage のキー |
| `src/main.js` | 起動。状態を読み、画面の部品を `ctx` でつなぎ、0.25 秒ごとに確かめる。タブの切り替え。Service Worker の登録 |
| `src/store.js` | 状態（設定・記録・タスク・タイマー）を持つ唯一の場所。localStorage の読み書き、別タブの変更 |
| `src/core/` | DOM を使わない計算（テストの対象）: `time.js` 日付、`timer.js` タイマーの状態、`stats.js` 集計、`tasks.js` タスク、`settings.js` 設定の欄、`backup.js` CSV・JSON |
| `src/ui/` | 画面: `timer-view.js` タイマー、`tasks-view.js` タスク、`stats-view.js` 記録、`settings-view.js` 設定、`look.js` 見た目・自動非表示、`background.js` 背景・花火、`feedback.js` トースト・音、`dom.js` 小さな道具 |
| `sw.js` | キャッシュ（`CACHE` の名前を変えると古いキャッシュを消す） |
| `manifest.webmanifest`・`icon-*.png` | PWA の設定とアイコン |
| `test/` | vitest（`core/` と `store.js`） |
```

1.2 節（app.js の区切り）を次にする:

```markdown
### 1.2 つなぎ方

- 依存は `ui/` → `store.js` → `core/`・`config.js` の一方向。`core/` は `config.js` と `core/` の中だけを読む。
- `ui/` どうしは直接読まず、`main.js` が作る `ctx`（`toast`・`celebrate`・`applyLook`・`renderNow`・`renderAll` など）を通して呼ぶ。`ui/dom.js` だけはどこから読んでもよい。
- 状態を変えるのは `store.js` の関数だけ。記録の追加・削除、取り込み、別タブの変更のときは `notify()` で `renderAll()` を呼ぶ。ほかの変更は呼ぶ側が要る所だけ描き直す。
- `core/` の関数は「今」を引数 `now` で受け取る。
```

9 章の `CACHE` = `focus-timer-v2` を `focus-timer-v3` にし、「ページ・CSS・JS・manifest・アイコン」を「ページ・CSS・`src/` の JS すべて・manifest・アイコン」にする。

- [ ] **Step 4: `CLAUDE.md` を直す**

「構成」の 1 つ目を次にする:

```markdown
- 静的ファイルだけ（ビルド・バックエンドなし）。`index.html`（構造）・`style.css`（見た目）・`src/`（ES モジュール。`config.js` 設定値、`store.js` 状態と保存、`core/` DOM を使わない計算、`ui/` 画面、`main.js` 起動）・`sw.js`（オフライン用のキャッシュ）。つなぎ方は `docs/design.md` の 1.2。
- npm は開発のときだけ（vitest・prettier）。公開物には要らない。
```

「環境」の最後に足す:

```markdown
- `src/` にファイルを足したら、`sw.js` の `SHELL` にも足す。
```

「テスト」を次にする:

```markdown
## テスト

- `npm test`（vitest。`core/` と `store.js`）、整形の確認は `npx prettier --check .`（直すときは `npm run format`）。
- 計算を変えたら `test/` も直す。画面の動きは作業用のサーバーで開いて確かめる。テストは今の動きを確かめるものだけ。機能を消したらテストも消す。
- 確かめたことは PR の本文に書く。スマホでしか確かめられないこと（ホーム画面・音など）はユーザーに頼む。
```

- [ ] **Step 5: `README.md` の例を直す**

`（例：`focus-timer-v2` → `v3`）` を `（例：`focus-timer-v3` → `v4`）` にする。

- [ ] **Step 6: 作業中の資料を消してコミット**

```bash
git rm -r docs/superpowers
git add -A
git commit -m "style: prettier で整え、設計書・CLAUDE.md を新しい構成に合わせる"
```

- [ ] **Step 7: 見つけたバグらしきものを報告する**

整理の中で気づいたが直さなかったもの（例: グラフの `<title>` に科目名をエスケープせずに入れている、設定の範囲外の値が `DEFAULTS` でなく決まった数になる）をユーザーに一覧で伝える。GitHub に置いたあと issue にする。
