// Service worker: deixa o app disponível offline (os dados já ficam no IndexedDB).
const CACHE = 'treino-v7';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css', 'icons/icon.svg', 'icons/column.svg', 'icons/column-faint.svg', 'icons/laurel.svg', 'icons/icon-192.png', 'icons/icon-180.png',
  'js/app.js', 'js/db.js', 'js/store.js', 'js/util.js', 'js/defaults.js', 'js/schedule.js', 'js/analysis.js', 'js/charts.js', 'js/ui.js',
  'js/views/home.js', 'js/views/calendar.js', 'js/views/strength.js', 'js/views/runs.js', 'js/views/tracker.js',
  'js/views/progress.js', 'js/views/library.js', 'js/views/cardio.js', 'js/views/goals.js', 'js/views/report.js', 'js/exercises.js', 'js/resttimer.js', 'js/views/body.js', 'js/views/recovery.js', 'js/views/plan.js', 'js/views/profile.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rede primeiro (para receber atualizações), cache como reserva offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
