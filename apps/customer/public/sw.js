const CACHE_NAME = "tuma-static-v1";
const STATIC_ASSETS = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Cache-first for our own static assets only — everything else (API calls,
// pages) goes straight to the network. Order status, chat, and payments
// change too often to safely serve from a cache.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});

// A push arrives as an opaque encrypted blob the browser has already
// decrypted for us by the time this fires — showNotification() is what
// actually produces the popup + system notification sound on the phone.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload — fall back to the defaults below.
  }
  const title = data.title || "Tuma";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "You have a new message",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "tuma-chat",
      data: { url: data.url || "/" },
    }),
  );
});

// Tapping the notification should land on the actual conversation, reusing
// an already-open tab rather than stacking a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // Some browsers refuse cross-origin navigate; focusing is still useful.
            }
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
