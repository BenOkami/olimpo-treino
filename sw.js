// Service worker: deixa o app disponível offline (os dados já ficam no IndexedDB).
// Ao publicar uma versão nova, mude VERSION aqui, em js/version.js e em version.json.
const VERSION = '2026.10.30-11';
const CACHE = 'treino-' + VERSION;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'version.json', 'css/styles.css',
  'icons/icon.svg', 'icons/column.svg', 'icons/column-faint.svg', 'icons/laurel.svg', 'icons/icon-180.png', 'icons/icon-192.png',
  'js/app.js', 'js/version.js', 'js/updater.js', 'js/cloud.js', 'js/cloud-config.js', 'js/db.js', 'js/store.js', 'js/util.js', 'js/defaults.js', 'js/schedule.js', 'js/analysis.js', 'js/charts.js', 'js/ui.js',
  'js/exercises.js', 'js/resttimer.js',
  'js/views/home.js', 'js/views/calendar.js', 'js/views/strength.js', 'js/views/runs.js', 'js/views/tracker.js',
  'js/views/progress.js', 'js/views/library.js', 'js/views/cardio.js', 'js/views/goals.js', 'js/views/report.js',
  'js/views/body.js', 'js/views/recovery.js', 'js/views/plan.js', 'js/views/profile.js',
];

self.addEventListener('install', e => {
  // cache: 'reload' evita copiar arquivos antigos do cache HTTP do aparelho
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rede primeiro, sempre confirmando com o servidor (no-cache); cache só quando estiver offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
