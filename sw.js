const ROOT = "/ref";

// You can make this "1.0.7" or "42" or "2026-03-03-1" — anything.
// The ONLY requirement is: change it whenever you deploy new assets.
const APP_VERSION = "1.0.3";

importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

if (self.workbox) {
  workbox.setConfig({ debug: false });

  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Precache your app shell (served even offline)
  workbox.precaching.precacheAndRoute([
    { url: `${ROOT}/`,                  revision: APP_VERSION },
    { url: `${ROOT}/index.html`,        revision: APP_VERSION },
    { url: `${ROOT}/script.js`,         revision: APP_VERSION },
    { url: `${ROOT}/style.css`,         revision: APP_VERSION },
    { url: `${ROOT}/manifest.json`,     revision: APP_VERSION },

    // Libraries / modules you listed in your current SW
    { url: `${ROOT}/three.js`,          revision: APP_VERSION },
    { url: `${ROOT}/Orbit.js`,          revision: APP_VERSION },
    { url: `${ROOT}/Loader.js`,         revision: APP_VERSION },

    // Static assets
    { url: `${ROOT}/icon.jpg`,          revision: APP_VERSION },
    { url: `${ROOT}/781a.png`,          revision: APP_VERSION },
    { url: `${ROOT}/781H-images-0.jpg`, revision: APP_VERSION },
    { url: `${ROOT}/781H-images-1.jpg`, revision: APP_VERSION },
    { url: `${ROOT}/f16.glb`,           revision: APP_VERSION },

    // If you want db.json available offline immediately, uncomment this.
    // (If you prefer it only runtime-cached, leave it out.)
    // { url: `${ROOT}/db.json`,        revision: APP_VERSION },
  ]);

  workbox.precaching.cleanupOutdatedCaches();

  // Navigations (refresh / direct URL):
  // Online: fetch. Offline: serve cached index.html (your “app shell”)
  workbox.routing.registerRoute(
    ({ request }) => request.mode === "navigate",
    async () => {
      try {
        return await fetch(`${ROOT}/index.html`, { cache: "no-store" });
      } catch (e) {
        return await caches.match(`${ROOT}/index.html`);
      }
    }
  );

  // Everything else (same-origin assets): stale-while-revalidate is a nice balance.
  // - Serves cached instantly
  // - If online, updates cache in background so you get updates without manual clearing
  workbox.routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith(`${ROOT}/`),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "runtime-assets",
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 300,
          maxAgeSeconds: 90 * 24 * 60 * 60, // 90 days
        }),
      ],
    })
  );
}

