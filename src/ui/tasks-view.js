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
    '<div><label for="tfSub">科目</label><select id="tfSub">' +
    opts +
    '</select></div>' +
    '<div><label for="tfEst">見積もりポモドーロ数（1回＝' +
    settings.focus +
    '分）</label><div class="est"><button type="button" id="tfMinus" aria-label="減らす">−</button><input type="number" id="tfEst" min="1" max="50"><button type="button" id="tfPlus" aria-label="増やす">＋</button><span id="tfMin" style="color:var(--sub);font-size:.85rem"></span></div></div>' +
    (editing !== 'new'
      ? '<div><label for="tfDone">実績ポモドーロ数</label><input type="number" id="tfDone" min="0" max="99" style="width:6em"></div>'
      : '') +
    '<div class="acts"><span>' +
    (editing !== 'new'
      ? '<button class="btn ghost" id="tfDel" style="color:var(--warn)">削除</button>'
      : '') +
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
      tasks = T.updateTask(S().tasks, editing, {
        title,
        subject: draft.subject,
        est,
        done: draft.done,
      });
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
    h +=
      '<i class="' +
      cls +
      '"' +
      (i < done ? ' style="background:' + c + ';border-color:' + c + '"' : '') +
      '></i>';
  }
  if (total > MAX) h += '<span class="more">+' + (total - MAX) + '</span>';
  const lbl =
    '見積もり' +
    est +
    '回中' +
    done +
    '回完了' +
    (done > est ? '（' + (done - est) + '回超過）' : '');
  return (
    '<div class="blocks" role="img" aria-label="' + lbl + '" title="' + lbl + '">' + h + '</div>'
  );
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
    r.className =
      'task' + (act && act.id === tk.id ? ' active' : '') + (tk.completed ? ' done' : '');
    r.innerHTML =
      '<button class="chk" aria-label="' +
      (tk.completed ? '未完了に戻す' : '完了にする') +
      '">✓</button>' +
      '<div style="min-width:0"><div class="ttl">' +
      esc(tk.title) +
      '</div><div class="ts"><i style="background:' +
      col(tk.subject) +
      '"></i>' +
      esc(tk.subject) +
      '</div></div>' +
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
      bl +=
        '<i class="' +
        (i < done ? 'on' : '') +
        '"' +
        (i < done ? ' style="background:' + c + ';border-color:' + c + '"' : '') +
        '></i>';
    }
  });
  if (cnt > MAX) bl += '<span class="more">+' + (cnt - MAX) + '</span>';
  const remMin = rem * (Number(settings.focus) || 25);
  $('taskFoot').innerHTML =
    '<div class="blocks foot-blocks" role="img" aria-label="見積もり' +
    estSum +
    '回中' +
    doneSum +
    '回完了">' +
    bl +
    '</div>' +
    '<div style="margin-top:6px">' +
    (rem ? '残り <b>' + rem + '</b> ポモ（約' + fmt(remMin) + '）' : '見積もり分はすべて完了') +
    '</div>';
}
