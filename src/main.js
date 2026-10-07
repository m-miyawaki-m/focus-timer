/* 起動: 状態を読み、画面の部品をつなぐ */
import { createStore } from './store.js';
import { $ } from './ui/dom.js';
import * as feedback from './ui/feedback.js';
import * as background from './ui/background.js';
import * as look from './ui/look.js';
import * as wake from './ui/wake.js';
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
  updateWake: wake.updateWake,
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
wake.init(ctx);
timerView.init(ctx);
statsView.init(ctx);
settingsView.init(ctx);
background.init(ctx);

/* ---------- タブ ---------- */
function showTab(name) {
  document
    .querySelectorAll('nav button')
    .forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tab === name)));
  ['timer', 'log', 'settings'].forEach((n) => ($('tab-' + n).hidden = n !== name));
  if (name === 'settings') settingsView.renderSettings();
}
// 開いているタブのボタンをもう一度押すとタイマーに戻る
document
  .querySelectorAll('nav button')
  .forEach(
    (b) =>
      (b.onclick = () =>
        showTab(b.getAttribute('aria-pressed') === 'true' ? 'timer' : b.dataset.tab)),
  );
$('brandBtn').onclick = () => showTab('timer');

look.applyLook();
renderAll();
setInterval(timerView.tick, 250);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
