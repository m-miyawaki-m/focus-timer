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
      rows.push([
        dayKey(s.start),
        hm(s.start),
        hm(s.end),
        s.min,
        s.subject,
        s.task || '',
        s.memo || '',
        s.manual ? '1' : '',
      ]),
    );
  return (
    '\ufeff' +
    rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n')
  );
}

export function backupJson({ settings, months, tasks }, now) {
  return JSON.stringify(
    {
      app: 'focus-timer',
      version: 1,
      exportedAt: new Date(now).toISOString(),
      settings,
      months,
      tasks,
    },
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
  if (!d || d.app !== 'focus-timer' || typeof d.months !== 'object')
    return { ok: false, error: 'app' };
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
    const add = arr.filter(
      (x) =>
        x && x.id && typeof x.start === 'number' && typeof x.min === 'number' && !ids.has(x.id),
    );
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
  if (d.settings && typeof d.settings === 'object')
    settings = { ...DEFAULTS, ...settings, ...d.settings };

  return { settings, months, tasks, added, tAdded };
}
