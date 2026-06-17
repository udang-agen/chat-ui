/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE_NAME = `chat-ui-${version}`;

// Assets to precache (app shell)
const ASSETS = [...build, ...files];

// Install: precache the app shell
sw.addEventListener("install", (event: ExtendableEvent) => {
	async function precache() {
		const cache = await caches.open(CACHE_NAME);
		await cache.addAll(ASSETS);
		// Force the waiting service worker to become the active one immediately
		await sw.skipWaiting();
	}
	event.waitUntil(precache());
});

// Activate: clean up old caches
sw.addEventListener("activate", (event: ExtendableEvent) => {
	async function cleanup() {
		const keys = await caches.keys();
		const oldKeys = keys.filter((key) => key !== CACHE_NAME);
		await Promise.all(oldKeys.map((key) => caches.delete(key)));
		// Take control of all clients immediately
		await sw.clients.claim();
	}
	event.waitUntil(cleanup());
});

// Fetch: serve cached assets, network-first for API calls
sw.addEventListener("fetch", (event: FetchEvent) => {
	const url = new URL(event.request.url);
	const isAttachment = url.pathname.match(/\/output\/[a-f0-9]{64}/);
	const isAPI = url.pathname.startsWith("/api/");
	const isAsset = ASSETS.some((asset) => url.pathname === asset);

	// Cache-first for app shell assets
	if (isAsset) {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				return cached ?? fetch(event.request);
			})
		);
		return;
	}

	// Cache-first for attachment blobs (GET /output/[sha256])
	if (isAttachment && event.request.method === "GET") {
		event.respondWith(
			caches.open(CACHE_NAME).then((cache) => {
				return cache.match(event.request).then((cached) => {
					if (cached) return cached;
					return fetch(event.request).then((response) => {
						if (response.ok) {
							cache.put(event.request, response.clone());
						}
						return response;
					});
				});
			})
		);
		return;
	}

	// Network-first for API calls
	if (isAPI) {
		event.respondWith(
			fetch(event.request).catch(() => {
				return caches.match(event.request).then((cached) => {
					if (cached) return cached;
					return new Response(null, { status: 503, statusText: "Offline" });
				});
			})
		);
		return;
	}

	// For all other requests (navigation, etc.), try network first, fall back to cached
	event.respondWith(
		fetch(event.request).catch(() => {
			return caches.match(event.request).then((cached) => {
				if (cached) return cached;
				// For navigation requests, try serving the root document
				if (event.request.mode === "navigate") {
					return caches
						.match("/")
						.then((root) => root ?? new Response(null, { status: 503, statusText: "Offline" }));
				}
				return new Response(null, { status: 503, statusText: "Offline" });
			});
		})
	);
});

// Listen for SKIP_WAITING message from the client
sw.addEventListener("message", (event: ExtendableMessageEvent) => {
	if (event.data?.type === "SKIP_WAITING") {
		void sw.skipWaiting();
	}
});
