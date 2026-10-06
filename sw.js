const CACHE = 'focus-timer-v3';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './src/main.js',
  './src/config.js',
  './src/store.js',
  './src/core/time.js',
  './src/core/stats.js',
  './src/core/timer.js',
  './src/core/tasks.js',
  './src/core/settings.js',
  './src/core/backup.js',
  './src/ui/dom.js',
  './src/ui/feedback.js',
  './src/ui/background.js',
  './src/ui/look.js',
  './src/ui/timer-view.js',
  './src/ui/tasks-view.js',
  './src/ui/stats-view.js',
  './src/ui/settings-view.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // ページ本体：ネット優先（更新を反映）、オフライン時はキャッシュ
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const c = r.clone();
          caches
            .open(CACHE)
            .then((x) => x.put('./index.html', './style.css', './config.js', './app.js', c));
          return r;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  // 同一オリジンとGoogle Fonts：キャッシュ優先
  if (
    url.origin === location.origin ||
    url.host === 'fonts.googleapis.com' ||
    url.host === 'fonts.gstatic.com'
  ) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((r) => {
            if (r.ok || r.type === 'opaque') {
              const c = r.clone();
              caches.open(CACHE).then((x) => x.put(req, c));
            }
            return r;
          }),
      ),
    );
  }
});
