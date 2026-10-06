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
