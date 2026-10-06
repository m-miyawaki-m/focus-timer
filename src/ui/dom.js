/* 画面の小さな道具。ui のどのファイルから読んでもよい */
export const $ = (id) => document.getElementById(id);

// 動きを減らす設定
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function saveFile(name, data, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
  return true;
}
