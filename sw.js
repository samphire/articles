// Service worker: keeps the whole app, including every practice text, on the device
// so it works offline. Bump VERSION whenever you deploy changed files.
const VERSION = "v1";
const CACHE = "article-trainer-" + VERSION;
const FILES = [
    "./",
    "index.html",
    "articles.js",
    "articles.css",
    "texts.json",
    "manifest.json",
    "bg.jpg",
    "bg-mob.jpg",
    "icon-192.png",
    "icon-192x192.png",
    "512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k.startsWith("article-trainer-") && k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Serve from the cache straight away (fast and offline), and refresh the cached
// copy from the network in the background so updates arrive on the next launch.
self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

    event.respondWith(
        caches.open(CACHE).then((cache) =>
            cache.match(req, { ignoreSearch: true }).then((cached) => {
                const network = fetch(req)
                    .then((res) => {
                        if (res.ok) cache.put(req, res.clone());
                        return res;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        )
    );
});
