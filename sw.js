// Service Worker básico para PWA: cache-first del shell, network-first de datos.
const CACHE = "viento-cenes-v76";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./auth.js",
  "./firebase-config.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./bg.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Datos en vivo o pronóstico: network-first sin cachear
  if (url.hostname.includes("pioupiou.fr") ||
      url.hostname.includes("open-meteo.com") ||
      url.hostname.includes("corsproxy.io") ||
      url.hostname.includes("aviationweather.gov") ||
      url.hostname.includes("tile.openstreetmap.org") ||
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("firebaseio.com") ||
      url.hostname.includes("identitytoolkit") ||
      url.hostname.includes("firestore.googleapis.com") ||
      url.hostname.includes("securetoken.googleapis.com") ||
      url.hostname.includes("firebaseapp.com") ||
      url.hostname.includes("accounts.google.com") ||
      url.pathname.includes("/__/auth")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Recursos del shell o CDN: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached ||
      fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === "GET") {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached)
    )
  );
});
