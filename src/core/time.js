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
