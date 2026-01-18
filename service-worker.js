const CACHE_NAME = "my-cache-v1";

// List of assets to precache
const PRECACHE_ASSETS = [
  '/reference/',
  '/reference/index.html',
  '/reference/style.css',
  '/reference/script.js',
  '/reference/db.json',
  '/reference/f16.glb',
  '/reference/three.js',
  '/reference/Orbit.js',
  '/reference/Loader.js',
  '/reference/781a.png',
  '/reference/781H-images-0.jpg',
  '/reference/781H-images-1.jpg',
  '/reference/icon.jpg',
  ''
];

// Install event - cache files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/CC/index.html')
        .then((resp) => resp || caches.match('/CC/offline.html'))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((resp) => resp)
    );
  }
});

