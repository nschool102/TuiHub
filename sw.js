// =========================================================================
// SERVICE WORKER — TUI HUB
// Cache toàn bộ shell + module. Cập nhật CACHE_NAME (đổi số version) mỗi khi
// deploy bản mới để buộc client tải lại cache.
// =========================================================================

const CACHE_NAME = 'tui-hub-v16';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon.png',
    './assets/css/shell.css',
    './assets/js/shell.js',
    './modules/finance/finance.css',
    './modules/finance/finance.js',
    './modules/huyenhoc/huyenhoc.css',
    './modules/huyenhoc/huyenhoc.js',
    './modules/calculator/calculator.css',
    './modules/calculator/calculator.js',
    './modules/settings/settings.css',
    './modules/settings/settings.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .catch(err => console.log('Lỗi cache:', err))
    );
    self.skipWaiting();
}); // end event install

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
}); // end event activate

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
}); // end event fetch

self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Tui Hub';
    const options = {
        body: data.body || 'Bạn có thông báo mới!',
        icon: './icon.png',
        badge: './icon.png',
        vibrate: [200, 100, 200]
    };
    event.waitUntil(self.registration.showNotification(title, options));
}); // end event push

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow('./'));
}); // end event notificationclick

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, icon } = event.data;
        self.registration.showNotification(title, {
            body,
            icon: icon || './icon.png',
            vibrate: [200, 100, 200]
        });
    }
}); // end event message
