// Service worker: abre sin conexión (últimos archivos) y muestra los avisos.
const CACHE = 'pe-v14';
const SHELL = ['/', '/index.html', '/app.js', '/shared.js', '/style.css', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Primero la red (para ver siempre la última versión); si no hay conexión, el caché. La API nunca se cachea.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/cal/')) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); } return r; })
    .catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())));
});
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let n = { title: 'Proyectos Eleven', body: 'Tenés un aviso.' };
    try { const sub = await self.registration.pushManager.getSubscription(); const r = await fetch('/api/last-notification?ep=' + encodeURIComponent(sub?.endpoint || ''), { cache: 'no-store' }); if (r.ok) n = await r.json(); } catch { /* sin red */ }
    await self.registration.showNotification(n.title, { body: n.body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'pe-aviso' });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow('/'))));
});
