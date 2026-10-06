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

const tk = (id, extra = {}) => ({
  id,
  title: id,
  subject: '簿記論',
  est: 2,
  done: 0,
  completed: false,
  ...extra,
});

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
    expect(
      updateTask([tk('a'), tk('b')], 'b', {
        title: 'B',
        subject: '応用情報',
        est: 4,
        done: 120,
      })[1],
    ).toEqual(tk('b', { title: 'B', subject: '応用情報', est: 4, done: 99 }));
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
    const list = [
      tk('a', { est: 3, done: 1 }),
      tk('b', { est: 2, done: 4 }),
      tk('c', { est: 5, done: 0, completed: true }),
    ];
    expect(footSummary(list)).toEqual({ left: 2, doneSum: 5, estSum: 10, rem: 2 });
  });
});
