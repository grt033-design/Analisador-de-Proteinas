const CACHE_NAME = 'analisador-proteina-v13';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Só intercepta GET do próprio app shell - a chamada de análise (POST na função) sempre vai direto pra rede
  if (event.request.method !== 'GET' || event.request.url.includes('/.netlify/functions/')) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
