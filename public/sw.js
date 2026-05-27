// Copyright by cdblue999@gmail.com, 2026
// myGrowatt Service Worker — offline cache for PWA

const CACHE = 'myGrowatt-v1';
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first, fallback to cache (for fresh API data)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls — network only (never cache)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Static assets — cache-first
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Everything else (charts.js CDN, etc.) — network-first, cache fallback
  event.respondWith(
    fetch(event.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
