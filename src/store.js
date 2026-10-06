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
