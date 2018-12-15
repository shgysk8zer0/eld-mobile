const config = {
	version: '1.0.0',
	caches: [
		'./',
		// Images
		'./img/icons.svg',
		'./img/favicon.svg',
		'./img/logo.png',
		// Fonts
		'./fonts/roboto.woff2',
	].map(path => new URL(path, this.registration.scope)),
	ignored: [
		'./manifest.json',
		'./service-worker.js',
	].map(path => new URL(path, this.registration.scope)),
	origins: [
		location.origin,
		'https://cdn.polyfill.io'
		//'https://i.imgur.com',
	],
};

async function deleteOldCaches() {
	const keys = await caches.keys();
	const filtered = keys.filter(v => v !== config.version);
	await Promise.all(filtered.map(v => caches.delete(v)));
}

function isValid(request) {
	const reqUrl = new URL(request.url);
	return request.method === 'GET'
		&& config.origins.includes(reqUrl.origin)
		&& ! config.ignored.some(url => {
			return reqUrl.href === url.href;
		});
}

self.addEventListener('install', async () => {
	if (! await caches.has(config.version)) {
		const cache = await caches.open(config.version);
		await deleteOldCaches();
		await cache.addAll(config.caches);
		skipWaiting();
	}
});

self.addEventListener('activate', event => {
	event.waitUntil(async function() {
		clients.claim();
	}());
});

self.addEventListener('fetch', event => {
	if (isValid(event.request)) {
		event.respondWith(async function() {
			const cache = await caches.open(config.version);
			const cached = await cache.match(event.request);

			if (cached instanceof Response) {
				if (navigator.onLine) {
					cache.add(event.request);
				}
				return cached;
			} else if (navigator.onLine) {
				event.waitUntil(cache.add(event.request));
				return fetch(event.request);
			}
		}());
	}
});
