// =========================================================
// sw.js - Service Worker para Cookly
// =========================================================

// IMPORTANTE:
// Cambiamos la versión para obligar al navegador a crear
// una caché nueva y eliminar la anterior.
const CACHE_NAME = 'cookly-v1.0.3';

const OFFLINE_URL = '/index.html';

// =========================================================
// ARCHIVOS LOCALES PRINCIPALES
// =========================================================

const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/LogoCorto.png'
];

// =========================================================
// RECURSOS EXTERNOS QUE COOKLY NECESITA
// =========================================================

const externalResources = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// =========================================================
// INSTALACIÓN
// =========================================================

self.addEventListener('install', event => {

    console.log('[Service Worker] Instalando Cookly...');

    event.waitUntil(

        caches.open(CACHE_NAME)

            .then(async cache => {

                console.log('[Service Worker] Guardando archivos locales...');

                // Guardamos los archivos locales uno por uno
                await Promise.allSettled(

                    urlsToCache.map(async url => {

                        try {

                            const response = await fetch(url);

                            if (response.ok) {

                                await cache.put(url, response.clone());

                                console.log(
                                    '[Service Worker] OK:',
                                    url
                                );

                            }

                        } catch (error) {

                            console.warn(
                                '[Service Worker] No se pudo guardar:',
                                url
                            );

                        }

                    })

                );

                // =====================================================
                // GUARDAR TAILWIND Y FONT AWESOME
                // =====================================================

                console.log(
                    '[Service Worker] Guardando librerías externas...'
                );

                await Promise.allSettled(

                    externalResources.map(async url => {

                        try {

                            // no-cors permite guardar respuestas
                            // externas aunque sean "opaque"
                            const response = await fetch(url, {
                                mode: 'no-cors'
                            });

                            if (
                                response &&
                                (
                                    response.ok ||
                                    response.type === 'opaque'
                                )
                            ) {

                                await cache.put(
                                    url,
                                    response.clone()
                                );

                                console.log(
                                    '[Service Worker] Librería guardada:',
                                    url
                                );

                            }

                        } catch (error) {

                            console.warn(
                                '[Service Worker] No se pudo guardar librería:',
                                url
                            );

                        }

                    })

                );

            })

            .then(() => {

                console.log(
                    '[Service Worker] Instalación completada'
                );

                return self.skipWaiting();

            })

    );

});

// =========================================================
// ACTIVACIÓN
// =========================================================

self.addEventListener('activate', event => {

    console.log('[Service Worker] Activando Cookly...');

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

                console.log(
                    '[Service Worker] Activación completada'
                );

                return self.clients.claim();

            })

    );

});

// =========================================================
// FETCH
// =========================================================

self.addEventListener('fetch', event => {

    const request = event.request;

    // Solo nos interesan peticiones GET.
    // POST/PUT/PATCH/DELETE hacia Baserow/API
    // NO deben guardarse en caché.
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // =========================================================
    // PETICIONES A TAILWIND / FONT AWESOME
    // =========================================================

    const esRecursoExternoCookly =
        url.hostname === 'cdn.tailwindcss.com' ||
        url.hostname === 'cdnjs.cloudflare.com';

    if (esRecursoExternoCookly) {

        event.respondWith(

            caches.match(request)

                .then(cachedResponse => {

                    // Si ya existe en caché:
                    // usarlo inmediatamente.
                    if (cachedResponse) {

                        // Intentamos actualizarlo en segundo plano
                        fetch(request)
                            .then(response => {

                                if (
                                    response &&
                                    (
                                        response.ok ||
                                        response.type === 'opaque'
                                    )
                                ) {

                                    caches.open(CACHE_NAME)
                                        .then(cache => {

                                            cache.put(
                                                request,
                                                response.clone()
                                            );

                                        });

                                }

                            })
                            .catch(() => {
                                // Estamos offline.
                            });

                        return cachedResponse;

                    }

                    // Si todavía no existe en caché,
                    // intentamos descargarlo.
                    return fetch(request)

                        .then(response => {

                            if (
                                response &&
                                (
                                    response.ok ||
                                    response.type === 'opaque'
                                )
                            ) {

                                const copia = response.clone();

                                caches.open(CACHE_NAME)
                                    .then(cache => {

                                        cache.put(
                                            request,
                                            copia
                                        );

                                    });

                            }

                            return response;

                        })

                        .catch(() => {

                            console.warn(
                                '[Service Worker] Recurso externo no disponible:',
                                request.url
                            );

                            return new Response('', {
                                status: 503,
                                statusText: 'Offline'
                            });

                        });

                })

        );

        return;
    }

    // =========================================================
    // PETICIONES DEL PROPIO COOKLY
    // =========================================================

    // Solo cacheamos recursos de nuestro propio dominio.
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(

        caches.match(request)

            .then(cachedResponse => {

                // =================================================
                // SI ESTÁ EN CACHÉ
                // =================================================

                if (cachedResponse) {

                    // Actualización en segundo plano
                    fetch(request)

                        .then(response => {

                            if (
                                response &&
                                response.ok
                            ) {

                                caches.open(CACHE_NAME)
                                    .then(cache => {

                                        cache.put(
                                            request,
                                            response.clone()
                                        );

                                    });

                            }

                        })

                        .catch(() => {
                            // Sin internet.
                        });

                    return cachedResponse;
                }

                // =================================================
                // SI NO ESTÁ EN CACHÉ
                // =================================================

                return fetch(request)

                    .then(response => {

                        if (
                            response &&
                            response.ok
                        ) {

                            caches.open(CACHE_NAME)
                                .then(cache => {

                                    cache.put(
                                        request,
                                        response.clone()
                                    );

                                });

                        }

                        return response;

                    })

                    .catch(() => {

                        // =================================================
                        // SI ES UNA PÁGINA Y ESTAMOS OFFLINE
                        // =================================================

                        if (request.mode === 'navigate') {

                            return caches.match(
                                OFFLINE_URL
                            );

                        }

                        return new Response('', {
                            status: 503,
                            statusText: 'Offline'
                        });

                    });

            })

    );

});

// =========================================================
// NOTIFICACIONES PUSH
// =========================================================

self.addEventListener('push', event => {

    try {

        const data = event.data
            ? event.data.json()
            : {};

        const options = {

            body: data.body || 'Nueva notificación de Cookly',

            icon: '/LogoCorto.png',

            badge: '/LogoCorto.png',

            vibrate: [200, 100, 200],

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

    } catch (error) {

        console.error(
            '[Service Worker] Error en push:',
            error
        );

    }

});

// =========================================================
// CLICK EN NOTIFICACIÓN
// =========================================================

self.addEventListener('notificationclick', event => {

    event.notification.close();

    const url =
        event.notification.data &&
        event.notification.data.url
            ? event.notification.data.url
            : '/';

    event.waitUntil(

        clients.openWindow(url)

    );

});