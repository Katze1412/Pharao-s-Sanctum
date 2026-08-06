const CACHE_NAME = 'pharaos-sanctum-v1';
const ASSETS = [
  './', './index.html', './manifest.json',
  './js/config.js', './js/state.js', './js/offline-data.js', './js/offline-ui.js',
  './js/data.js', './js/auth.js', './js/render-main.js', './js/listeners-main.js',
  './js/cardmarket.js', './js/modal-core.js', './js/backup.js', './js/folder-settings.js',
  './js/deck-data.js', './js/deck-builder.js', './js/settings.js',
  './js/csv-import.js', './js/scan-ocr.js', './js/app.js'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  if(event.request.method !== 'GET') return;
  if(!event.request.url.startsWith('http')) return;
  event.respondWith(
    caches.match(event.request).then(function(cached){
      return fetch(event.request).then(function(response){
        if(response && response.ok){
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, clone); });
        }
        return response;
      }).catch(function(){ return cached; });
    })
  );
});
