const VERSION = "musicmixer-v2";
const APP_CACHE = `${VERSION}-app`;
const ENGINE_CACHE = `${VERSION}-engine`;
const APP_SHELL = ["/", "/about/", "/privacy/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/musicmixer-original.png", "/shaurya-penguin.jpg", "/shaurya-website.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![APP_CACHE, ENGINE_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/ffmpeg/") || request.mode === "navigate")) {
        const cacheName = url.pathname.startsWith("/ffmpeg/") ? ENGINE_CACHE : APP_CACHE;
        void caches.open(cacheName).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    }))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_FFMPEG") return;
  const variant = event.data.variant === "mt" ? "mt" : "st";
  const assets = [`/ffmpeg/${variant}/ffmpeg-core.js`, `/ffmpeg/${variant}/ffmpeg-core.wasm`];
  if (variant === "mt") assets.push("/ffmpeg/mt/ffmpeg-core.worker.js");
  event.waitUntil(caches.open(ENGINE_CACHE).then((cache) => cache.addAll(assets)).then(() => event.source?.postMessage({ type: "FFMPEG_CACHED", variant })));
});
