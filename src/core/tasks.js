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
