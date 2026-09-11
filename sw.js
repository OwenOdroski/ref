const ROOT = ".";
const APP_VERSION = "1.1.2";
const CACHE_NAME = `app-cache-${APP_VERSION}`;

const APP_FILES = [
  `${ROOT}/`,
  `${ROOT}/index.html`,
  `${ROOT}/script.js`,
  `${ROOT}/style.css`,
  `${ROOT}/manifest.json`,
  `${ROOT}/three.js`,
  `${ROOT}/Orbit.js`,
  `${ROOT}/Loader.js`,
  `${ROOT}/icon.jpg`,
  `${ROOT}/f16.glb`,
  `${ROOT}/781H-images-0.jpg`,
  `${ROOT}/781H-images-1.jpg`,
  `${ROOT}/cockpit.glb`,
  `${ROOT}/security.js`,
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );

      await self.clients.claim();
    })()
  );
});

async function networkFirstWithUpdate(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request, { cache: "no-store" });

    if (networkResponse && networkResponse.ok) {
      // Update cached version with fresh file
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (err) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Optional fallback for navigations
    if (request.mode === "navigate") {
      const fallback = await cache.match(`${ROOT}/index.html`);
      if (fallback) return fallback;
    }

    return new Response("Offline and no cached file found.", {
      status: 503,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirstWithUpdate(event.request));
});
