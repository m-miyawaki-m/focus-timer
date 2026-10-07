/* タイマーが動いている間、画面を暗くしない（Screen Wake Lock） */

let ctx;
let lock = null;
let asking = false;

export function init(c) {
  ctx = c;
  // 画面を離れるとロックは外れるので、戻ったらかけ直す
  document.addEventListener('visibilitychange', updateWake);
}

function wanted() {
  const { settings, t } = ctx.store.state;
  return t.running && settings.keepAwake !== false && document.visibilityState === 'visible';
}

// 今の状態に合わせて、ロックをかける・外す。使えないときや断られたときは何もしない
export async function updateWake() {
  if (!('wakeLock' in navigator)) return;
  if (!wanted()) {
    if (lock) {
      const l = lock;
      lock = null;
      l.release().catch(() => {});
    }
    return;
  }
  if (lock || asking) return;
  asking = true;
  try {
    const l = await navigator.wakeLock.request('screen');
    l.addEventListener('release', () => {
      if (lock === l) lock = null;
    });
    lock = l;
    // 待っている間に止めたなら外す
    if (!wanted()) updateWake();
  } catch {
    // 省電力などで断られた: ふつうに暗くなるだけ
  } finally {
    asking = false;
  }
}
