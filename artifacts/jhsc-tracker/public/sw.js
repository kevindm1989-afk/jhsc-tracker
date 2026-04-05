self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function() { self.clients.claim(); });
self.addEventListener('fetch', function(event) {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(function() { return caches.match('/'); }));
  }
});
