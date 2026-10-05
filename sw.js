/* MY GYM London PWA — offline-first service worker */
const CACHE = 'mygym-v20';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './timetable.js',
  './app.js',
  './db.js',
  './config.js',
  './vendor/supabase.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/logo-header.png',
  './icons/favicon.ico',
  './icons/favicon-32.png',
  './fonts/barlow-condensed-700.woff2',
  './fonts/barlow-condensed-800.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Timetable data file: network-first (fresh class changes), cache fallback offline.
   Everything else (pages, scripts, fonts, icons): serve from cache instantly and
   refresh the cache in the background, so the app opens fast even on weak signal. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never touch external links

  if (url.pathname.endsWith('timetable.js')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const refresh = fetch(e.request).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit || caches.match('./index.html'));
      return hit || refresh;
    })
  );
});

/* Push reminders: show the notification, and open the app on Bookings when it is tapped. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'MY GYM London', {
    body: d.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/favicon-32.png',
    tag: d.tag || 'mygym',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.focus(); if ('navigate' in c) return c.navigate(url).catch(() => {}); return; }
    }
    return self.clients.openWindow(url);
  }));
});
