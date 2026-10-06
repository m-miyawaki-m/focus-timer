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
