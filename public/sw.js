const CACHE = 'gamecenter-v4';
const SHELL = ['/', '/center.css', '/center.js', '/shared/base.css', '/shared/remote-navigation.js', '/icon.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/') || url.pathname === '/health') return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && ['document', 'style', 'script', 'image', 'font'].includes(event.request.destination)) {
      const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('/') : new Response('', { status: 503 }))));
});
