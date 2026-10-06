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
  months: {
    '2026-10': [
      {
        id: 'a',
        start: new Date(2026, 9, 6).getTime(),
        end: 0,
        min: 25,
        subject: '簿記論',
        memo: '',
      },
    ],
  },
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
    const sess = {
      id: 'x',
      start: new Date(2026, 9, 6).getTime(),
      end: 0,
      min: 5,
      subject: 'a',
      memo: '',
    };
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
    expect(JSON.parse(s.m.get('pomo.data.v1'))).toMatchObject({
      tasks: OLD.tasks,
      settings: { focus: 40 },
    });
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
