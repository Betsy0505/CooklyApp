// ============================================================
// Cookly - Service Worker
// ============================================================

const CACHE_NAME = 'cookly-v1.0.3';

const OFFLINE_URL = '/index.html';

const STATIC_FILES = [
    '/',
    '/index.html',
    '/manifest.json'
];


// ============================================================
// INSTALACIÓN
// ============================================================

self.addEventListener('install', event => {

    console.log('[Service Worker] Instalando:', CACHE_NAME);

    event.waitUntil(

        caches.open(CACHE_NAME)

            .then(cache => {

                return Promise.allSettled(

                    STATIC_FILES.map(url =>

                        cache.add(url).catch(error => {

                            console.warn(
                                '[Service Worker] No se pudo cachear:',
                                url,
                                error
                            );

                        })

                    )

                );

            })

            .then(() => {

                console.log(
                    '[Service Worker] Instalación completada'
                );

                // Activa inmediatamente la nueva versión
                return self.skipWaiting();

            })

    );

});


// ============================================================
// ACTIVACIÓN
// ============================================================

self.addEventListener('activate', event => {

    console.log(
        '[Service Worker] Activando:',
        CACHE_NAME
    );

    event.waitUntil(

        caches.keys()

            .then(cacheNames => {

                return Promise.all(

                    cacheNames.map(cacheName => {

                        if (cacheName !== CACHE_NAME) {

                            console.log(
                                '[Service Worker] Eliminando caché antigua:',
                                cacheName
                            );

                            return caches.delete(cacheName);

                        }

                    })

                );

            })

            .then(() => {

                // Toma control inmediatamente de las páginas abiertas
                return self.clients.claim();

            })

    );

});


// ============================================================
// FETCH
// ============================================================

self.addEventListener('fetch', event => {

    const request = event.request;

    // Solo nos interesa GET
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);


    // ========================================================
    // NO CACHEAR APIs
    // ========================================================

    // Esto es MUY importante para tu conexión con Baserow.
    // Las peticiones al backend siempre deben ir a internet.

    if (
        url.pathname.startsWith('/api/') ||
        url.hostname.includes('apicookly.bytekod.online') ||
        url.hostname.includes('api.baserow.io')
    ) {

        event.respondWith(

            fetch(request).catch(error => {

                console.error(
                    '[Service Worker] Error en API:',
                    error
                );

                throw error;

            })

        );

        return;
    }


    // ========================================================
    // NAVEGACIÓN / HTML
    // ========================================================

    // Para HTML usamos NETWORK FIRST.
    //
    // Esto significa:
    //
    // 1. Primero intenta cargar la versión nueva.
    // 2. Si no hay internet, usa la versión guardada.

    if (
        request.mode === 'navigate' ||
        request.destination === 'document'
    ) {

        event.respondWith(

            fetch(request)

                .then(response => {

                    if (
                        response &&
                        response.status === 200
                    ) {

                        const copy = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {

                                cache.put(
                                    request,
                                    copy
                                );

                            });

                    }

                    return response;

                })

                .catch(() => {

                    return caches.match(
                        OFFLINE_URL
                    );

                })

        );

        return;
    }


    // ========================================================
    // RECURSOS ESTÁTICOS
    // ========================================================

    // CSS, JS, imágenes, fuentes, etc.
    //
    // Cache First:
    // si existe en caché lo usa.
    // Si no existe, lo descarga.

    event.respondWith(

        caches.match(request)

            .then(cachedResponse => {

                if (cachedResponse) {

                    return cachedResponse;

                }


                return fetch(request)

                    .then(response => {

                        if (
                            response &&
                            response.status === 200 &&
                            response.type !== 'opaque'
                        ) {

                            const copy =
                                response.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {

                                    cache.put(
                                        request,
                                        copy
                                    );

                                });

                        }

                        return response;

                    })

                    .catch(error => {

                        console.warn(
                            '[Service Worker] No se pudo cargar:',
                            request.url
                        );

                        throw error;

                    });

            })

    );

});


// ============================================================
// NOTIFICACIONES PUSH
// ============================================================

self.addEventListener('push', event => {

    let data = {};

    try {

        data = event.data
            ? event.data.json()
            : {};

    } catch (error) {

        console.error(
            '[Service Worker] Error leyendo push:',
            error
        );

    }

    const options = {

        body: data.body || 'Tienes una nueva notificación',

        icon: '/icon-192.png',

        badge: '/icon-192.png',

        vibrate: [
            200,
            100,
            200
        ],

        data: {

            url: data.url || '/'

        }

    };


    event.waitUntil(

        self.registration.showNotification(

            data.title || 'Cookly',

            options

        )

    );

});


// ============================================================
// CLICK EN NOTIFICACIÓN
// ============================================================

self.addEventListener(
    'notificationclick',
    event => {

        event.notification.close();

        event.waitUntil(

            clients.openWindow(
                event.notification.data.url || '/'
            )

        );

    }
);