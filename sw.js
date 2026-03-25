// sw.js — Gathered Service Worker
// Cache-first for app shell; pass-through for Firebase/Google APIs

const CACHE_NAME = 'gathered-v16';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/auth.css',
  './css/feed.css',
  './css/post.css',
  './css/profile.css',
  './css/groups.css',
  './js/app.js',
  './js/auth.js',
  './js/feed.js',
  './js/post.js',
  './js/profile.js',
  './js/groups.js',
  './js/storage.js',
  './js/utils.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Hosts that must never be intercepted (Firebase / Google APIs)
const PASSTHROUGH_HOSTS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'storage.googleapis.com',
  'accounts.google.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
];

// Stale-while-revalidate for Google Fonts
const FONTS_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests — POST and others must not be cached
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Let Firebase / Google auth calls go straight to the network
  if (PASSTHROUGH_HOSTS.some((h) => url.hostname.includes(h))) return;

  // Stale-while-revalidate for Google Fonts
  if (FONTS_HOSTS.some((h) => url.hostname.includes(h))) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Cache-first for everything else (app shell)
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return the cached index.html as fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise;
}
