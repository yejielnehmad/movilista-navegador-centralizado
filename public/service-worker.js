
// Nombre de la caché
const CACHE_NAME = 'navegador-centralizado-v1';

// Archivos para caché inicial
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Instalar service worker y cachear archivos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caché abierta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activar y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Estrategia de caché: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Servir desde caché si está disponible
        if (response) {
          // Intentamos actualizar la caché en segundo plano
          fetch(event.request).then((newResponse) => {
            if (newResponse && newResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, newResponse);
              });
            }
          });
          return response;
        }

        // Si no está en caché, buscamos en la red
        return fetch(event.request)
          .then((response) => {
            // Si la solicitud falla, retornamos error
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clonamos la respuesta (porque solo se puede usar una vez)
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      }).catch(() => {
        // Si no hay red y no tenemos caché, mostramos página offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// Manejo de sincronización en segundo plano
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Función para sincronizar datos cuando haya conexión
async function syncData() {
  // Implementa la lógica de sincronización con Supabase
  // Este es un placeholder, la implementación real vendrá después
  console.log('Sincronizando datos con backend...');
}
