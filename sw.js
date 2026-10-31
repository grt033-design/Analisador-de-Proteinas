const CACHE_NAME = 'analisador-proteina-v24';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

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
  // Avisos do administrador sempre vêm da rede, nunca do cache
  if (event.request.url.includes('avisos.json')) return;
  // Contagem de uso e painel de números sempre pela rede
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname === '/numeros') return;
  // O app instalado abre por /inicio: serve a mesma página do cache, inclusive sem internet
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
